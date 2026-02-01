from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict, Any
from services.job_architect import JobArchitect, Message, ArchitectResponse
from middleware.auth_middleware import get_current_user
from models.auth import CurrentUser

router = APIRouter(prefix="/api/job-architect", tags=["job-architect"])

class ChatRequest(BaseModel):
    history: List[Message]

class GenerateRequest(BaseModel):
    history: List[Message]

@router.post("/chat", response_model=ArchitectResponse)
async def chat(
    request: ChatRequest,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Process a turn in the Job Architect conversation.
    """
    architect = JobArchitect()
    try:
        response = await architect.chat(request.history)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate")
async def generate(
    request: GenerateRequest,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Generate the final Job Description from conversation history.
    """
    architect = JobArchitect()
    try:
        jd = await architect.generate_jd(request.history)
        return {"jd": jd}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
