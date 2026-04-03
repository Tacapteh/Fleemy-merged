from backend.firebase import InMemoryFirestore


def _collect_ids(stream):
    return {doc.id for doc in stream}


def test_array_contains_variants_support():
    db = InMemoryFirestore()
    teams = db.collection("teams")

    teams.document("team-a").set({"members": ["alice", "bob"]})
    teams.document("team-b").set({"members": ["carol"]})
    teams.document("team-c").set({"members": []})

    contains_alice = teams.where("members", "array_contains", "alice").stream()
    assert _collect_ids(contains_alice) == {"team-a"}

    contains_hyphen = teams.where("members", "array-contains", "carol").stream()
    assert _collect_ids(contains_hyphen) == {"team-b"}

    contains_any = teams.where(
        "members",
        "array-contains-any",
        ["bob", "carol"],
    ).stream()
    assert _collect_ids(contains_any) == {"team-a", "team-b"}


def test_in_and_not_in_filters():
    db = InMemoryFirestore()
    teams = db.collection("teams")

    teams.document("team-a").set({"owner": "alice"})
    teams.document("team-b").set({"owner": "bob"})
    teams.document("team-c").set({"owner": "carol"})

    owners = teams.where("owner", "in", ["alice", "carol"]).stream()
    assert _collect_ids(owners) == {"team-a", "team-c"}

    not_in = teams.where("owner", "not-in", ["bob"]).stream()
    assert _collect_ids(not_in) == {"team-a", "team-c"}
