
import os
import bcrypt
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime

# Load .env
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def reset_password(email: str, new_password: str):
    print(f"Resetting password for: {email}")
    
    # 1. Check if user exists
    result = supabase.table("recruiters").select("id").eq("email", email.lower()).execute()
    if not result.data:
        print(f"❌ User '{email}' NOT found.")
        return

    user_id = result.data[0]['id']
    
    # 2. Hash new password
    password_hash = hash_password(new_password)
    
    # 3. Update in Supabase
    update_data = {
        "password_hash": password_hash,
        "updated_at": datetime.utcnow().isoformat()
    }
    
    try:
        supabase.table("recruiters").update(update_data).eq("id", user_id).execute()
        print(f"✅ Password successfully reset for {email}")
        print(f"   New Password: {new_password}")
    except Exception as e:
        print(f"❌ Failed to update password: {e}")

if __name__ == "__main__":
    # User specified anish@gmail.con - likely a typo, using .com as verified earlier
    # If they truly meant .con, this will report not found.
    reset_password("anish@gmail.com", "anish123")
