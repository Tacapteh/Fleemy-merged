
import firebase_admin
from firebase_admin import credentials, firestore
import os

# Setup creds
cred_path = "backend/serviceAccountKey.json"
if os.path.exists(cred_path):
    print(f"Loading creds from {cred_path}")
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)
else:
    print("No credential file found!")
    exit(1)

db = firestore.client()

def list_all_teams():
    print("\n--- Listing All Teams (First 10) ---")
    teams_ref = db.collection("teams")
    docs = list(teams_ref.limit(10).stream())
    for doc in docs:
        data = doc.to_dict()
        print(f"Team ID: {doc.id}")
        print(f"  Name: {data.get('name')}")
        print(f"  Owner UID: {data.get('owner_uid')}")
        print(f"  Members (Array): {data.get('members')}")
        print(f"  Members (Map): {data.get('members', 'N/A') if isinstance(data.get('members'), dict) else 'N/A'}")
        
        # Check subcollections
        memberships = list(doc.reference.collection("memberships").stream())
        print(f"  Sub-collection 'memberships' count: {len(memberships)}")
        for m in memberships:
             print(f"    - Membership Doc ID: {m.id}, Data: {m.to_dict()}")

def test_queries_for_user(uid):
    print(f"\n--- Testing Queries for UID: {uid} ---")
    teams_ref = db.collection("teams")

    # 1. Array Contains
    print("Query: members array_contains UID")
    try:
        q1 = teams_ref.where("members", "array_contains", uid).stream()
        results = list(q1)
        print(f"  Found {len(results)} teams.")
    except Exception as e:
        print(f"  ERROR: {e}")

    # 2. Owner Query
    print("Query: owner_uid == UID")
    try:
        q2 = teams_ref.where("owner_uid", "==", uid).stream()
        results = list(q2)
        print(f"  Found {len(results)} teams.")
    except Exception as e:
        print(f"  ERROR: {e}")

    # 3. Collection Group
    print("Query: Collection Group 'memberships' where documentId == UID")
    try:
        # Note: In python admin sdk, filter by documentId might be different
        # Usually it's FIELD_PATH_DOCUMENT_ID
        docs = []
        # Attempt manual scan of a known team to simulate
        pass
    except Exception as e:
        print(f"  ERROR: {e}")

if __name__ == "__main__":
    list_all_teams()
    # You can update this UID with a known user UID from the output above
    # test_queries_for_user("SOME_UID")
