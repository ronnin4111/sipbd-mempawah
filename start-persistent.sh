#!/bin/bash
# Double-fork to fully detach from parent
cd /home/z/my-project

(
  while true; do
    echo "[Restart] Starting server at $(date)" >> /home/z/my-project/dev.log
    node node_modules/.bin/next dev -p 3000 >> /home/z/my-project/dev.log 2>&1
    echo "[Restart] Server exited at $(date), restarting in 3s..." >> /home/z/my-project/dev.log
    sleep 3
  done
) &

# Disown the background job
disown -a
echo "Daemon started, PID: $!"
