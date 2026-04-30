from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import asyncio
import logging

from server import (
    verify_token,
    db,
    stream_docs,
    Client,
    ClientCreateRequest,
    ClientUpdateRequest,
    validate_email,
    validate_french_phone,
    normalize_boolean,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/clients")
async def get_clients(
    user: Dict[str, Any] = Depends(verify_token),
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    include_archived: bool = False,
):
    try:
        clients_ref = db.collection("clients")
        query = clients_ref.where("user_id", "==", user["uid"])
        if not include_archived:
            query = query.where("is_archived", "==", False)
        all_clients = await stream_docs(query)
        if search:
            search_lower = search.lower()
            all_clients = [
                c for c in all_clients
                if search_lower in c.get("display_name", "").lower()
            ]
        all_clients.sort(key=lambda x: x.get("display_name", "").lower())
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_clients = all_clients[start_idx:end_idx]

        def normalize_rate(raw):
            if raw is None or raw == "":
                return None
            try:
                return float(raw)
            except (TypeError, ValueError):
                return None

        paginated_clients = [
            {
                **client,
                "use_global_rate": normalize_boolean(client.get("use_global_rate"), True),
                "hourly_rate_custom": normalize_rate(client.get("hourly_rate_custom")),
            }
            for client in paginated_clients
        ]
        return {
            "clients": paginated_clients,
            "total": len(all_clients),
            "page": page,
            "limit": limit,
            "has_more": end_idx < len(all_clients),
        }
    except Exception as e:
        logger.error("get_clients error: %s", e, exc_info=True)
        return {"clients": [], "total": 0, "page": 1, "limit": limit, "has_more": False}


@router.post("/clients")
async def create_client(
    client_request: ClientCreateRequest,
    user: Dict[str, Any] = Depends(verify_token),
):
    data = client_request.dict()
    if not data.get("display_name") or not data["display_name"].strip():
        raise HTTPException(status_code=400, detail="display_name is required")
    if data.get("email") and not validate_email(data["email"]):
        raise HTTPException(status_code=400, detail="Invalid email format")
    if data.get("phone") and not validate_french_phone(data["phone"]):
        raise HTTPException(status_code=400, detail="Invalid phone format (French format required)")

    use_global_rate = normalize_boolean(data.get("use_global_rate"), True)
    data["use_global_rate"] = use_global_rate

    raw_custom_rate = data.get("hourly_rate_custom")
    if raw_custom_rate in (None, ""):
        custom_rate = None
    else:
        try:
            custom_rate = float(raw_custom_rate)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="hourly_rate_custom must be a number")
        if custom_rate < 0:
            raise HTTPException(status_code=400, detail="hourly_rate_custom must be >= 0")

    data["hourly_rate_custom"] = None if use_global_rate else (custom_rate if custom_rate is not None else 0.0)

    client = Client(user_id=user["uid"], **data)
    await asyncio.to_thread(db.collection("clients").document(client.id).set, client.dict())
    return client


@router.patch("/clients/{client_id}")
async def update_client(
    client_id: str,
    client_request: ClientUpdateRequest,
    user: Dict[str, Any] = Depends(verify_token),
):
    doc_ref = db.collection("clients").document(client_id)
    snap = await asyncio.to_thread(doc_ref.get)
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Client not found")
    existing = snap.to_dict()
    if existing.get("user_id") != user["uid"]:
        raise HTTPException(status_code=403, detail="Not authorized to modify this client")

    data = client_request.dict(exclude_unset=True)
    if "display_name" in data and (not data["display_name"] or not data["display_name"].strip()):
        raise HTTPException(status_code=400, detail="display_name cannot be empty")
    if "email" in data and data["email"] and not validate_email(data["email"]):
        raise HTTPException(status_code=400, detail="Invalid email format")
    if "phone" in data and data["phone"] and not validate_french_phone(data["phone"]):
        raise HTTPException(status_code=400, detail="Invalid phone format (French format required)")

    if "use_global_rate" in data:
        data["use_global_rate"] = normalize_boolean(data["use_global_rate"], existing.get("use_global_rate", True))
    if "hourly_rate_custom" in data:
        raw = data["hourly_rate_custom"]
        if raw in (None, ""):
            data["hourly_rate_custom"] = None
        else:
            try:
                v = float(raw)
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="hourly_rate_custom must be a number")
            if v < 0:
                raise HTTPException(status_code=400, detail="hourly_rate_custom must be >= 0")
            data["hourly_rate_custom"] = v

    effective_use_global = data.get("use_global_rate", existing.get("use_global_rate", True))
    if effective_use_global:
        data["hourly_rate_custom"] = None
    elif "hourly_rate_custom" not in data or data["hourly_rate_custom"] is None:
        data["hourly_rate_custom"] = existing.get("hourly_rate_custom", 0.0)

    await asyncio.to_thread(doc_ref.update, {**data, "updated_at": datetime.now(timezone.utc)})
    updated = await asyncio.to_thread(doc_ref.get)
    return updated.to_dict()


@router.delete("/clients/{client_id}")
async def delete_client(client_id: str, user: Dict[str, Any] = Depends(verify_token)):
    doc_ref = db.collection("clients").document(client_id)
    snap = await asyncio.to_thread(doc_ref.get)
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Client not found")
    if snap.to_dict().get("user_id") != user["uid"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete this client")
    await asyncio.to_thread(doc_ref.delete)
    return {"message": "Client deleted", "success": True}
