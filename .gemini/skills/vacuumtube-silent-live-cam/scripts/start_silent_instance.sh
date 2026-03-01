#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: start_silent_instance.sh [options]

Start (or restart) a silent 2nd VacuumTube instance in tmux using a cloned profile.

Options:
  --session NAME        tmux session name (default: vacuumtube-bg-2)
  --port PORT           CDP port for the silent instance (default: 9993)
  --sink NAME           PulseAudio/PipeWire null sink name (default: vacuumtube_silent)
  --display VALUE       DISPLAY value (default: auto; detects :0/:1/:2)
  --instance-dir PATH   Instance working directory (default: ~/.cache/yuiclaw/vacuumtube-multi/instance2)
  --source-profile PATH Source VacuumTube profile dir (default: ~/.config/VacuumTube)
  --no-clone-refresh    Skip rsync refresh of cloned profile
  --wait-sec N          Seconds to wait for CDP ready (default: 20)
  -h, --help            Show this help
USAGE
}

SESSION="vacuumtube-bg-2"
PORT="9993"
SINK_NAME="vacuumtube_silent"
DISPLAY_VALUE="auto"
INSTANCE_DIR="${HOME}/.cache/yuiclaw/vacuumtube-multi/instance2"
SOURCE_PROFILE="${HOME}/.config/VacuumTube"
WAIT_SEC=20
CLONE_REFRESH=1
XAUTHORITY_PATH="${HOME}/.Xauthority"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --session)
      SESSION="$2"; shift 2 ;;
    --port)
      PORT="$2"; shift 2 ;;
    --sink)
      SINK_NAME="$2"; shift 2 ;;
    --display)
      DISPLAY_VALUE="$2"; shift 2 ;;
    --instance-dir)
      INSTANCE_DIR="$2"; shift 2 ;;
    --source-profile)
      SOURCE_PROFILE="$2"; shift 2 ;;
    --wait-sec)
      WAIT_SEC="$2"; shift 2 ;;
    --no-clone-refresh)
      CLONE_REFRESH=0; shift ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2 ;;
  esac
done

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Required command not found: $1" >&2
    exit 1
  }
}

require_cmd tmux
require_cmd curl
require_cmd jq
require_cmd pactl
require_cmd rsync
require_cmd xdpyinfo

if [[ ! -x "${HOME}/vacuumtube.sh" ]]; then
  echo "Missing executable: ${HOME}/vacuumtube.sh" >&2
  exit 1
fi

if [[ ! -d "$SOURCE_PROFILE" ]]; then
  echo "Source profile directory not found: $SOURCE_PROFILE" >&2
  exit 1
fi

if [[ "$DISPLAY_VALUE" == "auto" ]]; then
  for d in :0 :1 :2; do
    if DISPLAY="$d" XAUTHORITY="$XAUTHORITY_PATH" xdpyinfo >/dev/null 2>&1; then
      DISPLAY_VALUE="$d"
      break
    fi
  done
  if [[ "$DISPLAY_VALUE" == "auto" ]]; then
    echo "Failed to detect usable DISPLAY (:0/:1/:2)" >&2
    exit 1
  fi
fi

if [[ ! -f "$XAUTHORITY_PATH" ]]; then
  echo "XAUTHORITY file not found: $XAUTHORITY_PATH" >&2
  exit 1
fi

INSTANCE_DIR="${INSTANCE_DIR/#\~/$HOME}"
SOURCE_PROFILE="${SOURCE_PROFILE/#\~/$HOME}"
CLONE_DIR="${INSTANCE_DIR}/user-data-clone"
XDG_CONFIG_HOME_DIR="${INSTANCE_DIR}/xdg-config"
XDG_VACUUMTUBE_DIR="${XDG_CONFIG_HOME_DIR}/VacuumTube"
CLONE_FLAGS_FILE="${CLONE_DIR}/flags.txt"
XDG_FLAGS_FILE="${XDG_VACUUMTUBE_DIR}/flags.txt"

ensure_null_sink() {
  if ! pactl list short sinks | awk '{print $2}' | grep -Fxq "$SINK_NAME"; then
    pactl load-module module-null-sink "sink_name=${SINK_NAME}" \
      "sink_properties=device.description=VacuumTubeSilent" >/dev/null
  fi
  pactl set-sink-mute "$SINK_NAME" 1 >/dev/null 2>&1 || true
}

refresh_clone() {
  mkdir -p "$CLONE_DIR"
  if [[ "$CLONE_REFRESH" == "1" ]]; then
    rsync -a --delete \
      --exclude 'Singleton*' \
      --exclude '*.lock' \
      --exclude 'LOCK' \
      --exclude 'LOCK-journal' \
      --exclude 'Session Storage/LOCK' \
      "$SOURCE_PROFILE/" "$CLONE_DIR/"
  fi
}

set_remote_debug_port_flag() {
  local file="$1"
  mkdir -p "$(dirname "$file")"
  touch "$file"
  local tmp
  tmp="$(mktemp)"
  grep -v '^--remote-debugging-port=' "$file" >"$tmp" || true
  printf '%s\n' "--remote-debugging-port=${PORT}" >>"$tmp"
  mv "$tmp" "$file"
}

start_tmux_instance() {
  local inner_cmd
  printf -v inner_cmd "%s" \
    "export VACUUMTUBE_DISPLAY=$(printf '%q' "$DISPLAY_VALUE"); \
export XAUTHORITY=$(printf '%q' "$XAUTHORITY_PATH"); \
export VACUUMTUBE_REMOTE_DEBUG_PORT=$(printf '%q' "$PORT"); \
export XDG_CONFIG_HOME=$(printf '%q' "$XDG_CONFIG_HOME_DIR"); \
export PULSE_SINK=$(printf '%q' "$SINK_NAME"); \
pactl set-sink-mute $(printf '%q' "$SINK_NAME") 1 >/dev/null 2>&1 || true; \
exec ~/vacuumtube.sh --user-data-dir=$(printf '%q' "$CLONE_DIR") --remote-debugging-port=$(printf '%q' "$PORT")"

  tmux kill-session -t "$SESSION" 2>/dev/null || true
  tmux new-session -d -s "$SESSION" "bash -lc '$inner_cmd'"
}

wait_for_cdp() {
  local url="http://127.0.0.1:${PORT}/json/version"
  local i
  for ((i=0; i<WAIT_SEC; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

ensure_null_sink
refresh_clone
set_remote_debug_port_flag "$CLONE_FLAGS_FILE"
set_remote_debug_port_flag "$XDG_FLAGS_FILE"
start_tmux_instance

if ! wait_for_cdp; then
  echo "CDP not ready on :${PORT}" >&2
  tmux capture-pane -pt "${SESSION}:0" -S -120 || true
  exit 1
fi

echo "session=${SESSION}"
echo "display=${DISPLAY_VALUE}"
echo "port=${PORT}"
echo "sink=${SINK_NAME}"
echo "clone_dir=${CLONE_DIR}"
echo "xdg_config_home=${XDG_CONFIG_HOME_DIR}"
echo "page_url=$(curl -fsS "http://127.0.0.1:${PORT}/json/list" | jq -r '.[] | select(.type=="page") | .url' | head -n1)"
echo "sink_mute=$(pactl get-sink-mute "$SINK_NAME" | sed 's/^Mute: //')"
