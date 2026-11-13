#!/usr/bin/env bash
# Phase 1 baseline smoke: boot the game headless, fail on a fatal screen,
# save a screenshot and the DOM for inspection.
#
# Usage:
#   tools/smoke.sh
#   PORT=8733 tools/smoke.sh
#   BROWSER="/path/to/chrome" tools/smoke.sh
#   SMOKE_QUERY="?show=level&q=low" SMOKE_NAME=level tools/smoke.sh
#   SMOKE_BUDGET=45000 SMOKE_QUERY="?show=mats&q=low" SMOKE_NAME=mats tools/smoke.sh
#
# Artifacts go to artifacts/ and are gitignored.

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-8731}"
SERVE_DIR="${SERVE_DIR:-$ROOT}"
SMOKE_NAME="${SMOKE_NAME:-smoke}"
SMOKE_QUERY="${SMOKE_QUERY:-?q=low}"
SMOKE_REQUIRE_MENU="${SMOKE_REQUIRE_MENU:-1}"
SMOKE_BUDGET="${SMOKE_BUDGET:-25000}"
ART="$ROOT/artifacts"
PROFILE="$(mktemp -d)"
SERVER_PID=""

cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$PROFILE"
}
trap cleanup EXIT

die() {
  echo "FAIL: $*" >&2
  exit 1
}

mkdir -p "$ART"

if ! command -v python3 >/dev/null 2>&1; then
  die "python3 is required for the local server"
fi

if [[ -z "${BROWSER:-}" ]]; then
  candidates=(
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
  )
  for command in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge; do
    resolved="$(command -v "$command" 2>/dev/null || true)"
    [[ -n "$resolved" ]] && candidates+=("$resolved")
  done
  for candidate in "${candidates[@]}"; do
    if [[ -x "$candidate" ]]; then
      BROWSER="$candidate"
      break
    fi
  done
fi
[[ -n "${BROWSER:-}" ]] || die "no Chromium browser found; set BROWSER=/path/to/browser"

[[ -d "$SERVE_DIR" ]] || die "SERVE_DIR does not exist: $SERVE_DIR"
python3 -m http.server "$PORT" --directory "$SERVE_DIR" >"$ART/server-$SMOKE_NAME.log" 2>&1 &
SERVER_PID=$!
disown "$SERVER_PID" 2>/dev/null || true

for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then
    break
  fi
  sleep 0.3
done
curl -fsS "http://127.0.0.1:$PORT/" >/dev/null 2>&1 || die "server did not start on port $PORT"

set +e
"$BROWSER" \
  --headless=new \
  --no-sandbox \
  --disable-gpu-sandbox \
  --user-data-dir="$PROFILE" \
  --no-first-run \
  --disable-dev-shm-usage \
  --enable-unsafe-swiftshader \
  --use-angle=swiftshader \
  --hide-scrollbars \
  --window-size=1280,720 \
  --virtual-time-budget="$SMOKE_BUDGET" \
  --screenshot="$ART/$SMOKE_NAME.png" \
  --dump-dom \
  "http://127.0.0.1:$PORT/${SMOKE_QUERY}" \
  >"$ART/$SMOKE_NAME.html" 2>"$ART/$SMOKE_NAME.log"
STATUS=$?
set -e

# Edge/SwiftShader can segfault on exit (139) after writing valid artifacts.
if [[ $STATUS -ne 0 && $STATUS -ne 139 ]]; then
  die "browser exited with $STATUS; see artifacts/$SMOKE_NAME.log"
fi

[[ -s "$ART/$SMOKE_NAME.png" ]] || die "no screenshot; see artifacts/$SMOKE_NAME.log"
PNG_BYTES="$(wc -c <"$ART/$SMOKE_NAME.png" | tr -d ' ')"
[[ "$PNG_BYTES" -gt 50000 ]] || die "screenshot is too small (${PNG_BYTES} bytes)"

if grep -q '<div id="fatal">' "$ART/$SMOKE_NAME.html"; then
  die "fatal boot screen; see artifacts/$SMOKE_NAME.html"
fi

if [[ -s "$ART/$SMOKE_NAME.html" && "$SMOKE_REQUIRE_MENU" = "1" ]]; then
  grep -q '<div class="menu' "$ART/$SMOKE_NAME.html" || die "menu markup missing; see artifacts/$SMOKE_NAME.html"
else
  echo "WARN: DOM dump is empty; only the screenshot was checked" >&2
fi

if [[ $STATUS -eq 139 ]]; then
  echo "WARN: browser segfaulted on exit (139); artifacts are valid" >&2
fi

echo "OK: $ART/$SMOKE_NAME.png (${PNG_BYTES} bytes)"
