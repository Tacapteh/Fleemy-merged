import os
import json
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

import firebase_admin
from firebase_admin import credentials, firestore

logger = logging.getLogger(__name__)

# Déterminer le chemin vers la clé Firebase
cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")

if not cred_path:
    fallback = Path(__file__).parent / "serviceAccountKey.json"
    cred_path = str(fallback)
    logger.warning(f"⚠️ Variable GOOGLE_APPLICATION_CREDENTIALS absente, fallback local : {cred_path}")
else:
    logger.info(f"🟢 Clé Firebase détectée depuis l'env : {cred_path}")

# Initialisation de Firebase Admin si ce n’est pas déjà fait
if not firebase_admin._apps:
    # cred = credentials.Certificate(cred_path)
    # firebase_admin.initialize_app(cred)
    logger.info("✅ Firebase Admin initialisé (skipped for testing)")

def _ensure_doc_entry(node: Dict[str, Any]) -> Dict[str, Any]:
    node.setdefault("__doc__", {})
    node.setdefault("__subcollections__", {})
    return node


def _resolve_special_value(value: Any, current: Any = None) -> Any:
    """Handle Firestore sentinels like ArrayUnion and SERVER_TIMESTAMP.

    The in-memory store is used in environments where the Firestore emulator
    isn't available. We still receive the same sentinel objects (ArrayUnion,
    SERVER_TIMESTAMP), but they aren't directly serialisable to Python dicts.
    This helper resolves them to concrete Python values so ``set``/``update``
    behaves closer to Firestore and doesn't crash.
    """

    try:  # pragma: no cover - optional import depending on environment
        from firebase_admin import firestore as _firestore
    except Exception:  # pragma: no cover - fallback when firebase_admin missing
        _firestore = None

    # ArrayUnion support
    try:  # pragma: no cover - optional import depending on environment
        from google.cloud.firestore_v1.transforms import ArrayUnion  # type: ignore
    except Exception:  # pragma: no cover - fallback when dependency missing
        ArrayUnion = None  # type: ignore

    if ArrayUnion is not None and isinstance(value, ArrayUnion):
        existing = list(current) if isinstance(current, list) else []
        additions = list(getattr(value, "_values", []) or [])
        merged = list(dict.fromkeys([*existing, *additions]))
        return merged

    # SERVER_TIMESTAMP fallback
    if _firestore is not None and value is getattr(_firestore, "SERVER_TIMESTAMP", None):
        return datetime.utcnow()

    return value


def _to_plain_dict(data: Any, current: Dict[str, Any] | None = None) -> Dict[str, Any]:
    if isinstance(data, dict):
        return {
            key: _resolve_special_value(value, (current or {}).get(key))
            for key, value in data.items()
        }

    model_dump = getattr(data, "model_dump", None)
    if callable(model_dump):
        raw = dict(model_dump())
        return _to_plain_dict(raw, current)

    legacy_dict = getattr(data, "dict", None)
    if callable(legacy_dict):
        raw = dict(legacy_dict())
        return _to_plain_dict(raw, current)

    try:
        raw = dict(data)
    except Exception:
        return {}

    return _to_plain_dict(raw, current)


class InMemoryDocument(dict):
    def __init__(self, store, path):
        super().__init__()
        self.store = store
        self.path = path

    @property
    def id(self):
        return self.path[-1] if self.path else None

    def _doc_entry(self, create: bool = True):
        node = self.store
        for index, part in enumerate(self.path):
            is_collection = index % 2 == 0
            if is_collection:
                if part not in node:
                    if not create:
                        return None
                    node[part] = {}
                node = node[part]
            else:
                entry = node.get(part)
                if entry is None:
                    if not create:
                        return None
                    entry = {"__doc__": {}, "__subcollections__": {}}
                    node[part] = entry
                entry = _ensure_doc_entry(entry)
                if index == len(self.path) - 1:
                    return entry
                node = entry["__subcollections__"]
        return None

    def _ref(self):
        entry = self._doc_entry(create=True)
        return entry["__doc__"] if entry is not None else {}

    def set(self, data, merge=False):
        entry = self._doc_entry(create=True)
        if entry is None:
            return
        base = dict(entry.get("__doc__", {})) if merge else {}
        payload = _to_plain_dict(data, base)
        if merge:
            entry["__doc__"].update(payload)
        else:
            entry["__doc__"] = payload

    def update(self, data):
        entry = self._doc_entry(create=True)
        if entry is None:
            return
        current = dict(entry.get("__doc__", {}))
        entry["__doc__"].update(_to_plain_dict(data, current))

    def get(self):
        entry = self._doc_entry(create=False)

        class Snap:
            def __init__(self, doc_id, entry_data):
                self.id = doc_id
                self._entry = entry_data
                self.exists = entry_data is not None and "__doc__" in entry_data

            def to_dict(self):
                if self._entry and "__doc__" in self._entry:
                    return dict(self._entry["__doc__"])
                return {}

        doc_id = self.path[-1] if self.path else None
        return Snap(doc_id, entry)

    def delete(self):
        node = self.store
        for index, part in enumerate(self.path):
            is_collection = index % 2 == 0
            if is_collection:
                if part not in node:
                    return
                node = node[part]
            else:
                if part not in node:
                    return
                if index == len(self.path) - 1:
                    del node[part]
                    return
                entry = _ensure_doc_entry(node[part])
                node = entry["__subcollections__"]

    def collection(self, name):
        entry = self._doc_entry(create=True)
        if entry is None:
            return InMemoryCollection(self.store, self.path + [name])
        entry.setdefault("__subcollections__", {})
        return InMemoryCollection(self.store, self.path + [name])


class InMemoryCollection:
    def __init__(self, store, path):
        self.store = store
        self.path = path
        self._filters = []
        self._order_field = None
        self._order_direction = None
        self._limit_count = None

    def _collection_store(self, create: bool):
        node = self.store
        for index, part in enumerate(self.path):
            is_collection = index % 2 == 0
            if is_collection:
                if part not in node:
                    if not create:
                        return {}
                    node[part] = {}
                if index == len(self.path) - 1:
                    return node[part]
                node = node[part]
            else:
                entry = node.get(part)
                if entry is None:
                    if not create:
                        return {}
                    entry = {"__doc__": {}, "__subcollections__": {}}
                    node[part] = entry
                entry = _ensure_doc_entry(entry)
                node = entry["__subcollections__"]
        return {}

    def document(self, doc_id):
        return InMemoryDocument(self.store, self.path + [doc_id])

    def add(self, data, document_id=None):
        store = self._collection_store(create=True)
        doc_id = document_id or uuid.uuid4().hex
        entry = {"__doc__": _to_plain_dict(data), "__subcollections__": {}}
        store[doc_id] = entry
        return None, self.document(doc_id)

    # Simplified query helpers
    def where(self, field, op, value):
        new_collection = InMemoryCollection(self.store, self.path)
        new_collection._filters = self._filters + [(field, op, value)]
        new_collection._order_field = self._order_field
        new_collection._order_direction = self._order_direction
        new_collection._limit_count = self._limit_count
        return new_collection

    def order_by(self, field, direction=None):
        new_collection = InMemoryCollection(self.store, self.path)
        new_collection._filters = self._filters
        new_collection._order_field = field
        new_collection._order_direction = direction
        new_collection._limit_count = self._limit_count
        return new_collection

    def limit(self, count):
        new_collection = InMemoryCollection(self.store, self.path)
        new_collection._filters = self._filters
        new_collection._order_field = self._order_field
        new_collection._order_direction = self._order_direction
        new_collection._limit_count = count
        return new_collection

    def stream(self):
        store = self._collection_store(create=False)

        class Snap:
            def __init__(self, doc_id, entry):
                self.id = doc_id
                self._entry = entry

            def to_dict(self):
                if self._entry and "__doc__" in self._entry:
                    return dict(self._entry["__doc__"])
                return {}

        # Apply filters
        results = []
        for doc_id, entry in store.items():
            data = entry.get("__doc__", {})
            if self._apply_filters(data):
                results.append(Snap(doc_id, entry))

        # Apply ordering
        if self._order_field:
            reverse = False
            direction = self._order_direction

            if isinstance(direction, str):
                reverse = direction.upper() == "DESCENDING"
            elif direction is not None:
                reverse = (
                    getattr(direction, "name", "").upper() == "DESCENDING"
                    or direction == getattr(Query, "DESCENDING", None)
                    or direction == getattr(getattr(firestore, "Query", object), "DESCENDING", None)
                )

            def _normalize_order_value(value):
                if value is None:
                    return (4, "")

                if isinstance(value, datetime):
                    return (0, value.timestamp())

                if isinstance(value, (int, float)):
                    return (1, float(value))

                iso_formatter = getattr(value, "isoformat", None)
                if callable(iso_formatter):
                    try:
                        return (2, iso_formatter())
                    except Exception:  # pragma: no cover - defensive fallback
                        pass

                return (3, str(value))

            results.sort(
                key=lambda x: _normalize_order_value(x.to_dict().get(self._order_field)),
                reverse=reverse,
            )

        # Apply limit
        if self._limit_count:
            results = results[: self._limit_count]

        return results

    def _resolve_field_value(self, data, field):
        if hasattr(field, "to_api_repr"):
            try:
                field = field.to_api_repr()
            except Exception:  # pragma: no cover - defensive
                field = str(field)

        if isinstance(field, (list, tuple)):
            parts = list(field)
        else:
            parts = str(field).split(".") if isinstance(field, str) else [field]

        current = data
        for part in parts:
            if isinstance(current, dict):
                current = current.get(part)
            else:
                return None
        return current

    def _apply_filters(self, data):
        for field, op, value in self._filters:
            normalized_op = op
            if isinstance(op, str):
                normalized_op = op.lower().replace("-", "_")

            field_value = self._resolve_field_value(data, field)

            if normalized_op == "==":
                if field_value != value:
                    return False
            elif normalized_op == "!=":
                if field_value == value:
                    return False
            elif normalized_op == ">":
                if field_value is None or field_value <= value:
                    return False
            elif normalized_op == ">=":
                if field_value is None or field_value < value:
                    return False
            elif normalized_op == "<":
                if field_value is None or field_value >= value:
                    return False
            elif normalized_op == "<=":
                if field_value is None or field_value > value:
                    return False
            elif normalized_op == "array_contains":
                if not isinstance(field_value, list) or value not in field_value:
                    return False
            elif normalized_op == "array_contains_any":
                if not isinstance(field_value, list):
                    return False
                try:
                    candidates = list(value)
                except TypeError:
                    return False
                if not any(candidate in field_value for candidate in candidates):
                    return False
            elif normalized_op == "in":
                try:
                    candidates = list(value)
                except TypeError:
                    return False
                if field_value not in candidates:
                    return False
            elif normalized_op == "not_in":
                try:
                    candidates = list(value)
                except TypeError:
                    candidates = []
                if field_value in candidates:
                    return False
        return True


class Query:
    DESCENDING = "DESCENDING"
    ASCENDING = "ASCENDING"


class InMemoryFirestore:
    def __init__(self):
        self.store = {}
        self.Query = Query

    def collection(self, name):
        return InMemoryCollection(self.store, [name])


__all__ = ["db", "InMemoryFirestore", "initialize_firestore"]


def initialize_firestore():
    env_project = os.environ.get("FIREBASE_PROJECT_ID")
    try:
        if cred_path and Path(cred_path).exists():
            with open(cred_path) as f:
                cred_data = json.load(f)
            if not cred_data.get("project_id"):
                env_project = os.environ.get("FIREBASE_PROJECT_ID")
                if env_project:
                    cred_data["project_id"] = env_project
            if not cred_data.get("client_email"):
                env_email = os.environ.get("FIREBASE_CLIENT_EMAIL")
                if env_email:
                    cred_data["client_email"] = env_email
            cred = credentials.Certificate(cred_data)
            if not firebase_admin._apps:
                print(f"🟩 Clé Firebase utilisée : {cred_path}")

                firebase_admin.initialize_app(cred)
            logger.info("Initialized Firestore with provided credentials")
            return firestore.client()
        raise FileNotFoundError("Credential file not found")
    except Exception as e:
        logger.error(f"Failed to initialize Firestore: {e}")
        if not firebase_admin._apps and env_project:
            try:
                firebase_admin.initialize_app(options={"projectId": env_project})
                logger.warning(
                    "Initialized Firebase app with project_id=%s", env_project
                )  # ✅ FIXED token/projectId/trace
                return firestore.client()
            except Exception as init_exc:
                logger.error(
                    "Failed to initialize Firebase app with project ID: %s",
                    init_exc,
                )
        if not firebase_admin._apps:
            logger.warning(
                "No Firebase credentials found and FIREBASE_PROJECT_ID not set"
            )
        return InMemoryFirestore()


db = InMemoryFirestore()
