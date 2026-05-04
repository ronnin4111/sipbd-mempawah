#!/bin/bash
cd /home/z/my-project
while true; do
  echo "[Restart] Starting server at $(date)" >> /home/z/my-project/dev.log
  node node_modules/.bin/next dev -p 3000 >> /home/z/my-project/dev.log 2>&1
  echo "[Restart] Server crashed at $(date), restarting in 2s..." >> /home/z/my-project/dev.log
  sleep 2
done
