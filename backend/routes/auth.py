from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Dict, Any
import asyncio
import logging

from server import verify_token, db, firestore, user_doc, User, LastContextUpdate

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/auth/me")
async def get_me(request: Request):
    try:
        user = await verify_token(request)
        logger.info("/auth/me called for %s", user.get("uid"))
        user_ref = user_doc(user["uid"])
        snapshot = await asyncio.to_thread(user_ref.get)
        db_user = snapshot.to_dict() if snapshot.exists else None
        if not db_user:
            new_user = User(
                uid=user["uid"],
                name=user.get("name", ""),
                email=user.get("email", ""),
                picture=user.get("picture"),
            )
            await asyncio.to_thread(user_ref.set, new_user.dict())
            db_user = new_user.dict()
        return {
            "user": {
                "uid": db_user["uid"],
                "name": db_user.get("name"),
                "email": db_user.get("email"),
                "picture": db_user.get("picture"),
                "hourly_rate": db_user.get("hourly_rate"),
                "team_id": db_user.get("team_id"),
                "last_context": db_user.get("last_context"),
            }
        }
    except Exception as e:
        logger.error("get_me error: %s", e, exc_info=True)
        return {"user": None}


@router.put("/auth/me")
async def update_me(hourly_rate: float, user: Dict[str, Any] = Depends(verify_token)):
    user_ref = user_doc(user["uid"])
    await asyncio.to_thread(user_ref.update, {"hourly_rate": hourly_rate})
    updated_user = await asyncio.to_thread(user_ref.get)
    return User(**updated_user.to_dict())


@router.put("/auth/context")
async def update_last_context(
    context: LastContextUpdate,
    user: Dict[str, Any] = Depends(verify_token),
):
    try:
        user_ref = user_doc(user["uid"])
        context_data = context.dict()
        await asyncio.to_thread(user_ref.update, {
            "last_context": context_data,
            "updated_at": firestore.SERVER_TIMESTAMP,
        })
        return {"success": True, "context": context_data}
    except Exception as e:
        logger.error("update_last_context error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard")
async def get_dashboard() -> Dict[str, str]:
    return {"status": "ok"}
