from fastapi import APIRouter, HTTPException, Depends, Body
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import asyncio
import uuid
import logging

from server import (
    verify_token,
    db,
    firestore,
    user_col,
    Todo,
    TodoCreateRequest,
    DailyTodoCreateRequest,
    DailyTodoUpdateRequest,
    normalize_daily_todo_doc,
    normalize_todo_priority,
    normalize_todo_status,
    ensure_team_membership,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/todos")
async def get_todos(user: Dict[str, Any] = Depends(verify_token)):
    from server import stream_docs
    todos = await stream_docs(
        user_col(user["uid"], "todos").order_by("created_at", direction=firestore.Query.DESCENDING)
    )
    return todos


@router.post("/todos")
async def create_todo(
    todo_request: TodoCreateRequest,
    user: Dict[str, Any] = Depends(verify_token),
):
    todo_data = todo_request.dict()
    if todo_data.get("due_date"):
        todo_data["due_date"] = datetime.fromisoformat(todo_data["due_date"].replace("Z", "+00:00"))
    todo = Todo(uid=user["uid"], **todo_data)
    await asyncio.to_thread(user_col(user["uid"], "todos").document(todo.id).set, todo.dict())
    return todo


@router.put("/todos/{todo_id}")
async def update_todo(
    todo_id: str,
    todo_request: TodoCreateRequest,
    user: Dict[str, Any] = Depends(verify_token),
):
    todo_data = todo_request.dict()
    if todo_data.get("due_date"):
        todo_data["due_date"] = datetime.fromisoformat(todo_data["due_date"].replace("Z", "+00:00"))
    update_data = {**todo_data, "updated_at": datetime.now(timezone.utc)}
    await asyncio.to_thread(user_col(user["uid"], "todos").document(todo_id).update, update_data)
    snap = await asyncio.to_thread(user_col(user["uid"], "todos").document(todo_id).get)
    return snap.to_dict()


@router.put("/todos/{todo_id}/toggle")
async def toggle_todo(todo_id: str, user: Dict[str, Any] = Depends(verify_token)):
    doc_ref = user_col(user["uid"], "todos").document(todo_id)
    snap = await asyncio.to_thread(doc_ref.get)
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Todo not found")
    data = snap.to_dict()
    await asyncio.to_thread(doc_ref.update, {
        "completed": not data.get("completed", False),
        "updated_at": datetime.now(timezone.utc),
    })
    return (await asyncio.to_thread(doc_ref.get)).to_dict()


@router.delete("/todos/{todo_id}")
async def delete_todo(todo_id: str, user: Dict[str, Any] = Depends(verify_token)):
    doc_ref = user_col(user["uid"], "todos").document(todo_id)
    if not (await asyncio.to_thread(doc_ref.get)).exists:
        raise HTTPException(status_code=404, detail="Todo not found")
    await asyncio.to_thread(doc_ref.delete)
    return {"message": "Todo deleted"}


@router.get("/daily-todos/{target_user_id}/{date}")
async def get_daily_todos(
    target_user_id: str,
    date: str,
    team_id: Optional[str] = None,
    user: Dict[str, Any] = Depends(verify_token),
):
    requester_uid = user["uid"]
    can_read = requester_uid == target_user_id
    if not can_read and team_id:
        try:
            await ensure_team_membership(team_id, requester_uid)
            await ensure_team_membership(team_id, target_user_id)
            can_read = True
        except HTTPException:
            pass
    if not can_read:
        raise HTTPException(status_code=403, detail="Not authorized to view these todos")
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    doc_ref = db.collection("dailyTodos").document(f"{target_user_id}_{date}")
    snap = await asyncio.to_thread(doc_ref.get)
    if not snap.exists:
        return {
            "success": True,
            "data": {"userId": target_user_id, "date": date, "items": [], "updatedAt": int(datetime.now(timezone.utc).timestamp() * 1000)},
            "readOnly": requester_uid != target_user_id,
        }
    return {"success": True, "data": normalize_daily_todo_doc(snap.to_dict()), "readOnly": requester_uid != target_user_id}


@router.put("/daily-todos/{target_user_id}/{date}")
async def update_daily_todos(
    target_user_id: str,
    date: str,
    body: Dict[str, Any] = Body(...),
    user: Dict[str, Any] = Depends(verify_token),
):
    if user["uid"] != target_user_id:
        raise HTTPException(status_code=403, detail="Not authorized to modify these todos")
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    items = body.get("items", [])
    if not isinstance(items, list):
        raise HTTPException(status_code=400, detail="Items must be a list")
    data = normalize_daily_todo_doc({"userId": target_user_id, "date": date, "items": items, "updatedAt": int(datetime.now(timezone.utc).timestamp() * 1000)})
    await asyncio.to_thread(db.collection("dailyTodos").document(f"{target_user_id}_{date}").set, data)
    return {"success": True, "data": data}


@router.post("/daily-todos/{target_user_id}/{date}/items")
async def add_daily_todo_item(
    target_user_id: str,
    date: str,
    item: DailyTodoCreateRequest,
    user: Dict[str, Any] = Depends(verify_token),
):
    if user["uid"] != target_user_id:
        raise HTTPException(status_code=403, detail="Not authorized to modify these todos")
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    doc_ref = db.collection("dailyTodos").document(f"{target_user_id}_{date}")
    snap = await asyncio.to_thread(doc_ref.get)
    new_item = {
        "id": str(uuid.uuid4()),
        "text": item.text,
        "done": False,
        "time": item.time,
        "priority": normalize_todo_priority(item.priority),
        "status": normalize_todo_status(item.status, False),
    }
    if snap.exists:
        data = snap.to_dict()
        data.setdefault("items", []).append(new_item)
        data["updatedAt"] = int(datetime.now(timezone.utc).timestamp() * 1000)
    else:
        data = {"userId": target_user_id, "date": date, "items": [new_item], "updatedAt": int(datetime.now(timezone.utc).timestamp() * 1000)}
    data = normalize_daily_todo_doc(data)
    await asyncio.to_thread(doc_ref.set, data)
    return {"success": True, "data": data, "newItem": new_item}


@router.patch("/daily-todos/{target_user_id}/{date}/items/{item_id}")
async def update_daily_todo_item(
    target_user_id: str,
    date: str,
    item_id: str,
    updates: DailyTodoUpdateRequest,
    user: Dict[str, Any] = Depends(verify_token),
):
    if user["uid"] != target_user_id:
        raise HTTPException(status_code=403, detail="Not authorized to modify these todos")
    doc_ref = db.collection("dailyTodos").document(f"{target_user_id}_{date}")
    snap = await asyncio.to_thread(doc_ref.get)
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Daily todos not found")
    data = snap.to_dict()
    items = data.get("items", [])
    item_found = False
    for it in items:
        if it.get("id") == item_id:
            item_found = True
            if updates.text is not None:
                it["text"] = updates.text
            if updates.done is not None:
                it["done"] = updates.done
            if updates.time is not None:
                it["time"] = updates.time
            if updates.priority is not None:
                it["priority"] = normalize_todo_priority(updates.priority)
            if updates.status is not None:
                it["status"] = normalize_todo_status(updates.status, it.get("done"))
            elif updates.done is not None:
                it["status"] = "done" if updates.done else "todo"
            break
    if not item_found:
        raise HTTPException(status_code=404, detail="Item not found")
    data["items"] = items
    data["updatedAt"] = int(datetime.now(timezone.utc).timestamp() * 1000)
    data = normalize_daily_todo_doc(data)
    await asyncio.to_thread(doc_ref.set, data)
    return {"success": True, "data": data}


@router.delete("/daily-todos/{target_user_id}/{date}/items/{item_id}")
async def delete_daily_todo_item(
    target_user_id: str,
    date: str,
    item_id: str,
    user: Dict[str, Any] = Depends(verify_token),
):
    if user["uid"] != target_user_id:
        raise HTTPException(status_code=403, detail="Not authorized to modify these todos")
    doc_ref = db.collection("dailyTodos").document(f"{target_user_id}_{date}")
    snap = await asyncio.to_thread(doc_ref.get)
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Daily todos not found")
    data = snap.to_dict()
    items = data.get("items", [])
    original_len = len(items)
    items = [i for i in items if i.get("id") != item_id]
    if len(items) == original_len:
        raise HTTPException(status_code=404, detail="Item not found")
    data["items"] = items
    data["updatedAt"] = int(datetime.now(timezone.utc).timestamp() * 1000)
    data = normalize_daily_todo_doc(data)
    await asyncio.to_thread(doc_ref.set, data)
    return {"success": True, "data": data}
