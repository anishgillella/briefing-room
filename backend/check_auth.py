
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Load .env
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def check_user(email: str):
    print(f"Checking for user: {email}")
    result = supabase.table("recruiters").select("*").eq("email", email.lower()).execute()
    if result.data:
        user = result.data[0]
        print(f"✅ User found!")
        print(f"   ID: {user['id']}")
        print(f"   Name: {user['name']}")
        print(f"   Active: {user['is_active']}")
        password_hash = user.get('password_hash')
        print(f"   Has Password Hash: {'Yes' if password_hash else 'No'}")
        if password_hash:
            print(f"   Hash starts with: {password_hash[:10]}...")
            # Check length - bcrypt is 60 chars
            print(f"   Hash length: {len(password_hash)}")
    else:
        print(f"❌ User '{email}' NOT found in recruiters table.")
        
    # List all users for context
    print("\n--- All Recruiters ---")
    all_result = supabase.table("recruiters").select("name, email").execute()
    for r in all_result.data:
        print(f"- {r['name']} ({r['email']})")

if __name__ == "__main__":
    check_user("anish@gmail.com")
