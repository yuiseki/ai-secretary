#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/yuiseki/Workspaces"
ASEE_ROOT="${ROOT}/repos/asee"
ACAM_ROOT="${ROOT}/repos/acam"

STATUS_ONLY=0
DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --status-only) STATUS_ONLY=1 ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help)
      cat <<'EOF'
Usage: stop_asee_acam.sh [--status-only] [--dry-run]
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

detect_display() {
  if [[ -n "${DISPLAY:-}" ]] && DISPLAY="${DISPLAY}" XAUTHORITY="${HOME}/.Xauthority" xdpyinfo >/dev/null 2>&1; then
    printf '%s\n' "${DISPLAY}"
    return 0
  fi
  local d
  for d in :0 :1 :2; do
    if DISPLAY="${d}" XAUTHORITY="${HOME}/.Xauthority" xdpyinfo >/dev/null 2>&1; then
      printf '%s\n' "${d}"
      return 0
    fi
  done
  printf ':0\n'
}

DESKTOP_DISPLAY="$(detect_display)"
export DISPLAY="${DESKTOP_DISPLAY}"
export XAUTHORITY="${HOME}/.Xauthority"

run_cmd() {
  if [[ "${DRY_RUN}" == "1" ]]; then
    printf '[dry-run] %s\n' "$*"
    return 0
  fi
  "$@"
}

run_bash() {
  if [[ "${DRY_RUN}" == "1" ]]; then
    printf '[dry-run] %s\n' "$*"
    return 0
  fi
  bash -lc "$*"
}

show_status() {
  echo "DISPLAY=${DISPLAY}"
  echo
  echo "[processes]"
  ps -efww | rg -i 'asee\.video_server|repos/asee/electron|acam\.cli serve-webrtc|repos/acam/electron|asee_tmp_main|acam_tmp_main' || true
  echo
  echo "[tmux]"
  tmux ls 2>/dev/null | rg '(^asee-bg:|^acam-bg:)' || true
  echo
  echo "[windows]"
  DISPLAY="${DISPLAY}" XAUTHORITY="${XAUTHORITY}" wmctrl -l 2>/dev/null | rg 'ASEE Viewer|ACAM Viewer' || true
}

if [[ "${STATUS_ONLY}" == "1" ]]; then
  show_status
  exit 0
fi

echo "Stopping ASEE and ACAM using DISPLAY=${DISPLAY}"

# First, ask tmp_main to stop gracefully.
if [[ -x "${ASEE_ROOT}/tmp_main.sh" ]]; then
  run_bash "cd '${ASEE_ROOT}' && DISPLAY='${DISPLAY}' XAUTHORITY='${XAUTHORITY}' bash tmp_main.sh stop --port 8765 || true"
fi
if [[ -x "${ACAM_ROOT}/tmp_main.sh" ]]; then
  run_bash "cd '${ACAM_ROOT}' && DISPLAY='${DISPLAY}' XAUTHORITY='${XAUTHORITY}' bash tmp_main.sh stop --port 8875 || true"
fi

# Then stop the tmux sessions that normally own these processes.
run_cmd tmux kill-session -t asee-bg 2>/dev/null || true
run_cmd tmux kill-session -t acam-bg 2>/dev/null || true

# Finally, clean up any orphaned processes left behind.
run_bash "pkill -f 'python -m asee.video_server' 2>/dev/null || true"
run_bash "pkill -f 'python3 -m acam.cli serve-webrtc' 2>/dev/null || true"
run_bash "pkill -f '/tmp/asee_tmp_main_viewer_runner_8765.sh' 2>/dev/null || true"
run_bash "pkill -f '/tmp/acam_tmp_main_viewer_runner_8875.sh' 2>/dev/null || true"
run_bash "pkill -f '${ASEE_ROOT}/electron/node_modules/electron/dist/electron' 2>/dev/null || true"
run_bash "pkill -f '${ACAM_ROOT}/electron/node_modules/electron/dist/electron' 2>/dev/null || true"
run_bash "sleep 1"
run_bash "pkill -9 -f 'python -m asee.video_server' 2>/dev/null || true"
run_bash "pkill -9 -f 'python3 -m acam.cli serve-webrtc' 2>/dev/null || true"
run_bash "pkill -9 -f '/tmp/asee_tmp_main_viewer_runner_8765.sh' 2>/dev/null || true"
run_bash "pkill -9 -f '/tmp/acam_tmp_main_viewer_runner_8875.sh' 2>/dev/null || true"
run_bash "pkill -9 -f '${ASEE_ROOT}/electron/node_modules/electron/dist/electron' 2>/dev/null || true"
run_bash "pkill -9 -f '${ACAM_ROOT}/electron/node_modules/electron/dist/electron' 2>/dev/null || true"

echo
echo "Post-stop status:"
show_status
