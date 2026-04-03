import pytest

from .. import server


class DummyDoc:
    def __init__(self, data=None, exists=True):
        self._data = data or {}
        self._exists = exists

    def to_dict(self):
        return self._data

    @property
    def exists(self):
        return self._exists


class DummyDocRef:
    def __init__(self, doc: DummyDoc):
        self._doc = doc

    def get(self):
        return self._doc

    def collection(self, name):  # pragma: no cover - defensive, top level docs only
        raise AttributeError(name)


class DummyCollection:
    def __init__(self, docs):
        self._docs = docs

    def document(self, doc_id):
        return DummyDocRef(self._docs.get(doc_id, DummyDoc(exists=False)))


class DummyTeamDocRef:
    def __init__(self, data, subcollections):
        self._doc = DummyDoc(data)
        self._collections = subcollections

    def get(self):
        return self._doc

    def collection(self, name):
        return DummyCollection(self._collections.get(name, {}))


class DummyRootCollection:
    def __init__(self, docs):
        self._docs = docs

    def document(self, doc_id):
        doc = self._docs.get(doc_id)
        if doc is None:
            raise KeyError(doc_id)
        return doc


class DummyDB:
    def __init__(self, teams):
        self._collections = {"teams": DummyRootCollection(teams)}

    def collection(self, name):
        if name not in self._collections:
            raise KeyError(name)
        return self._collections[name]


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio("asyncio")
async def test_ensure_team_membership_accepts_membership_document(monkeypatch):
    team_id = "team-123"
    user_uid = "user-1"

    team_doc = DummyTeamDocRef(
        data={"members": []},
        subcollections={
            "memberships": {user_uid: DummyDoc()},
            "members": {},
        },
    )

    dummy_db = DummyDB({team_id: team_doc})
    monkeypatch.setattr(server, "db", dummy_db)

    async def fake_to_thread(func, *args, **kwargs):
        return func(*args, **kwargs)

    monkeypatch.setattr(server.asyncio, "to_thread", fake_to_thread)

    team = await server.ensure_team_membership(team_id, user_uid)
    assert team == {"members": []}


@pytest.mark.anyio("asyncio")
async def test_ensure_team_membership_raises_without_any_membership(monkeypatch):
    team_id = "team-456"
    user_uid = "user-2"

    team_doc = DummyTeamDocRef(
        data={"members": []},
        subcollections={"memberships": {}, "members": {}},
    )

    dummy_db = DummyDB({team_id: team_doc})
    monkeypatch.setattr(server, "db", dummy_db)

    async def fake_to_thread(func, *args, **kwargs):
        return func(*args, **kwargs)

    monkeypatch.setattr(server.asyncio, "to_thread", fake_to_thread)

    with pytest.raises(server.HTTPException) as exc:
        await server.ensure_team_membership(team_id, user_uid)

    assert exc.value.status_code == 403
    assert "Not authorized" in exc.value.detail


@pytest.mark.anyio("asyncio")
async def test_ensure_team_membership_accepts_member_dicts(monkeypatch):
    team_id = "team-dicts"
    members_payload = [
        {"uid": "user-uid"},
        {"userId": "user-alt"},
        {"memberId": "user-member"},
        {"legacy-user": True},
    ]

    team_doc = DummyTeamDocRef(
        data={"members": members_payload},
        subcollections={"memberships": {}, "members": {}},
    )

    dummy_db = DummyDB({team_id: team_doc})
    monkeypatch.setattr(server, "db", dummy_db)

    async def fake_to_thread(func, *args, **kwargs):
        return func(*args, **kwargs)

    monkeypatch.setattr(server.asyncio, "to_thread", fake_to_thread)

    for uid in ("user-uid", "user-alt", "user-member", "legacy-user"):
        team = await server.ensure_team_membership(team_id, uid)
        assert team == {"members": members_payload}
