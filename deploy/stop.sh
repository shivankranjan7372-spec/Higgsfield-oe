#!/usr/bin/env bash
# Stops the Parallax server that deploy/start.sh started.
set -uo pipefail

RUN_DIR="$(cd "$(dirname "$0")" && pwd)/run"
PID_FILE="$RUN_DIR/server.pid"

if [ ! -s "$PID_FILE" ]; then echo "not running (no pid file)"; exit 0; fi
pid="$(cat "$PID_FILE")"
if kill -0 "$pid" 2> /dev/null; then
  # start.sh gives the server its own process group, so this takes any child with it.
  kill -TERM -- "-$pid" 2> /dev/null || kill -TERM "$pid" 2> /dev/null
  for _ in $(seq 1 50); do kill -0 "$pid" 2> /dev/null || break; sleep 0.1; done
  kill -0 "$pid" 2> /dev/null && kill -KILL -- "-$pid" 2> /dev/null
  echo "stopped pid $pid"
else
  echo "not running (pid $pid is gone)"
fi
rm -f "$PID_FILE"
