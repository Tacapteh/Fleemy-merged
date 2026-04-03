from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from backend.server import app, db


AUTH_HEADERS = {"Authorization": "Bearer test-token-123"}


def _clear_firestore_store() -> None:
    store = getattr(db, "store", None)
    if isinstance(store, dict):
        store.clear()


@pytest.fixture(autouse=True)
def reset_inmemory_firestore():
    _clear_firestore_store()
    yield
    _clear_firestore_store()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _iso_day_to_name(iso_day: int) -> str:
    mapping = {
        1: "monday",
        2: "tuesday",
        3: "wednesday",
        4: "thursday",
        5: "friday",
        6: "saturday",
        7: "sunday",
    }
    return mapping[iso_day]


def _get_notifications(client: TestClient):
    response = client.get(
        "/api/notifications/list",
        params={"userId": "test-user-123", "onlyUnread": True, "limit": 20},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload.get("success") is True
    return payload.get("notifications", [])


def test_unpaid_event_notification_created(client: TestClient):
    now = datetime.now(timezone.utc)
    iso_year, iso_week, iso_day = now.isocalendar()

    create_response = client.post(
        "/api/planning/events",
        json={
            "description": "Réparation chaudière",
            "client_id": "client-001",
            "client_name": "Mme Dupont",
            "day": _iso_day_to_name(iso_day),
            "start_time": "09:00",
            "end_time": "11:00",
            "status": "pending",
            "hourly_rate": 75,
            "year": iso_year,
            "week": iso_week,
        },
        headers=AUTH_HEADERS,
    )
    assert create_response.status_code == 200
    event_payload = create_response.json()["event"]
    event_id = event_payload["id"]

    old_created_at = now - timedelta(days=8)
    db.collection("users").document("test-user-123").collection("events").document(event_id).update(
        {"created_at": old_created_at}
    )

    notifications = _get_notifications(client)
    assert len(notifications) == 1
    notification = notifications[0]
    assert notification["type"] == "payment"
    assert notification["relatedResource"]["resourceId"] == event_id
    assert "Paiement" in notification["title"]

    # Subsequent fetches should not duplicate the notification
    notifications_again = _get_notifications(client)
    assert len(notifications_again) == 1


def test_pending_quote_notification_created(client: TestClient):
    now = datetime.now(timezone.utc)
    valid_until = (now + timedelta(days=30)).isoformat().replace("+00:00", "Z")

    create_response = client.post(
        "/api/quotes",
        json={
            "client_id": "client-002",
            "client_name": "SARL Martin",
            "title": "Installation pompe à chaleur",
            "items": [
                {"description": "Main d'oeuvre", "quantity": 2, "unit_price": 150.0, "total": 300.0}
            ],
            "tax_rate": 20.0,
            "valid_until": valid_until,
        },
        headers=AUTH_HEADERS,
    )
    assert create_response.status_code == 200
    quote_payload = create_response.json()
    quote_id = quote_payload["id"]

    update_response = client.put(
        f"/api/quotes/{quote_id}/status",
        params={"status": "sent"},
        headers=AUTH_HEADERS,
    )
    assert update_response.status_code == 200

    old_created_at = now - timedelta(days=4)
    db.collection("users").document("test-user-123").collection("quotes").document(quote_id).update(
        {"created_at": old_created_at}
    )

    notifications = _get_notifications(client)
    assert len(notifications) == 1
    notification = notifications[0]
    assert notification["type"] == "devis"
    assert notification["relatedResource"]["resourceId"] == quote_id
    assert "Devis" in notification["title"]


def test_upcoming_event_reminder_created(client: TestClient):
    now = datetime.now(timezone.utc)
    target_start = (now + timedelta(minutes=45)).replace(second=0, microsecond=0)
    target_end = target_start + timedelta(hours=1)
    iso_year, iso_week, iso_day = target_start.isocalendar()

    create_response = client.post(
        "/api/planning/events",
        json={
            "description": "Entretien climatisation",
            "client_id": "client-003",
            "client_name": "M. Bernard",
            "day": _iso_day_to_name(iso_day),
            "start_time": target_start.strftime("%H:%M"),
            "end_time": target_end.strftime("%H:%M"),
            "status": "pending",
            "hourly_rate": 65,
            "year": iso_year,
            "week": iso_week,
        },
        headers=AUTH_HEADERS,
    )
    assert create_response.status_code == 200
    event_payload = create_response.json()["event"]
    event_id = event_payload["id"]

    notifications = _get_notifications(client)
    assert len(notifications) == 1
    notification = notifications[0]
    assert notification["type"] == "rappel"
    assert notification["relatedResource"]["resourceId"] == event_id
    assert "Rendez-vous" in notification["title"]
