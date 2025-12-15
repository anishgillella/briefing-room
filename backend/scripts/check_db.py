
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from db.client import get_db

db = get_db()
if not db:
    print("❌ Failed to connect to DB")
    sys.exit(1)

print("\n--- 🔍 Checking Recent Interviews ---")
interviews = db.table("interviews").select("*").order("created_at", desc=True).limit(3).execute()
if interviews.data:
    for i in interviews.data:
        print(f"✅ Found Interview: {i['id']}")
        print(f"   Candidate: {i.get('candidate_id')}")
        print(f"   Interviewer: {i.get('interviewer_id')}")
        print(f"   Status: {i.get('status')}")
        print(f"   Created: {i.get('created_at')}")
        print("-" * 30)
else:
    print("❌ No interviews found.")

print("\n--- 🔍 Checking Recent Analytics ---")
analytics = db.table("interviewer_analytics").select("*").order("created_at", desc=True).limit(3).execute()
if analytics.data:
    for a in analytics.data:
        print(f"✅ Found Analytics: {a['id']}")
        print(f"   Interview ID: {a.get('interview_id')}")
        print(f"   Overall Score: {a.get('overall_score')}")
        print(f"   Created: {a.get('created_at')}")
        print("-" * 30)
else:
    print("❌ No analytics found.")
