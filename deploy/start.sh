#!/usr/bin/env bash
# Runs the built Parallax app in the background, so it survives your terminal closing.
#
#   deploy/start.sh         real generations (TREG_TOKEN in .env.local, with its daily budget)
#   deploy/start.sh mock    free sample files instead of real generations
#
# Build first: npm ci && npm run build
#
# Everything this script keeps lives in deploy/run/ (ignored by git):
#   data/          the database and the files people make
#   server.log     the log
#   env            optional extra settings, one NAME=value per line. A Hermes engine (below)
#                  answers nobody until this lists AGENT_ALLOWED_EMAILS=you@example.com
#   origin.txt     optional: the public https address, if the app sits behind a link or proxy
#   engine/        optional: run the agent chat on a Hermes agent (see docs/hermes-on-orgo.md)
#     hermes-api.key   the agent's API key
#     engine.token     the token the agent uses to call Parallax's tools
#     name.txt         the name members see (default: Hermes)
#     url.txt          where the agent's API is (default: this machine's end of tunnel.sh)
#     off              an empty file with this name turns the engine off
#
# PORT (default 3000) and BIND (default 127.0.0.1) can be set when calling the script. The
# default only answers this machine (put a proxy with https and sign-in in front). Set
# BIND=0.0.0.0 only if you mean to expose the port directly.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
RUN_DIR="$DEPLOY_DIR/run"
PORT="${PORT:-3000}"
BIND="${BIND:-127.0.0.1}"

if [ ! -d "$APP_DIR/.next" ]; then echo "not built yet: run npm ci && npm run build"; exit 1; fi
mkdir -p "$RUN_DIR"
"$DEPLOY_DIR/stop.sh" > /dev/null 2>&1 || true

# A clean environment: the only keys the server can see are the ones in .env.local and the
# files named below. AGENT_MODE stays mock unless deploy/run/env says otherwise, so
# the agent cannot start cloud computers or connect outside apps by accident. (deploy/run/env
# must use the AGENT_* names: an older SUPER_MODE line there no longer overrides this.)
vars=(
  "PATH=$PATH" "HOME=$HOME" "NODE_ENV=production"
  "PARALLAX_DATA_DIR=$RUN_DIR/data"
  "AGENT_MODE=mock"
)
if [ -s "$RUN_DIR/origin.txt" ]; then
  origin="$(tr -d ' \n\r' < "$RUN_DIR/origin.txt")"
  vars+=("PARALLAX_ORIGIN=$origin")
  case "$origin" in https://*) vars+=("COOKIE_SECURE=1") ;; esac
fi
if [ "${1:-}" = "mock" ]; then vars+=("TREG_MODE=mock"); fi

ENGINE_DIR="$RUN_DIR/engine"
engine="built-in"
if [ -s "$ENGINE_DIR/hermes-api.key" ] && [ -s "$ENGINE_DIR/engine.token" ] && [ ! -e "$ENGINE_DIR/off" ]; then
  url="http://127.0.0.1:18642"
  if [ -s "$ENGINE_DIR/url.txt" ]; then url="$(tr -d ' \n\r' < "$ENGINE_DIR/url.txt")"; fi
  name="Hermes"
  if [ -s "$ENGINE_DIR/name.txt" ]; then name="$(head -n 1 "$ENGINE_DIR/name.txt")"; fi
  vars+=(
    "AGENT_ENGINE=hermes" "HERMES_URL=$url" "AGENT_ENGINE_NAME=$name"
    "HERMES_API_KEY_FILE=$ENGINE_DIR/hermes-api.key"
    "AGENT_ENGINE_TOKEN_FILE=$ENGINE_DIR/engine.token"
  )
  engine="$name (Hermes)"
fi

# Extra settings last, so they can override the defaults above.
if [ -s "$RUN_DIR/env" ]; then
  while IFS= read -r line; do
    case "$line" in ''|'#'*) continue ;; *=*) vars+=("$line") ;; esac
  done < "$RUN_DIR/env"
fi

cd "$APP_DIR"
setsid nohup env -i "${vars[@]}" node node_modules/next/dist/bin/next start -H "$BIND" -p "$PORT" \
  >> "$RUN_DIR/server.log" 2>&1 < /dev/null &
echo $! > "$RUN_DIR/server.pid"
echo "started, pid $(cat "$RUN_DIR/server.pid"), port $PORT, mode ${1:-live}, chat engine: $engine"
