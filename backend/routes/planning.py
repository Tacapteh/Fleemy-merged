from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
import asyncio
import calendar
import logging

from server import (
    verify_token,
    db,
    firestore,
    user_col,
    user_doc,
    team_col,
    stream_docs,
    ensure_team_membership,
    global_event_doc,
    global_task_doc,
    _build_planning_event_payload,
    _planning_event_doc,
    _serialize_timestamp,
    PlanningEvent,
    WeeklyTask,
    EventCreateRequest,
    TaskCreateRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/planning/week/{year}/{week}")
async def get_week_planning(
    year: int,
    week: int,
    team_id: Optional[str] = None,
    user: Dict[str, Any] = Depends(verify_token),
):
    logger.info("/planning/week/%s/%s called", year, week)
    try:
        if team_id:
            await ensure_team_membership(team_id, user["uid"])
            events_ref = team_col(team_id, "events")
            tasks_ref = team_col(team_id, "tasks")
        else:
            events_ref = user_col(user["uid"], "events")
            tasks_ref = user_col(user["uid"], "tasks")
        try:
            events = await stream_docs(events_ref.where("year", "==", year).where("week", "==", week))
            tasks = await stream_docs(tasks_ref.where("year", "==", year).where("week", "==", week))
        except Exception as e:
            logger.error("Firestore planning error: %s", e, exc_info=True)
            events, tasks = [], []
        return {"success": True, "events": events if isinstance(events, list) else [], "tasks": tasks if isinstance(tasks, list) else []}
    except Exception as e:
        logger.error("get_week_planning error: %s", e, exc_info=True)
        return {"success": False, "error": str(e), "events": [], "tasks": []}


@router.get("/planning/week/{year}/{week}/test")
async def test_week_planning(year: int, week: int):
    return {"year": year, "week": week, "ok": True}


@router.get("/planning/month/{year}/{month}")
async def get_month_planning(
    year: int,
    month: int,
    team_id: Optional[str] = None,
    user: Dict[str, Any] = Depends(verify_token),
):
    try:
        last_day = calendar.monthrange(year, month)[1]
        pairs = {(datetime(year, month, d).isocalendar().year, datetime(year, month, d).isocalendar().week) for d in range(1, last_day + 1)}
        if team_id:
            await ensure_team_membership(team_id, user["uid"])
            events_ref = team_col(team_id, "events")
            tasks_ref = team_col(team_id, "tasks")
        else:
            events_ref = user_col(user["uid"], "events")
            tasks_ref = user_col(user["uid"], "tasks")
        events: List[Dict[str, Any]] = []
        tasks: List[Dict[str, Any]] = []
        for y, w in pairs:
            events += await stream_docs(events_ref.where("year", "==", y).where("week", "==", w))
            tasks += await stream_docs(tasks_ref.where("year", "==", y).where("week", "==", w))
        return {"success": True, "events": events, "tasks": tasks}
    except Exception as e:
        logger.error("get_month_planning error: %s", e, exc_info=True)
        return {"success": False, "error": str(e), "events": [], "tasks": []}


@router.get("/planning/events")
async def list_events(
    year: Optional[int] = None,
    week: Optional[int] = None,
    user: Dict[str, Any] = Depends(verify_token),
):
    try:
        if year is not None and week is not None:
            events_raw = await stream_docs(db.collection("events").document(str(year)).collection(str(week)))
            events_raw = events_raw if isinstance(events_raw, list) else []
        else:
            ref = user_col(user["uid"], "events")
            if year is not None:
                ref = ref.where("year", "==", year)
            if week is not None:
                ref = ref.where("week", "==", week)
            events_raw = await stream_docs(ref)
            events_raw = events_raw if isinstance(events_raw, list) else []
        formatted = [{"**ev": ev, "id": ev.get("id"), "title": ev.get("description", ""), "color": ev.get("color", ""), "startTime": ev.get("start_time"), "endTime": ev.get("end_time"), "status": ev.get("status")} for ev in events_raw]
        return JSONResponse({"success": True, "events": formatted}, media_type="application/json")
    except Exception as e:
        logger.error("list_events error: %s", e, exc_info=True)
        return JSONResponse({"success": False, "events": [], "error": str(e)}, media_type="application/json")


@router.get("/planning/events/{owner_id}/{year}/{week}")
async def list_events_by_owner(owner_id: str, year: int, week: int):
    try:
        events_raw = await stream_docs(db.collection("events").document(str(year)).collection(str(week)))
        events_raw = events_raw if isinstance(events_raw, list) else []
        filtered = [ev for ev in events_raw if ev.get("owner_id") == owner_id or (not ev.get("owner_id") and ev.get("uid") == owner_id)]
        formatted = [{**ev, "id": ev.get("id"), "title": ev.get("description", ""), "color": ev.get("color", ""), "startTime": ev.get("start_time"), "endTime": ev.get("end_time"), "status": ev.get("status")} for ev in filtered]
        return {"success": True, "events": formatted}
    except Exception as e:
        logger.error("list_events_by_owner error: %s", e, exc_info=True)
        return {"success": False, "events": [], "error": str(e)}


@router.post("/planning/events")
async def create_event(
    event_request: EventCreateRequest,
    user: Dict[str, Any] = Depends(verify_token),
):
    try:
        now = datetime.now(timezone.utc)
        year = event_request.year or now.year
        week = event_request.week or now.isocalendar()[1]
        target_team_id = event_request.team_id or None
        if target_team_id:
            await ensure_team_membership(target_team_id, user["uid"])
            events_ref = team_col(target_team_id, "events")
        else:
            events_ref = user_col(user["uid"], "events")
        event = PlanningEvent(
            uid=user["uid"], week=week, year=year,
            description=event_request.description, client_id=event_request.client_id or "",
            client_name=event_request.client_name, day=event_request.day,
            start_time=event_request.start_time, end_time=event_request.end_time,
            status=event_request.status,
            hourly_rate=event_request.hourly_rate if event_request.hourly_rate is not None else 50.0,
            team_id=target_team_id, owner_id=user["uid"],
        )
        event_payload = event.dict()
        planning_payload = _build_planning_event_payload(event_payload)
        tasks = [
            asyncio.to_thread(events_ref.document(event.id).set, event_payload),
            asyncio.to_thread(global_event_doc(year, week, event.id).set, event_payload),
        ]
        if planning_payload:
            planning_ref = _planning_event_doc(event_payload.get("owner_id", user["uid"]), target_team_id, event.id)
            tasks.append(asyncio.to_thread(planning_ref.set, planning_payload))
        await asyncio.gather(*tasks)
        return {"success": True, "event": event_payload}
    except Exception as e:
        logger.error("create_event error: %s", e, exc_info=True)
        return {"success": False, "error": str(e)}


@router.put("/planning/events/{event_id}")
async def update_event(
    event_id: str,
    event_request: EventCreateRequest,
    user: Dict[str, Any] = Depends(verify_token),
):
    target_team_id = event_request.team_id or None
    if target_team_id:
        await ensure_team_membership(target_team_id, user["uid"])
        doc_ref = team_col(target_team_id, "events").document(event_id)
    else:
        doc_ref = user_col(user["uid"], "events").document(event_id)
    snap = await asyncio.to_thread(doc_ref.get)
    if not snap.exists:
        return {"success": False, "error": "Event not found"}
    existing = snap.to_dict()
    owner_id = existing.get("owner_id", existing.get("uid", user["uid"]))
    new_year = event_request.year or existing.get("year")
    new_week = event_request.week or existing.get("week")
    update_fields = {
        "description": event_request.description, "client_id": event_request.client_id or "",
        "client_name": event_request.client_name, "day": event_request.day,
        "start_time": event_request.start_time, "end_time": event_request.end_time,
        "status": event_request.status,
        "hourly_rate": event_request.hourly_rate if event_request.hourly_rate is not None else existing.get("hourly_rate", 50.0),
        "year": new_year, "week": new_week, "team_id": target_team_id,
        "owner_id": owner_id, "uid": owner_id, "updated_at": datetime.now(timezone.utc),
    }
    await asyncio.to_thread(doc_ref.update, update_fields)
    payload = {**existing, **update_fields}
    planning_payload = _build_planning_event_payload(payload)
    tasks = []
    if existing.get("year") and existing.get("week"):
        tasks.append(asyncio.to_thread(global_event_doc(existing["year"], existing["week"], event_id).delete))
    tasks.append(asyncio.to_thread(global_event_doc(new_year, new_week, event_id).set, payload))
    if planning_payload:
        tasks.append(asyncio.to_thread(_planning_event_doc(owner_id, target_team_id, event_id).set, planning_payload))
    if tasks:
        await asyncio.gather(*tasks)
    return {"success": True, "event": payload}


@router.delete("/planning/events/{event_id}")
async def delete_event(
    event_id: str,
    team_id: Optional[str] = None,
    user: Dict[str, Any] = Depends(verify_token),
):
    team_id = team_id or None
    if team_id:
        await ensure_team_membership(team_id, user["uid"])
        doc_ref = team_col(team_id, "events").document(event_id)
    else:
        doc_ref = user_col(user["uid"], "events").document(event_id)
    snap = await asyncio.to_thread(doc_ref.get)
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Event not found")
    data = snap.to_dict()
    owner_id = data.get("owner_id", data.get("uid", user["uid"]))
    tasks = [asyncio.to_thread(doc_ref.delete)]
    if data.get("year") and data.get("week"):
        tasks.append(asyncio.to_thread(global_event_doc(data["year"], data["week"], event_id).delete))
    tasks.append(asyncio.to_thread(_planning_event_doc(owner_id, team_id, event_id).delete))
    await asyncio.gather(*tasks)
    return {"success": True, "message": "deleted"}


@router.get("/planning/earnings/{year}/{week}")
async def get_earnings(
    year: int,
    week: int,
    team_id: Optional[str] = None,
    user: Dict[str, Any] = Depends(verify_token),
):
    user_snap = await asyncio.to_thread(user_doc(user["uid"]).get)
    db_user = user_snap.to_dict() if user_snap.exists else None
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    if team_id:
        await ensure_team_membership(team_id, user["uid"])
    events = [ev for ev in await stream_docs(user_col(user["uid"], "events").where("year", "==", year).where("week", "==", week)) if not ev.get("team_id")]
    tasks = [t for t in await stream_docs(user_col(user["uid"], "tasks").where("year", "==", year).where("week", "==", week)) if not t.get("team_id")]
    earnings = {"paid": 0, "unpaid": 0, "pending": 0, "not_worked": 0, "total": 0}
    for event in events:
        try:
            hours = int(event["end_time"].split(":")[0]) - int(event["start_time"].split(":")[0])
            amount = hours * event.get("hourly_rate", db_user.get("hourly_rate", 50.0))
        except Exception:
            amount = event.get("hourly_rate", db_user.get("hourly_rate", 50.0))
        status = event.get("status", "pending")
        earnings[status if status in earnings else "pending"] += amount
    for task in tasks:
        for ts in task.get("time_slots", []):
            try:
                hours = int(ts["end"].split(":")[0]) - int(ts["start"].split(":")[0])
                earnings["paid"] += hours * task.get("price", 0)
            except Exception:
                earnings["paid"] += task.get("price", 0)
    earnings["total"] = earnings["paid"] + earnings["unpaid"] + earnings["pending"]
    return {"success": True, "earnings": earnings}


@router.get("/planning/tasks")
async def list_tasks(
    year: Optional[int] = None,
    week: Optional[int] = None,
    user: Dict[str, Any] = Depends(verify_token),
):
    ref = user_col(user["uid"], "tasks")
    if year is not None:
        ref = ref.where("year", "==", year)
    if week is not None:
        ref = ref.where("week", "==", week)
    return {"success": True, "tasks": await stream_docs(ref)}


@router.post("/planning/tasks")
async def create_task(
    task_request: TaskCreateRequest,
    user: Dict[str, Any] = Depends(verify_token),
):
    now = datetime.now(timezone.utc)
    year = task_request.year or now.year
    week = task_request.week or now.isocalendar()[1]
    target_team_id = task_request.team_id or None
    if target_team_id:
        await ensure_team_membership(target_team_id, user["uid"])
        tasks_ref = team_col(target_team_id, "tasks")
    else:
        tasks_ref = user_col(user["uid"], "tasks")
    task = WeeklyTask(uid=user["uid"], week=week, year=year, team_id=target_team_id, owner_id=user["uid"], **task_request.dict(exclude={"year", "week", "team_id"}))
    task_payload = task.dict()
    await asyncio.to_thread(tasks_ref.document(task.id).set, task_payload)
    await asyncio.to_thread(global_task_doc(year, week, user["uid"], task.id).set, task_payload)
    return {"success": True, "task": task_payload}


@router.put("/planning/tasks/{task_id}")
async def update_task(
    task_id: str,
    task_request: TaskCreateRequest,
    user: Dict[str, Any] = Depends(verify_token),
):
    doc_ref = user_col(user["uid"], "tasks").document(task_id)
    snap = await asyncio.to_thread(doc_ref.get)
    existing_team_id: Optional[str] = None
    if not snap.exists:
        target_team_id = task_request.team_id
        if not target_team_id:
            return {"success": False, "error": "Task not found"}
        await ensure_team_membership(target_team_id, user["uid"])
        doc_ref = team_col(target_team_id, "tasks").document(task_id)
        snap = await asyncio.to_thread(doc_ref.get)
        if not snap.exists:
            return {"success": False, "error": "Task not found"}
        existing_team_id = target_team_id
    else:
        existing_team_id = snap.to_dict().get("team_id")
    existing = snap.to_dict()
    owner_id = existing.get("owner_id", existing.get("uid", user["uid"]))
    incoming = task_request.dict(exclude_unset=True)
    new_year = incoming.pop("year", existing.get("year"))
    new_week = incoming.pop("week", existing.get("week"))
    requested_team_id = incoming.pop("team_id", None)
    if isinstance(requested_team_id, str) and not requested_team_id.strip():
        requested_team_id = None
    target_team_id = requested_team_id if requested_team_id is not None else existing_team_id
    if target_team_id:
        await ensure_team_membership(target_team_id, user["uid"])
    update_fields = {**incoming, "year": new_year, "week": new_week, "team_id": target_team_id, "owner_id": owner_id, "uid": owner_id, "updated_at": datetime.now(timezone.utc)}
    payload = {**existing, **update_fields}
    destination_ref = team_col(target_team_id, "tasks").document(task_id) if target_team_id else user_col(user["uid"], "tasks").document(task_id)
    if destination_ref.path == doc_ref.path:
        await asyncio.to_thread(doc_ref.update, update_fields)
    else:
        await asyncio.to_thread(destination_ref.set, payload)
        await asyncio.to_thread(doc_ref.delete)
    existing_year = existing.get("year")
    existing_week = existing.get("week")
    if existing_year and existing_week and (existing_year != new_year or existing_week != new_week):
        await asyncio.to_thread(global_task_doc(existing_year, existing_week, owner_id, task_id).delete)
    if new_year and new_week:
        await asyncio.to_thread(global_task_doc(new_year, new_week, owner_id, task_id).set, payload)
    return {"success": True, "task": payload}


@router.delete("/planning/tasks/{task_id}")
async def delete_task(
    task_id: str,
    team_id: Optional[str] = None,
    user: Dict[str, Any] = Depends(verify_token),
):
    team_id = team_id or None
    if team_id:
        await ensure_team_membership(team_id, user["uid"])
        doc_ref = team_col(team_id, "tasks").document(task_id)
    else:
        doc_ref = user_col(user["uid"], "tasks").document(task_id)
    snap = await asyncio.to_thread(doc_ref.get)
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Task not found")
    data = snap.to_dict()
    owner_id = data.get("owner_id", data.get("uid", user["uid"]))
    await asyncio.to_thread(doc_ref.delete)
    if data.get("year") and data.get("week"):
        await asyncio.to_thread(global_task_doc(data["year"], data["week"], owner_id, task_id).delete)
    return {"success": True, "message": "deleted"}
