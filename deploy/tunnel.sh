#!/usr/bin/env bash
# A private pipe between Parallax (this machine) and the machine a Hermes agent runs on.
# Use it when the two are different machines. See docs/hermes-on-orgo.md.
#
#   deploy/tunnel.sh start     open it and keep it open
#   deploy/tunnel.sh stop      close it
#   deploy/tunnel.sh status    say whether each direction works (yes/no only)
#
# One SSH connection carries both directions:
#   Parallax -> agent   this machine's 127.0.0.1:18642  reaches the agent's API on its 127.0.0.1:8642
#   agent -> Parallax   the agent's 127.0.0.1:13100     reaches Parallax on this machine's 127.0.0.1:$APP_PORT
#
# Nothing is opened to the internet on either side. It needs deploy/run/engine/ssh.conf: an
# ssh config with a host named "agent" (HostName, Port, User, IdentityFile, UserKnownHostsFile).
# This script never prints an address.
set -uo pipefail

ENGINE_DIR="$(cd "$(dirname "$0")" && pwd)/run/engine"
CONF="$ENGINE_DIR/ssh.conf"
PID_FILE="$ENGINE_DIR/tunnel.pid"
LOG="$ENGINE_DIR/tunnel.log"
LOCAL_PORT="${LOCAL_PORT:-18642}"     # this machine -> the agent's API
REMOTE_PORT="${REMOTE_PORT:-13100}"   # the agent's machine -> Parallax
AGENT_PORT="${AGENT_PORT:-8642}"      # the Hermes API server's port
APP_PORT="${PORT:-3000}"              # the port Parallax listens on

running() { [ -s "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2> /dev/null; }

stop() {
  if running; then
    pid="$(cat "$PID_FILE")"
    kill -TERM -- "-$pid" 2> /dev/null || kill -TERM "$pid" 2> /dev/null
    for _ in $(seq 1 30); do kill -0 "$pid" 2> /dev/null || break; sleep 0.1; done
    kill -0 "$pid" 2> /dev/null && kill -KILL -- "-$pid" 2> /dev/null
    echo "tunnel stopped"
  else
    echo "tunnel not running"
  fi
  rm -f "$PID_FILE"
}

case "${1:-status}" in
  start)
    if [ ! -s "$CONF" ]; then echo "no $CONF yet: see docs/hermes-on-orgo.md"; exit 1; fi
    running && stop > /dev/null
    # Reconnects by itself. The log gets one line per attempt and no addresses.
    setsid nohup bash -c '
      while true; do
        echo "$(date -u +%FT%TZ) connecting" >> "$4"
        ssh -F "$0" -N -o LogLevel=ERROR -o ExitOnForwardFailure=yes \
          -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
          -L "127.0.0.1:$1:127.0.0.1:$2" -R "127.0.0.1:$3:127.0.0.1:$5" agent > /dev/null 2>&1
        echo "$(date -u +%FT%TZ) closed (exit $?)" >> "$4"
        sleep 5
      done
    ' "$CONF" "$LOCAL_PORT" "$AGENT_PORT" "$REMOTE_PORT" "$LOG" "$APP_PORT" > /dev/null 2>&1 < /dev/null &
    echo $! > "$PID_FILE"
    echo "tunnel started"
    ;;
  stop)
    stop
    ;;
  status)
    if running; then echo "tunnel process: yes"; else echo "tunnel process: no"; fi
    # The agent's API answers /health without a key.
    code="$(curl -s -o /dev/null -m 5 -w '%{http_code}' "http://127.0.0.1:$LOCAL_PORT/health" 2> /dev/null || true)"
    if [ "$code" = "200" ]; then echo "Parallax -> agent: yes"; else echo "Parallax -> agent: no"; fi
    if [ -s "$CONF" ] && running; then
      back="$(ssh -F "$CONF" -o LogLevel=ERROR -o ConnectTimeout=8 agent \
        "curl -s -o /dev/null -m 5 -w '%{http_code}' http://127.0.0.1:$REMOTE_PORT/api/auth/me" 2> /dev/null || true)"
      if [ "$back" = "200" ]; then echo "agent -> Parallax: yes"; else echo "agent -> Parallax: no"; fi
    else
      echo "agent -> Parallax: no"
    fi
    ;;
  *)
    echo "usage: tunnel.sh start|stop|status"
    exit 2
    ;;
esac
