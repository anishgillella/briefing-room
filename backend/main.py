from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import rooms, realtime, analytics, coach, prebrief

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


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "briefing-room-api"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
