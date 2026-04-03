
import os
import sys
import json
from pathlib import Path

# Manual .env loading
def load_env_manual():
    env_path = ".env"
    if not os.path.exists(env_path):
        return
        
    print(f"Loading env from {env_path}")
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip()
                if (value.startswith('"') and value.endswith('"')) or \
                   (value.startswith("'") and value.endswith("'")):
                    value = value[1:-1]
                os.environ[key] = value

load_env_manual()

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError as e:
    print(f"ImportError: {e}")
    print("Please install firebase-admin: pip install firebase-admin")
    sys.exit(1)

def init_firestore():
    if len(firebase_admin._apps) > 0:
        return firestore.client()

    # Priority 1: Check for local serviceAccountKey.json
    local_key_path = Path("serviceAccountKey.json")
    if local_key_path.exists():
        print(f"Found local key: {local_key_path.absolute()}")
        cred = credentials.Certificate(str(local_key_path))
        firebase_admin.initialize_app(cred)
        return firestore.client()
        
    print("No serviceAccountKey.json found, trying env...")

    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    cred = None
    
    json_payload = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if json_payload:
        try:
            cleaned = json_payload.strip().strip("'").strip('"')
            data = json.loads(cleaned)
            cred = credentials.Certificate(data)
            print("Using FIREBASE_SERVICE_ACCOUNT_JSON")
        except Exception as e:
            print(f"Error loading JSON credentials: {e}")

    if not cred and cred_path and os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        print(f"Using credentials file: {cred_path}")
    
    try:
        if cred:
            firebase_admin.initialize_app(cred)
        else:
            project_id = os.getenv("FIREBASE_PROJECT_ID")
            if project_id:
                firebase_admin.initialize_app(options={"projectId": project_id})
                print(f"Using projectId: {project_id}")
            else:
                print("No credentials found.")
                return None
        
        return firestore.client()
    except Exception as e:
        print(f"Failed to init firestore: {e}")
        return None

def diagnose():
    try:
        db = init_firestore()
    except Exception as e:
        print(f"Init failed: {e}")
        return

    if not db:
        print("DB init returned None")
        return

    print("\n--- Inspecting Teams Collection ---")
    teams_ref = db.collection("teams")
    
    # List first 10 teams to find variation
    try:
        docs = list(teams_ref.limit(10).stream())
    except Exception as e:
        print(f"Failed to list teams: {e}")
        return

    print(f"Found {len(docs)} teams.")
    
    sample_uid = None
    
    for doc in docs:
        data = doc.to_dict()
        print(f"\nTeam ID: {doc.id}")
        keys = list(data.keys())
        print(f"Keys: {keys}")
        
        members = data.get("members")
        print(f"members type: {type(members)}")
        if isinstance(members, list):
            print(f"members count: {len(members)}")
            if members:
                print(f"Sample member: {members[0]}")
                sample_uid = members[0]
        elif isinstance(members, dict):
             print(f"members (dict) count: {len(members)}")
             if members:
                 sample_uid = list(members.keys())[0]
        
        owner_uid = data.get("owner_uid") or data.get("ownerUid")
        print(f"owner_uid: {owner_uid}")
        if not sample_uid and owner_uid:
            sample_uid = owner_uid

        # Check subcollections if logic allows (skipped for speed/permission)

    if sample_uid:
        print(f"\n--- Testing Queries for UID: {sample_uid} ---")
        
        # Test 1: Array Contains
        print("Query: members array_contains UID")
        try:
            q = teams_ref.where("members", "array_contains", sample_uid)
            results = list(q.stream())
            print(f"Results: {len(results)}")
        except Exception as e:
            print(f"FAILED: {e}")

        # Test 2: Owner
        print("Query: owner_uid == UID")
        try:
            q = teams_ref.where("owner_uid", "==", sample_uid)
            results = list(q.stream())
            print(f"Results: {len(results)}")
        except Exception as e:
            print(f"FAILED: {e}")

        # Test 3: Collection Group (memberships)
        print("Query: collection_group('memberships').where('uid', '==', UID)")
        try:
            # Note: collection_group is on db, not col ref
            q = db.collection_group("memberships").where("uid", "==", sample_uid)
            results = list(q.stream())
            print(f"Results: {len(results)}")
        except Exception as e:
            print(f"FAILED (Index likely missing?): {e}")

        # Test 4: Collection Group (members) - as code tries both
        print("Query: collection_group('members').where('uid', '==', UID)")
        try:
            q = db.collection_group("members").where("uid", "==", sample_uid)
            results = list(q.stream())
            print(f"Results: {len(results)}")
        except Exception as e:
            print(f"FAILED (Index likely missing?): {e}")


if __name__ == "__main__":
    diagnose()
