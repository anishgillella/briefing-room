
import os
import sys
from dotenv import load_dotenv

# Load env vars
load_dotenv(".env.local")

from db.client import get_db

def check_person():
    print("Checking candidates for Job 71038136-8c6d-4dce-9474-ceab368e1d19...")
    
    # Import repo logic
    from repositories.streamlined.candidate_repo import CandidateRepository
    repo = CandidateRepository()
    candidates = repo.list_by_job_sync("71038136-8c6d-4dce-9474-ceab368e1d19")
    
    print(f"Found {len(candidates)} candidates.")
    for c in candidates[:10]:
        print(f"Name: {c.person_name} | Candidate ID: {c.id} | Person ID: {c.person_id}")

if __name__ == "__main__":
    check_person()
