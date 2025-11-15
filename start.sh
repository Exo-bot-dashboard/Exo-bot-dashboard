#!/bin/bash
pkill -f "tsx server/index.ts" 2>/dev/null
sleep 1
nohup tsx server/index.ts > /tmp/server.log 2>&1 &
echo $! > /tmp/server.pid
sleep 5
if ps -p $(cat /tmp/server.pid) > /dev/null 2>&1; then
  echo "Server started successfully"
  curl -s http://localhost:5000/api/health
else
  echo "Failed to start"
  cat /tmp/server.log
fi
