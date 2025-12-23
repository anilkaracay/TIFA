#!/bin/bash

echo "Stopping existing services..."

# Kill Frontend (Port 3000)
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
echo "Frontend stopped."

# Kill Backend (Port 4000)
lsof -ti:4000 | xargs kill -9 2>/dev/null || true
echo "Backend stopped."

# Kill Agent (Process matching 'agent/src/index.ts')
pkill -f "agent/src/index.ts" 2>/dev/null || true
# Also kill by generic npm run dev if it holds the agent
# This is tricky without ports. Let's assume the user will handle if it doesn't die.

echo "Starting Services..."

# Start Backend
cd backend
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend started (PID $BACKEND_PID)"
cd ..

# Start Agent
cd agent
npm run dev > ../agent.log 2>&1 &
AGENT_PID=$!
echo "Agent started (PID $AGENT_PID)"
cd ..

# Start Frontend
cd frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend started (PID $FRONTEND_PID)"
cd ..

echo "All services restarted in background."
echo "Logs are being written to backend.log, agent.log, frontend.log"
