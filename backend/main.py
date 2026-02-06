from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import rooms, realtime, analytics, coach, prebrief, pluto, db_interviews, db_managers, db_interviewers, voice_ingest, offer_prep, vapi_interview
from routers import jobs as jobs_router  # Streamlined flow
from routers import dashboard as dashboard_router  # Phase 7 - Dashboard
from routers import recruiters as recruiters_router  # Recruiter management
from routers import auth as auth_router  # Authentication
from routers import persons as persons_router  # Talent Pool
from routers import scheduling as scheduling_router  # Interview scheduling
from routers import job_architect
from routers import public as public_router  # Public career pages
from typing import Annotated, Optional

app = FastAPI(
    title="Briefing Room API",
    description="Backend API for the Briefing Room interview preparation assistant",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(rooms.router, prefix="/api")
app.include_router(realtime.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(coach.router, prefix="/api")
app.include_router(prebrief.router, prefix="/api")
app.include_router(pluto.router, prefix="/api")

app.include_router(db_interviews.router)  # Multi-stage interview routes
app.include_router(db_managers.router)    # Manager dashboard routes
app.include_router(db_interviewers.router)  # Interviewer analytics routes
app.include_router(voice_ingest.router)   # Voice ingest onboarding routes
app.include_router(vapi_interview.router) # Vapi Candidate Interview routes
app.include_router(offer_prep.router)     # Offer preparation and coaching routes
app.include_router(jobs_router.router)    # Streamlined flow - job management
app.include_router(dashboard_router.router)  # Phase 7 - Recruiter dashboard
app.include_router(recruiters_router.router)  # Recruiter management
app.include_router(auth_router.router)  # Authentication routes
app.include_router(persons_router.router)  # Talent Pool
app.include_router(scheduling_router.router)  # Interview scheduling
app.include_router(job_architect.router)      # AI Job Architect
app.include_router(public_router.router)      # Public career pages


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "briefing-room-api"}





if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
