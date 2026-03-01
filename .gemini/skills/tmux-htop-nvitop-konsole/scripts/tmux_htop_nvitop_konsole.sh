#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: tmux_htop_nvitop_konsole.sh [command] [options]

Reproduce a tmux system monitor layout (left: htop, right: nvitop) and attach in Konsole.

Commands:
  open        Ensure tmux layout exists, then open Konsole and attach (default)
  create      Ensure tmux layout exists (no Konsole)
  attach      Open Konsole and attach to existing session
  attach-cli  Attach in current terminal
  status      Show tmux pane layout/status for the session
  kill        Kill the tmux session

Options:
  --session NAME      tmux session name (default: sysmon)
  --window NAME       tmux window name (default: monitor)
  --recreate          Recreate session layout even if session already exists
  --display VALUE     DISPLAY value or 'auto' (default: auto)
  --xauthority PATH   XAUTHORITY path (default: ~/.Xauthority)
  --workdir PATH      Konsole initial working directory (default: current dir)
  --hold              Pass --hold to Konsole
  --profile NAME      Konsole profile name
  -h, --help          Show help

Environment overrides:
  HTOP_CMD            Command for left pane (default: htop)
  NVITOP_CMD          Command for right pane (default: nvitop)
  KONSOLE_CMD         Konsole executable (default: konsole)
EOF
}

COMMAND="open"
SESSION="${TMUX_MONITOR_SESSION:-sysmon}"
WINDOW_NAME="${TMUX_MONITOR_WINDOW:-monitor}"
RECREATE=0
DISPLAY_VALUE="${DISPLAY_VALUE:-auto}"
XAUTHORITY_PATH="${XAUTHORITY_PATH:-$HOME/.Xauthority}"
KONSOLE_WORKDIR="${PWD}"
KONSOLE_HOLD=0
KONSOLE_PROFILE=""
HTOP_CMD="${HTOP_CMD:-htop}"
NVITOP_CMD="${NVITOP_CMD:-nvitop}"
KONSOLE_BIN="${KONSOLE_CMD:-konsole}"
RESOLVED_DISPLAY=""

log() {
  printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"
}

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

shell_join() {
  local first=1
  local arg
  for arg in "$@"; do
    if [[ $first -eq 0 ]]; then
      printf ' '
    fi
    printf '%q' "$arg"
    first=0
  done
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    open|create|attach|attach-cli|status|kill)
      COMMAND="$1"
      shift
      ;;
    --session)
      SESSION="$2"; shift 2 ;;
    --window)
      WINDOW_NAME="$2"; shift 2 ;;
    --recreate)
      RECREATE=1; shift ;;
    --display)
      DISPLAY_VALUE="$2"; shift 2 ;;
    --xauthority)
      XAUTHORITY_PATH="$2"; shift 2 ;;
    --workdir)
      KONSOLE_WORKDIR="$2"; shift 2 ;;
    --hold)
      KONSOLE_HOLD=1; shift ;;
    --profile)
      KONSOLE_PROFILE="$2"; shift 2 ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      die "unknown argument: $1" ;;
  esac
done

tmux_has() {
  tmux has-session -t "$SESSION" 2>/dev/null
}

probe_display() {
  local d="$1"
  DISPLAY="$d" XAUTHORITY="$XAUTHORITY_PATH" xdpyinfo >/dev/null 2>&1
}

resolve_display() {
  if [[ -n "$RESOLVED_DISPLAY" ]]; then
    printf '%s\n' "$RESOLVED_DISPLAY"
    return 0
  fi
  if [[ "$DISPLAY_VALUE" != "auto" ]]; then
    RESOLVED_DISPLAY="$DISPLAY_VALUE"
    printf '%s\n' "$RESOLVED_DISPLAY"
    return 0
  fi
  local d
  for d in :0 :1 :2; do
    if probe_display "$d"; then
      RESOLVED_DISPLAY="$d"
      printf '%s\n' "$RESOLVED_DISPLAY"
      return 0
    fi
  done
  die "failed to detect DISPLAY (:0/:1/:2)"
}

require_base_commands() {
  require_cmd tmux
  case "$COMMAND" in
    open|create)
      require_cmd bash
      require_cmd "${HTOP_CMD%% *}"
      require_cmd "${NVITOP_CMD%% *}"
      ;;
  esac
  case "$COMMAND" in
    open|attach)
      require_cmd "$KONSOLE_BIN"
      require_cmd xdpyinfo
      ;;
  esac
}

create_layout() {
  local left_cmd right_cmd
  left_cmd="exec ${HTOP_CMD}"
  right_cmd="exec ${NVITOP_CMD}"

  if tmux_has; then
    if [[ "$RECREATE" -ne 1 ]]; then
      log "tmux session already exists (reuse): ${SESSION}"
      return 0
    fi
    log "recreating tmux session: ${SESSION}"
    tmux kill-session -t "$SESSION" >/dev/null 2>&1 || true
  fi

  log "creating tmux session: ${SESSION}"
  tmux new-session -d -s "$SESSION" -n "$WINDOW_NAME" "$(shell_join bash -lc "$left_cmd")"
  tmux split-window -h -t "${SESSION}:0" "$(shell_join bash -lc "$right_cmd")"
  tmux select-layout -t "${SESSION}:0" even-horizontal >/dev/null
  tmux set-option -t "$SESSION" mouse on >/dev/null 2>&1 || true
  tmux select-pane -t "${SESSION}:0.0" >/dev/null 2>&1 || true
}

show_status() {
  if ! tmux_has; then
    die "tmux session not found: ${SESSION}"
  fi
  printf 'session=%s\n' "$SESSION"
  printf 'window_layout=%s\n' "$(tmux display-message -p -t "$SESSION" '#{window_layout}')"
  tmux list-panes -t "$SESSION" -F 'pane=#{pane_index} cmd=#{pane_current_command} active=#{pane_active} x=#{pane_left} y=#{pane_top} w=#{pane_width} h=#{pane_height}'
}

konsole_dbus_service() {
  command -v qdbus >/dev/null 2>&1 || return 1
  qdbus | awk '/^ org\.kde\.konsole-[0-9]+$/{print $1; exit}'
}

konsole_dbus_latest_mainwindow() {
  local service="$1"
  qdbus "$service" | awk '/^\/konsole\/MainWindow_[0-9]+$/{print $1}' | sort -V | tail -n 1
}

konsole_dbus_ids() {
  local service="$1"
  local prefix="$2"
  qdbus "$service" | awk -v pfx="$prefix" 'index($1, pfx) == 1 { sub(pfx, "", $1); print $1 }' | sort -n
}

open_konsole_attach_via_dbus() {
  local d="$1"
  local service main before_windows new_window_id session_id attach_cmd
  local -a before_windows_arr=()
  local -a after_windows_arr=()

  service="$(konsole_dbus_service)" || return 1
  main="$(konsole_dbus_latest_mainwindow "$service")"
  [[ -n "$main" ]] || return 1

  mapfile -t before_windows_arr < <(konsole_dbus_ids "$service" "/Windows/")

  log "launching Konsole attach via DBus on ${d}: service=${service} action=new-window"
  (
    unset TMUX KONSOLE_DBUS_SERVICE KONSOLE_DBUS_SESSION KONSOLE_DBUS_WINDOW
    export DISPLAY="$d"
    if [[ -n "$XAUTHORITY_PATH" ]]; then
      export XAUTHORITY="$XAUTHORITY_PATH"
    fi
    qdbus "$service" "$main" org.kde.KMainWindow.activateAction new-window >/dev/null
  ) || return 1

  local tries id seen old_id
  for tries in {1..50}; do
    mapfile -t after_windows_arr < <(konsole_dbus_ids "$service" "/Windows/")
    new_window_id=""
    for id in "${after_windows_arr[@]}"; do
      seen=0
      for old_id in "${before_windows_arr[@]}"; do
        if [[ "$id" == "$old_id" ]]; then
          seen=1
          break
        fi
      done
      if [[ "$seen" -eq 0 ]]; then
        new_window_id="$id"
      fi
    done
    if [[ -n "$new_window_id" ]]; then
      break
    fi
    sleep 0.1
  done

  [[ "$new_window_id" =~ ^[0-9]+$ ]] || return 1
  session_id="$(qdbus "$service" "/Windows/${new_window_id}" org.kde.konsole.Window.currentSession 2>/dev/null || true)"
  [[ "$session_id" =~ ^[0-9]+$ ]] || return 1

  printf -v attach_cmd 'env -u TMUX tmux attach -t %q' "$SESSION"
  qdbus "$service" "/Sessions/${session_id}" org.kde.konsole.Session.runCommand "$attach_cmd" >/dev/null
}

open_konsole_attach() {
  if ! tmux_has; then
    die "tmux session not found: ${SESSION}"
  fi
  local d
  d="$(resolve_display)"
  if open_konsole_attach_via_dbus "$d"; then
    return 0
  fi

  local args=("$KONSOLE_BIN" "--separate")
  if [[ "$KONSOLE_HOLD" -eq 1 ]]; then
    args+=("--hold")
  fi
  if [[ -n "$KONSOLE_PROFILE" ]]; then
    args+=("--profile" "$KONSOLE_PROFILE")
  fi
  if [[ -n "$KONSOLE_WORKDIR" ]]; then
    args+=("--workdir" "$KONSOLE_WORKDIR")
  fi
  # Launch attach via a shell that clears inherited TMUX to avoid nested-session refusal.
  args+=("-e" "bash" "-lc" "unset TMUX; exec tmux attach -t $(printf '%q' "$SESSION")")

  local launcher=()
  if command -v dbus-run-session >/dev/null 2>&1; then
    launcher=("dbus-run-session" "--")
  fi

  log "launching Konsole attach on ${d}: $(shell_join "${launcher[@]}" "${args[@]}")"
  (
    # When invoked from inside Konsole/tmux, inherited env can cause tab reuse or nested tmux attach refusal.
    unset TMUX KONSOLE_DBUS_SERVICE KONSOLE_DBUS_SESSION KONSOLE_DBUS_WINDOW
    export DISPLAY="$d"
    if [[ -n "$XAUTHORITY_PATH" ]]; then
      export XAUTHORITY="$XAUTHORITY_PATH"
    fi
    nohup "${launcher[@]}" "${args[@]}" >/dev/null 2>&1 &
  )
}

attach_cli() {
  tmux attach -t "$SESSION"
}

kill_session() {
  if ! tmux_has; then
    log "tmux session already absent: ${SESSION}"
    return 0
  fi
  tmux kill-session -t "$SESSION"
  log "tmux session killed: ${SESSION}"
}

require_base_commands

case "$COMMAND" in
  open)
    create_layout
    open_konsole_attach
    ;;
  create)
    create_layout
    show_status
    ;;
  attach)
    open_konsole_attach
    ;;
  attach-cli)
    attach_cli
    ;;
  status)
    show_status
    ;;
  kill)
    kill_session
    ;;
  *)
    die "unsupported command: ${COMMAND}" ;;
esac
