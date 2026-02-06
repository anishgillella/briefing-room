# Setup Guide

## Prerequisites

- **Node.js 18+**
- **Python 3.12+**
- **Supabase Account** (for database)
- **API Keys**:
  - OpenRouter (LLM)
  - Vapi (Voice Agent)
  - Daily.co (Video)
  - OpenAI (for Realtime API if using simulations)

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/anishgillella/briefing-room.git
   cd briefing-room
   ```

2. **Backend Setup**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Frontend Setup**
   ```bash
   cd ../frontend
   npm install
   ```

## Environment Configuration

### Backend (`backend/.env`)
Create a `.env` file in the `backend` directory.

```env
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_role_key

# AI Services
OPENROUTER_API_KEY=your_openrouter_key
VAPI_PRIVATE_KEY=your_vapi_key
DAILY_API_KEY=your_daily_key
OPENAI_API_KEY=your_openai_key  # For Realtime API

# App Config
API_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
```

### Frontend (`frontend/.env.local`)
Create a `.env.local` file in the `frontend` directory.

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_VAPI_PUBLIC_KEY=your_vapi_public_key
```

## Running the Application

### Option 1: Separate Terminals

**Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```
*Backend will run at http://localhost:8000*

**Frontend:**
```bash
cd frontend
npm run dev
```
*Frontend will run at http://localhost:3000*

### Option 2: Docker (If configured)
*Coming soon*

## Verification
1. Open http://localhost:3000 in your browser.
2. Sign up/Login (if Auth is enabled).
3. Create a Job to test the database connection.
