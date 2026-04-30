from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from typing import Dict, Any, List
from datetime import datetime, timezone
import asyncio
import uuid
import logging

from server import (
    verify_token,
    db,
    firestore,
    apply_notification_rules_for_user,
    NotificationMarkReadRequest,
    NotificationCreateRequest,
)

try:
    from firebase_admin import messaging as fcm_messaging
    _fcm_available = True
except Exception:
    _fcm_available = False

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/notifications/list")
async def list_notifications(
    userId: str,
    onlyUnread: bool = True,
    limit: int = 20,
    user: Dict[str, Any] = Depends(verify_token),
):
    try:
        if user["uid"] != userId:
            raise HTTPException(status_code=403, detail="Vous n'êtes pas autorisé à lire les notifications d'un autre utilisateur")

        await apply_notification_rules_for_user(userId)
        notifications_ref = db.collection("notifications")
        query = notifications_ref.where("userId", "==", userId)
        if onlyUnread:
            query = query.where("read", "==", False)
        query = query.order_by("createdAt", direction=firestore.Query.DESCENDING).limit(limit)

        try:
            docs = await asyncio.to_thread(lambda: list(query.stream()))
        except Exception as e:
            error_msg = str(e).lower()
            if "failedprecondition" in error_msg or "index" in error_msg or "requires an index" in error_msg:
                logger.warning("Missing Firestore Index for notifications. Falling back to in-memory sort.")
                fallback_query = notifications_ref.where("userId", "==", userId)
                if onlyUnread:
                    fallback_query = fallback_query.where("read", "==", False)
                docs = await asyncio.to_thread(lambda: list(fallback_query.stream()))
                docs.sort(key=lambda x: x.get("createdAt") or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
                docs = docs[:limit]
            else:
                raise

        notifications: List[Dict[str, Any]] = []
        for doc in docs:
            data = doc.to_dict()
            if data:
                notifications.append({
                    "id": doc.id,
                    "userId": data.get("userId"),
                    "title": data.get("title"),
                    "message": data.get("message"),
                    "type": data.get("type"),
                    "createdAt": data.get("createdAt").isoformat() if isinstance(data.get("createdAt"), datetime) else data.get("createdAt"),
                    "read": data.get("read", False),
                    "relatedResource": data.get("relatedResource"),
                })
        return {"success": True, "notifications": notifications}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("list_notifications error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Impossible de récupérer les notifications")


@router.patch("/notifications/mark-read")
async def mark_notifications_read(
    request_data: NotificationMarkReadRequest,
    user: Dict[str, Any] = Depends(verify_token),
):
    try:
        if user["uid"] != request_data.userId:
            raise HTTPException(status_code=403, detail="Vous n'êtes pas autorisé à modifier les notifications d'un autre utilisateur")
        if not request_data.notificationIds:
            return {"status": "ok", "updated": 0}

        updated_count = 0
        notifications_ref = db.collection("notifications")
        for notification_id in request_data.notificationIds:
            try:
                doc_ref = notifications_ref.document(notification_id)
                snap = await asyncio.to_thread(doc_ref.get)
                if not snap.exists:
                    continue
                if snap.to_dict().get("userId") != request_data.userId:
                    continue
                await asyncio.to_thread(doc_ref.update, {"read": True})
                updated_count += 1
            except Exception as notif_error:
                logger.error("Error updating notification %s: %s", notification_id, notif_error)
        return {"status": "ok", "updated": updated_count}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("mark_notifications_read error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Impossible de marquer les notifications comme lues")


@router.post("/notifications/create-test")
async def create_test_notification(
    notification_request: NotificationCreateRequest,
    user: Dict[str, Any] = Depends(verify_token),
):
    try:
        if user["uid"] != notification_request.userId:
            raise HTTPException(status_code=403, detail="Vous n'êtes pas autorisé à créer des notifications pour un autre utilisateur")
        doc_id = str(uuid.uuid4())
        created_at_dt = datetime.now(timezone.utc)
        notification_data = {
            "userId": notification_request.userId,
            "title": notification_request.title,
            "message": notification_request.message,
            "type": notification_request.type,
            "createdAt": created_at_dt,
            "read": False,
            "relatedResource": notification_request.relatedResource,
        }
        await asyncio.to_thread(db.collection("notifications").document(doc_id).set, notification_data)
        return {
            "status": "created",
            "id": doc_id,
            "notification": {**notification_data, "id": doc_id, "createdAt": created_at_dt.isoformat()},
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("create_test_notification error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Impossible de créer la notification")


# FCM routes

class FcmRegisterRequest:
    def __init__(self, token: str, userId: str):
        self.token = token
        self.userId = userId


@router.post("/notifications/register")
async def fcm_register(req: Dict[str, Any]):
    try:
        token = req.get("token")
        user_id = req.get("userId")
        if not token or not user_id:
            raise HTTPException(status_code=400, detail="token and userId are required")
        user_ref = db.collection("users").document(user_id)
        await asyncio.to_thread(user_ref.set, {"fcmToken": token}, merge=True)
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("fcm_register error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to save FCM token")


async def _send_fcm_at(token: str, title: str, body: str, delay_seconds: float):
    if delay_seconds > 0:
        await asyncio.sleep(delay_seconds)
    if not _fcm_available:
        logger.warning("FCM not available, skipping send")
        return
    try:
        message = fcm_messaging.Message(
            notification=fcm_messaging.Notification(title=title, body=body),
            token=token,
        )
        response = fcm_messaging.send(message)
        logger.info("FCM sent: %s", response)
    except Exception as e:
        logger.error("FCM send error: %s", e, exc_info=True)


@router.post("/notifications/schedule")
async def fcm_schedule(req: Dict[str, Any]):
    try:
        reminder_dt = datetime.fromisoformat(req["reminderAt"])
        if reminder_dt.tzinfo is None:
            reminder_dt = reminder_dt.replace(tzinfo=timezone.utc)
        delay = max(0.0, (reminder_dt - datetime.now(timezone.utc)).total_seconds())
        snap = await asyncio.to_thread(db.collection("users").document(req["userId"]).get)
        if not snap.exists:
            raise HTTPException(status_code=404, detail="User not found")
        token = (snap.to_dict() or {}).get("fcmToken")
        if not token:
            raise HTTPException(status_code=400, detail="No FCM token for user")
        asyncio.create_task(_send_fcm_at(token, req["title"], req["body"], delay))
        return {"status": "scheduled", "delay_seconds": delay}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("fcm_schedule error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to schedule notification")


@router.post("/notifications/send")
async def fcm_send(req: Dict[str, Any]):
    if not _fcm_available:
        raise HTTPException(status_code=503, detail="FCM not available")
    try:
        message = fcm_messaging.Message(
            notification=fcm_messaging.Notification(title=req["title"], body=req["body"]),
            token=req["token"],
        )
        return {"status": "sent", "response": fcm_messaging.send(message)}
    except Exception as e:
        logger.error("fcm_send error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
