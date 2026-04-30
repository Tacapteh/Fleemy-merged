from fastapi import APIRouter, HTTPException, Depends, Body
from fastapi.responses import JSONResponse
from typing import Dict, Any, List, Optional, Set
from datetime import datetime, timezone
import asyncio
import logging
import os

from pydantic import ValidationError

from server import (
    verify_token,
    db,
    firestore,
    user_doc,
    team_col,
    ensure_team_membership,
    ensure_membership_documents,
    generate_invite_code,
    _normalize_member_ids,
    _normalize_team_planning_entry_id,
    _build_team_planning_payload,
    _serialize_team_planning_doc,
    _serialize_team_planning_entry_fallback,
    _compute_member_initials,
    _parse_iso_datetime,
    _get_cached_teams,
    _set_cached_teams,
    _serialize_timestamp,
    _stream_memberships_with_retry,
    _run_team_planning_with_retry,
    _get_subcollection,
    _delete_collection,
    MembershipsUnavailableError,
    TeamPlanningOperationUnavailableError,
    TeamPlanningSerializationError,
    TeamCreateRequest,
    TeamJoinRequest,
    EnsureMembershipRequest,
    TeamPlanningEntry,
    Team,
    GoogleServiceUnavailable,
    GoogleDeadlineExceeded,
    GoogleInternal,
    PermissionDenied,
    Forbidden,
    NotFound,
    InvalidArgument,
    AlreadyExists,
    Aborted,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/teams")
async def create_team(
    team_request: TeamCreateRequest, user: Dict[str, Any] = Depends(verify_token)
):
    try:
        name = (team_request.name or "").strip()
        if len(name) < 2 or len(name) > 48:
            raise HTTPException(
                status_code=400,
                detail="Le nom de l'équipe doit contenir entre 2 et 48 caractères",
            )

        invite_code = await asyncio.to_thread(generate_invite_code, 8)

        team = Team(
            name=name,
            members=[user["uid"]],
            owner_uid=user["uid"],
            invite_code=invite_code,
        )

        owner_uid = user["uid"]
        team_payload = team.dict()
        team_payload.update(
            {
                "members": [owner_uid],
                "owner_uid": owner_uid,
                "ownerUid": owner_uid,
                "ownerId": owner_uid,
                "members_count": 1,
                "owner": {
                    "uid": owner_uid,
                    "user_uid": owner_uid,
                    "userUid": owner_uid,
                    "id": owner_uid,
                    "user_id": owner_uid,
                    "userId": owner_uid,
                },
                "inviteCode": invite_code,
            }
        )
        team_payload["created_at"] = firestore.SERVER_TIMESTAMP
        team_payload["updated_at"] = firestore.SERVER_TIMESTAMP

        await asyncio.to_thread(
            db.collection("teams").document(team.team_id).set,
            team_payload,
        )

        try:
            await ensure_membership_documents(team.team_id, user, include_joined_at=True)
        except Exception as membership_error:
            logger.warning(
                "Team %s created but membership docs failed: %s",
                team.team_id,
                membership_error,
            )

        logger.info("Team created: %s by user %s", team.team_id, user["uid"])

        return {
            "success": True,
            "team_id": team.team_id,
            "name": team.name,
            "invite_code": team.invite_code,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("create_team error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/teams/join")
async def join_team(
    join_request: TeamJoinRequest,
    user: Dict[str, Any] = Depends(verify_token),
):
    try:
        code = join_request.code.strip().upper()

        if not code:
            raise HTTPException(status_code=400, detail="Le code d'invitation est requis")

        teams_ref = db.collection("teams")
        teams: List[Any] = []
        last_error: Optional[Exception] = None

        for field_name in ("invite_code", "inviteCode"):
            try:
                query = teams_ref.where(field_name, "==", code).limit(1)
                teams = await asyncio.to_thread(lambda: list(query.stream()))
            except Exception as stream_error:
                last_error = stream_error
                logger.warning(
                    "Failed to query teams by %s: %s", field_name, stream_error, exc_info=True
                )
                continue

            if teams:
                break

        if not teams:
            if last_error:
                raise HTTPException(
                    status_code=503,
                    detail="Service d'invitation temporairement indisponible",
                )
            raise HTTPException(status_code=404, detail="Équipe introuvable")

        team_doc = teams[0]
        team_data = team_doc.to_dict()
        team_id = team_doc.id

        if team_data.get("invite_expires_at"):
            expiry = team_data["invite_expires_at"]
            if datetime.now(timezone.utc) > expiry:
                raise HTTPException(status_code=400, detail="Ce code d'invitation a expiré")

        current_members_raw = team_data.get("members", [])
        current_members = set(_normalize_member_ids(current_members_raw))

        if user["uid"] in current_members:
            return {
                "success": True,
                "team_id": team_id,
                "name": team_data.get("name"),
                "already_member": True,
            }

        members_update: Any
        if isinstance(current_members_raw, list):
            members_update = firestore.ArrayUnion([user["uid"]])
        else:
            members_update = list({*current_members, user["uid"]})

        update_payload = {
            "members": members_update,
            "members_count": len(current_members) + 1,
            "updated_at": firestore.SERVER_TIMESTAMP,
        }

        await asyncio.to_thread(
            db.collection("teams").document(team_id).update,
            update_payload,
        )

        logger.info("User %s joined team %s", user["uid"], team_id)

        await ensure_membership_documents(team_id, user, include_joined_at=True)

        return {"success": True, "team_id": team_id, "name": team_data.get("name")}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("join_team error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/teams/{team_id}/memberships/ensure")
async def ensure_membership_endpoint(
    team_id: str,
    ensure_request: EnsureMembershipRequest = Body(default=EnsureMembershipRequest()),
    user: Dict[str, Any] = Depends(verify_token),
):
    try:
        await ensure_team_membership(team_id, user["uid"])
        result = await ensure_membership_documents(
            team_id,
            user,
            include_joined_at=ensure_request.include_joined_at,
        )
        return {"success": True, "team_id": team_id, **result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("ensure_membership error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/teams/{team_id}/memberships")
async def get_team_memberships(
    team_id: str,
    user: Dict[str, Any] = Depends(verify_token),
):
    try:
        await ensure_team_membership(team_id, user["uid"])

        memberships_ref = team_col(team_id, "memberships")
        membership_docs = await _stream_memberships_with_retry(memberships_ref)

        members: List[Dict[str, Any]] = []
        for membership_doc in membership_docs:
            data = membership_doc.to_dict() or {}
            members.append(
                {
                    "uid": membership_doc.id,
                    "displayName": data.get("displayName") or data.get("name"),
                    "email": data.get("email"),
                    "joinedAt": _serialize_timestamp(data.get("joinedAt")),
                    "lastSeenAt": _serialize_timestamp(data.get("lastSeenAt")),
                }
            )

        return {"success": True, "members": members}
    except MembershipsUnavailableError as exc:
        logger.warning("get_team_memberships unavailable after retries: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "code": "MEMBERSHIPS_UNAVAILABLE",
                "message": "Memberships temporarily unavailable",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_team_memberships error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Impossible de récupérer les membres")


@router.get("/teams/{team_id}/planning")
async def get_team_planning(
    team_id: str,
    user: Dict[str, Any] = Depends(verify_token),
):
    await ensure_team_membership(team_id, user["uid"])

    def _load_entries():
        planning_ref = (
            db.collection("teams").document(team_id).collection("teamPlanning")
        )
        return list(planning_ref.stream())

    try:
        snapshots = await asyncio.to_thread(_load_entries)
        entries = [_serialize_team_planning_doc(snap) for snap in snapshots]
        entries.sort(
            key=lambda entry: (
                _parse_iso_datetime(entry.get("start"))
                or datetime.max.replace(tzinfo=timezone.utc),
                entry.get("id") or "",
            )
        )
        return {"success": True, "items": entries}
    except Exception as exc:
        logger.error("team planning fetch error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Impossible de charger le planning d'équipe")


@router.post("/teams/{team_id}/planning")
async def upsert_team_planning_entry(
    team_id: str,
    payload: TeamPlanningEntry,
    user: Dict[str, Any] = Depends(verify_token),
):
    await ensure_team_membership(team_id, user["uid"])

    creator_name = user.get("name") or user.get("displayName") or user.get("email") or "Membre"
    creator_defaults: Dict[str, Optional[str]] = {
        "uid": user.get("uid"),
        "name": creator_name,
        "email": user.get("email"),
        "initials": _compute_member_initials(creator_name, user.get("email")),
    }
    if not creator_defaults["uid"]:
        raise HTTPException(status_code=400, detail="Utilisateur non authentifié")

    entry_data = payload.model_dump()

    raw_entry_id = entry_data.get("id")
    normalized_entry_id = _normalize_team_planning_entry_id(raw_entry_id)
    if raw_entry_id and normalized_entry_id != raw_entry_id:
        logger.info(
            "Normalized team planning entry id from %r to %r for team %s",
            raw_entry_id,
            normalized_entry_id,
            team_id,
        )
    entry_data["id"] = normalized_entry_id

    payload_team_id_raw = entry_data.get("teamId")
    if payload_team_id_raw is None or (isinstance(payload_team_id_raw, str) and not payload_team_id_raw.strip()):
        entry_data["teamId"] = team_id
    else:
        payload_team_id = str(payload_team_id_raw).strip()
        if payload_team_id != team_id:
            raise HTTPException(status_code=400, detail="Identifiant d'équipe invalide")
        entry_data["teamId"] = payload_team_id

    team_doc = await asyncio.to_thread(lambda: db.collection("teams").document(team_id).get())
    if not team_doc.exists:
        raise HTTPException(status_code=404, detail="Équipe introuvable")

    planning_ref = db.collection("teams").document(team_id).collection("teamPlanning")
    existing_data: Optional[Dict[str, Any]] = None

    if entry_data.get("id"):
        doc_ref = planning_ref.document(entry_data["id"])

        def _fetch_existing():
            snap = doc_ref.get()
            return snap.to_dict() if getattr(snap, "exists", False) else None

        try:
            existing_data = await _run_team_planning_with_retry("fetch-existing", _fetch_existing)
        except TeamPlanningOperationUnavailableError as exc:
            logger.warning(
                "team planning existing document temporarily unavailable: %s", exc, exc_info=True
            )
            raise HTTPException(
                status_code=503,
                detail="Service planning temporairement indisponible, veuillez réessayer.",
            ) from exc
        if existing_data:
            entry_data.setdefault("createdBy", existing_data.get("createdBy"))
            entry_data.setdefault("createdByName", existing_data.get("createdByName"))
            entry_data.setdefault("createdByInitials", existing_data.get("createdByInitials"))

    try:
        entry = TeamPlanningEntry(**entry_data)
    except ValidationError as validation_error:
        logger.warning("team planning payload validation error: %s", validation_error)
        raise HTTPException(
            status_code=400, detail="Données invalides pour le bloc d'équipe"
        ) from validation_error
    payload_data = _build_team_planning_payload(entry, creator_defaults)

    def _persist():
        if entry.id:
            ref = planning_ref.document(entry.id)
            ref.set(payload_data, merge=True)
            return ref.id
        _write_time, doc_ref = planning_ref.add(payload_data)
        return doc_ref.id

    try:
        doc_id = await _run_team_planning_with_retry("persist", _persist)
        doc_ref = planning_ref.document(doc_id)
        snapshot = await _run_team_planning_with_retry("fetch", doc_ref.get)
        try:
            serialized = _serialize_team_planning_doc(snapshot)
        except TeamPlanningSerializationError as serialization_error:
            logger.warning(
                "team planning snapshot serialization failed for team %s doc %s: %s",
                team_id,
                doc_id,
                serialization_error,
                exc_info=True,
            )
            serialized = _serialize_team_planning_entry_fallback(entry, doc_id, creator_defaults)
        if not serialized.get("id"):
            serialized["id"] = doc_id
        return {"success": True, "item": serialized}
    except HTTPException:
        raise
    except TeamPlanningOperationUnavailableError as exc:
        logger.warning("team planning upsert temporarily unavailable: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=503,
            detail="Service planning temporairement indisponible, veuillez réessayer.",
        ) from exc
    except Exception as exc:
        logger.error("team planning upsert error: %s", exc, exc_info=True)
        if isinstance(exc, (PermissionDenied, Forbidden)):
            raise HTTPException(status_code=403, detail="Accès refusé pour cette équipe") from exc
        if isinstance(exc, NotFound):
            raise HTTPException(status_code=404, detail="Équipe introuvable") from exc
        if isinstance(exc, (InvalidArgument, ValueError, TypeError)):
            raise HTTPException(
                status_code=400, detail=f"Payload invalide: {type(exc).__name__}"
            ) from exc
        if isinstance(exc, (AlreadyExists, Aborted)):
            raise HTTPException(status_code=409, detail="Conflit d'écriture, réessayez") from exc
        if os.getenv("FLEEMY_DEBUG_ERRORS", "0") == "1":
            raise HTTPException(
                status_code=500,
                detail=f"Impossible d'enregistrer le bloc d'équipe — {type(exc).__name__}: {str(exc)}",
            )
        raise HTTPException(status_code=500, detail="Impossible d'enregistrer le bloc d'équipe")


@router.delete("/teams/{team_id}/planning/{entry_id:path}")
async def delete_team_planning_entry(
    team_id: str,
    entry_id: str,
    user: Dict[str, Any] = Depends(verify_token),
):
    await ensure_team_membership(team_id, user["uid"])

    normalized_entry_id = _normalize_team_planning_entry_id(entry_id)
    if not normalized_entry_id:
        raise HTTPException(status_code=400, detail="Identifiant de bloc invalide")

    if normalized_entry_id != entry_id:
        logger.info(
            "Normalized team planning entry id from %r to %r for team %s during delete",
            entry_id,
            normalized_entry_id,
            team_id,
        )

    planning_ref = (
        db.collection("teams")
        .document(team_id)
        .collection("teamPlanning")
        .document(normalized_entry_id)
    )

    try:
        await asyncio.to_thread(planning_ref.delete)
        return {"success": True, "entry_id": normalized_entry_id}
    except Exception as exc:
        logger.error("team planning delete error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Impossible de supprimer le bloc d'équipe")


@router.get("/teams/my")
async def get_my_teams(user: Dict[str, Any] = Depends(verify_token)):
    uid = user.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="User ID required")

    cached = _get_cached_teams(uid)
    if cached is not None:
        return {"success": True, "teams": cached}

    logger.info("/teams/my called for %s", uid)
    try:
        try:
            teams_ref = db.collection("teams")
        except (PermissionDenied, Forbidden, GoogleServiceUnavailable) as membership_error:
            logger.warning(
                "Unable to access teams collection for %s: %s", uid, membership_error, exc_info=True
            )
            return JSONResponse(
                status_code=503,
                content={
                    "success": False,
                    "code": "MEMBERSHIPS_UNAVAILABLE",
                    "message": "Memberships temporarily unavailable",
                },
            )

        def fetch_member_teams():
            try:
                member_query = teams_ref.where("members", "array_contains", uid)
                docs = list(member_query.stream())
                logger.info("fetch_member_teams found %d docs for UID %s", len(docs), uid)
                return docs
            except Exception as member_error:
                logger.error("teams members array query FAILED for %s: %s", uid, member_error, exc_info=True)
                return []

        async def fetch_owner_teams():
            owner_fields = ["owner_uid", "owner.uid", "owner.id"]

            async def _query_field(field_name: str) -> List[Any]:
                try:
                    query_ref = teams_ref.where(field_name, "==", uid)
                    docs = await asyncio.to_thread(lambda: list(query_ref.stream()))
                    if docs:
                        logger.info("owner query field '%s' found %d docs for UID %s", field_name, len(docs), uid)
                    return docs
                except Exception as exc:
                    logger.warning("owner query field '%s' failed for %s: %s", field_name, uid, exc)
                    return []

            results = await asyncio.gather(*[_query_field(f) for f in owner_fields])

            seen_team_ids: Set[str] = set()
            owner_documents: List[Any] = []
            for docs in results:
                for team_doc in docs:
                    if team_doc.id not in seen_team_ids:
                        owner_documents.append(team_doc)
                        seen_team_ids.add(team_doc.id)
            return owner_documents

        async def fetch_membership_docs() -> List[Any]:
            collection_group = getattr(db, "collection_group", None)
            if not callable(collection_group):
                return []

            collection_names = ("memberships", "members")
            all_snapshots = []

            async def _query_group(collection_name: str) -> List[Any]:
                try:
                    group_ref = collection_group(collection_name)
                    queries = [
                        (f"{collection_name}.uid", group_ref.where(field_path="uid", op_string="==", value=uid))
                    ]

                    async def _run_q(name, q):
                        try:
                            res = await asyncio.to_thread(lambda: list(q.stream()))
                            if res:
                                logger.info("group query '%s' found %d docs for UID %s", name, len(res), uid)
                            return res
                        except Exception as q_exc:
                            logger.error("group query '%s' FAILED for %s: %s", name, uid, q_exc)
                            return []

                    results = await asyncio.gather(*[_run_q(n, q) for n, q in queries])

                    merged = []
                    seen = set()
                    for docs in results:
                        for d in docs:
                            if d.id not in seen:
                                merged.append(d)
                                seen.add(d.id)
                    return merged
                except Exception as group_exc:
                    logger.error("collectionGroup '%s' logic FAILED for %s: %s", collection_name, uid, group_exc)
                    return []

            results = await asyncio.gather(*[_query_group(name) for name in collection_names])
            for snapshots in results:
                if snapshots:
                    all_snapshots.extend(snapshots)

            return all_snapshots

        member_docs, owner_docs, membership_docs = await asyncio.gather(
            asyncio.to_thread(fetch_member_teams),
            fetch_owner_teams(),
            fetch_membership_docs(),
        )

        seen_team_ids: Set[str] = set()
        teams: List[Dict[str, Any]] = []

        pending_metadata_ids: Set[str] = set()
        for doc in membership_docs:
            try:
                team_ref = getattr(doc.reference, "parent", None)
                if team_ref:
                    team_parent = getattr(team_ref, "parent", None)
                    if team_parent:
                        tid = team_parent.id
                        if tid not in seen_team_ids:
                            pending_metadata_ids.add(tid)
            except Exception:
                continue

        if pending_metadata_ids:
            async def _fetch_team(tid: str):
                try:
                    t_doc = await asyncio.to_thread(lambda: db.collection("teams").document(tid).get())
                    return t_doc if t_doc.exists else None
                except Exception:
                    return None

            metadata_docs = await asyncio.gather(*[_fetch_team(tid) for tid in pending_metadata_ids])
            for t_doc in metadata_docs:
                if t_doc and t_doc.id not in seen_team_ids:
                    data = t_doc.to_dict()
                    data["team_id"] = t_doc.id
                    teams.append(data)
                    seen_team_ids.add(t_doc.id)

        for doc in (member_docs + owner_docs):
            if doc.id not in seen_team_ids:
                data = doc.to_dict()
                data["team_id"] = doc.id
                teams.append(data)
                seen_team_ids.add(doc.id)

        for team in teams:
            for key in ["created_at", "updated_at", "invite_expires_at"]:
                if key in team:
                    team[key] = _serialize_timestamp(team[key])

        _set_cached_teams(uid, teams)

        return {"success": True, "teams": teams}

    except (GoogleServiceUnavailable, GoogleDeadlineExceeded, GoogleInternal, Aborted) as transient_error:
        logger.warning("Transient backend error while fetching teams for %s: %s", uid, transient_error)
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "code": "BACKEND_WARMUP",
                "message": "Service temporarily unavailable (warming up)",
            },
        )
    except Exception as e:
        logger.error("get_my_teams error: %s", e, exc_info=True)
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@router.post("/teams/{team_id}/rotate-code")
async def rotate_invite_code(
    team_id: str,
    user: Dict[str, Any] = Depends(verify_token),
):
    try:
        team_ref = db.collection("teams").document(team_id)
        team_snap = await asyncio.to_thread(team_ref.get)

        if not team_snap.exists:
            raise HTTPException(status_code=404, detail="Équipe introuvable")

        team_data = team_snap.to_dict()

        if team_data.get("owner_uid") != user["uid"]:
            raise HTTPException(status_code=403, detail="Seul le propriétaire peut régénérer le code")

        new_code = await asyncio.to_thread(generate_invite_code, 8)

        await asyncio.to_thread(
            team_ref.update,
            {
                "invite_code": new_code,
                "inviteCode": new_code,
                "updated_at": firestore.SERVER_TIMESTAMP,
            },
        )

        logger.info("Invite code rotated for team %s", team_id)

        return {"success": True, "invite_code": new_code}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("rotate_invite_code error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/teams/{team_id}")
async def delete_team(team_id: str, user: Dict[str, Any] = Depends(verify_token)):
    try:
        team_ref = db.collection("teams").document(team_id)
        team_snap = await asyncio.to_thread(team_ref.get)

        if not getattr(team_snap, "exists", False):
            raise HTTPException(status_code=404, detail="Équipe introuvable")

        team_data = team_snap.to_dict() or {}
        owner_uid = team_data.get("owner_uid")
        requester_uid = user.get("uid")

        if owner_uid != requester_uid:
            raise HTTPException(status_code=403, detail="Seul le propriétaire peut supprimer l'équipe")

        members: List[str] = list(team_data.get("members") or [])

        members_ref = _get_subcollection(team_ref, "members")
        if members_ref is not None:
            try:
                member_docs = await asyncio.to_thread(lambda: list(members_ref.stream()))
            except Exception:
                member_docs = []

            for member_doc in member_docs:
                member_ref = members_ref.document(member_doc.id)
                for nested_name in ("planningEvents", "weeklyTasks"):
                    nested_ref = _get_subcollection(member_ref, nested_name)
                    await _delete_collection(nested_ref)
                await asyncio.to_thread(member_ref.delete)

        for subcollection_name in ("memberships", "events", "tasks", "quotes", "invoices"):
            await _delete_collection(_get_subcollection(team_ref, subcollection_name))

        await asyncio.to_thread(team_ref.delete)

        async def cleanup_user(uid: str) -> None:
            if not uid:
                return
            user_ref = user_doc(uid)
            try:
                user_snap = await asyncio.to_thread(user_ref.get)
            except Exception:
                return
            if not getattr(user_snap, "exists", False):
                return
            data = user_snap.to_dict() or {}
            updates: Dict[str, Any] = {}
            if data.get("team_id") == team_id:
                updates["team_id"] = None
            last_context = data.get("last_context")
            if isinstance(last_context, dict) and last_context.get("team_id") == team_id:
                updates["last_context"] = None
            if updates:
                updates["updated_at"] = firestore.SERVER_TIMESTAMP
                await asyncio.to_thread(user_ref.update, updates)

        await asyncio.gather(*(cleanup_user(member_uid) for member_uid in members))

        logger.info("Team %s deleted by owner %s", team_id, requester_uid)
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("delete_team error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Impossible de supprimer l'équipe")
