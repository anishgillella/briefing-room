from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import rooms, realtime, analytics, coach, prebrief, pluto

app = FastAPI(
    title="Briefing Room API",
    description="Backend API for the Briefing Room interview preparation assistant",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "briefing-room-api"}


# Alias routes for original Pluto frontend compatibility
# (Pluto frontend uses /api/upload, /api/status, /api/results)
from routers.pluto import upload_csv, get_status, get_results
from fastapi import UploadFile, File, Form, BackgroundTasks

@app.post("/api/upload")
async def upload_alias(
    background_tasks: BackgroundTasks, 
    file: UploadFile = File(...),
    job_description: str = Form("")
):
    """Alias for /api/pluto/upload - original Pluto frontend compatibility"""
    return await upload_csv(background_tasks, file, job_description)

@app.get("/api/status")
async def status_alias():
    """Alias for /api/pluto/status - original Pluto frontend compatibility"""
    return await get_status()

@app.get("/api/results")
async def results_alias():
    """Alias for /api/pluto/results - original Pluto frontend compatibility"""
    return await get_results()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
