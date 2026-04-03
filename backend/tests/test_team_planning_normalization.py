from datetime import datetime, timedelta, timezone
from urllib.parse import quote

import pytest
from fastapi.testclient import TestClient

from backend.server import app, db, TeamPlanningSerializationError


@pytest.fixture(autouse=True)
def clear_in_memory_firestore():
    db.store.clear()
    yield
    db.store.clear()


def _make_headers():
    return {"Authorization": "Bearer test-token-123"}


def _create_team(team_id: str, owner_uid: str = "test-user-123") -> None:
    db.collection("teams").document(team_id).set({"owner_uid": owner_uid})


def test_team_planning_id_with_path_is_normalized():
    client = TestClient(app)
    team_id = "team-normalize"
    _create_team(team_id)

    now = datetime.now(timezone.utc)
    payload = {
        "id": "users/test-user-123/planningEvents/event-123",
        "title": "Bloc normalisé",
        "type": "event",
        "start": now.isoformat(),
        "end": (now + timedelta(hours=1)).isoformat(),
        "teamId": team_id,
    }

    response = client.post(
        f"/api/teams/{team_id}/planning",
        json=payload,
        headers=_make_headers(),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["item"]["id"] == "event-123"

    doc_ref = (
        db.collection("teams")
        .document(team_id)
        .collection("teamPlanning")
        .document("event-123")
    )
    snapshot = doc_ref.get()
    assert snapshot.exists
    data = snapshot.to_dict()
    assert data["title"] == "Bloc normalisé"


def test_team_planning_empty_id_generates_new_document():
    client = TestClient(app)
    team_id = "team-auto-id"
    _create_team(team_id)

    now = datetime.now(timezone.utc)
    payload = {
        "id": "   / / ",
        "title": "Bloc sans identifiant explicite",
        "type": "event",
        "start": now.isoformat(),
        "end": (now + timedelta(hours=2)).isoformat(),
        "teamId": team_id,
    }

    response = client.post(
        f"/api/teams/{team_id}/planning",
        json=payload,
        headers=_make_headers(),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    created_id = body["item"]["id"]
    assert isinstance(created_id, str) and created_id
    assert created_id != "   / / "


def test_team_planning_serialization_fallback(monkeypatch):
    client = TestClient(app)
    team_id = "team-serialization-fallback"
    _create_team(team_id)

    now = datetime.now(timezone.utc)
    payload = {
        "title": "Bloc fallback",
        "type": "task",
        "start": now.isoformat(),
        "end": (now + timedelta(hours=3)).isoformat(),
        "teamId": team_id,
        "status": "todo",
        "color": "#0092ff",
    }

    call_counter = {"value": 0}

    def _raise_serialization(_snapshot):
        call_counter["value"] += 1
        raise TeamPlanningSerializationError("Broken snapshot")

    monkeypatch.setattr("backend.server._serialize_team_planning_doc", _raise_serialization)

    response = client.post(
        f"/api/teams/{team_id}/planning",
        json=payload,
        headers=_make_headers(),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    item = body["item"]
    assert item["title"] == payload["title"]
    assert item["teamId"] == team_id
    assert item["start"] == payload["start"]
    assert item["end"] == payload["end"]
    assert item["timestamp"] is not None
    assert call_counter["value"] == 1


def test_team_planning_delete_normalizes_entry_id():
    client = TestClient(app)
    team_id = "team-delete-normalize"
    _create_team(team_id)

    now = datetime.now(timezone.utc)
    raw_entry_id = "users/test-user-123/planningEvents/event-456"
    payload = {
        "id": raw_entry_id,
        "title": "Bloc à supprimer",
        "type": "event",
        "start": now.isoformat(),
        "end": (now + timedelta(hours=1)).isoformat(),
        "teamId": team_id,
    }

    create_response = client.post(
        f"/api/teams/{team_id}/planning",
        json=payload,
        headers=_make_headers(),
    )

    assert create_response.status_code == 200
    created_id = create_response.json()["item"]["id"]
    assert created_id == "event-456"

    encoded_entry_id = quote(raw_entry_id, safe="")
    delete_response = client.delete(
        f"/api/teams/{team_id}/planning/{encoded_entry_id}",
        headers=_make_headers(),
    )

    assert delete_response.status_code == 200
    body = delete_response.json()
    assert body["success"] is True
    assert body["entry_id"] == "event-456"

    doc_ref = (
        db.collection("teams")
        .document(team_id)
        .collection("teamPlanning")
        .document("event-456")
    )
    assert not doc_ref.get().exists


def test_team_planning_persists_client_and_description():
    client = TestClient(app)
    team_id = "team-client-description"
    _create_team(team_id)

    now = datetime.now(timezone.utc)
    payload = {
        "title": "Consultation",
        "type": "event",
        "start": now.isoformat(),
        "end": (now + timedelta(hours=2)).isoformat(),
        "teamId": team_id,
        "description": "Audit UX",
        "clientId": "client-xyz",
        "clientName": "Studio Nova",
    }

    response = client.post(
        f"/api/teams/{team_id}/planning",
        json=payload,
        headers=_make_headers(),
    )

    assert response.status_code == 200
    item = response.json()["item"]
    assert item["clientId"] == payload["clientId"]
    assert item["clientName"] == payload["clientName"]
    assert item["description"] == payload["description"]

    listing = client.get(
        f"/api/teams/{team_id}/planning",
        headers=_make_headers(),
    )

    assert listing.status_code == 200
    entries = listing.json().get("items") or []
    assert entries, "Expected at least one planning entry"
    stored = entries[0]
    assert stored["clientId"] == payload["clientId"]
    assert stored["clientName"] == payload["clientName"]
    assert stored["description"] == payload["description"]
