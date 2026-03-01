#!/usr/bin/env bash
set -euo pipefail

DISPLAY_VALUE="${DISPLAY:-:0}"
DRY_RUN=false
LAUNCH_TIMEOUT_SEC=20

while [[ $# -gt 0 ]]; do
  case "$1" in
    --display)
      DISPLAY_VALUE="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --launch-timeout)
      LAUNCH_TIMEOUT_SEC="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      echo "Usage: $0 [--display :0] [--dry-run] [--launch-timeout SEC]" >&2
      exit 1
      ;;
  esac
done

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    exit 1
  fi
}

run_or_echo() {
  if [[ "$DRY_RUN" == "true" ]]; then
    printf '[dry-run] '
    printf '%q ' "$@"
    printf '\n'
    return 0
  fi
  "$@"
}

detect_screen_size() {
  local line
  line="$(env DISPLAY="$DISPLAY_VALUE" xrandr --current 2>/dev/null | awk '
    / connected primary / {
      split($4, a, "+")
      split(a[1], b, "x")
      print b[1], b[2]
      exit
    }
    / connected / {
      split($3, a, "+")
      split(a[1], b, "x")
      print b[1], b[2]
      exit
    }
  ')"
  if [[ -n "$line" ]]; then
    printf '%s\n' "$line"
    return 0
  fi

  line="$(env DISPLAY="$DISPLAY_VALUE" xdpyinfo 2>/dev/null | awk '/dimensions:/ { split($2, a, "x"); print a[1], a[2]; exit }')"
  if [[ -n "$line" ]]; then
    printf '%s\n' "$line"
    return 0
  fi

  echo "Failed to detect screen size on DISPLAY=$DISPLAY_VALUE" >&2
  exit 1
}

find_window_id_by_class() {
  local klass="$1"
  env DISPLAY="$DISPLAY_VALUE" wmctrl -lx 2>/dev/null | awk -v want="$klass" '$3 == want { print $1 }' | tail -n1
}

launch_desktop_file() {
  local desktop_path="$1"
  local desktop_id
  desktop_id="$(basename "$desktop_path")"

  if [[ "$DRY_RUN" == "true" ]]; then
    if command -v gio >/dev/null 2>&1; then
      printf '[dry-run] DISPLAY=%q gio launch %q\n' "$DISPLAY_VALUE" "$desktop_path"
      return 0
    fi
    if command -v gtk-launch >/dev/null 2>&1; then
      printf '[dry-run] DISPLAY=%q gtk-launch %q\n' "$DISPLAY_VALUE" "${desktop_id%.desktop}"
      return 0
    fi
    printf '[dry-run] DISPLAY=%q xdg-open %q\n' "$DISPLAY_VALUE" "$desktop_path"
    return 0
  fi

  if command -v gio >/dev/null 2>&1; then
    env DISPLAY="$DISPLAY_VALUE" gio launch "$desktop_path" >/dev/null 2>&1 &
    return 0
  fi
  if command -v gtk-launch >/dev/null 2>&1; then
    env DISPLAY="$DISPLAY_VALUE" gtk-launch "${desktop_id%.desktop}" >/dev/null 2>&1 &
    return 0
  fi
  env DISPLAY="$DISPLAY_VALUE" xdg-open "$desktop_path" >/dev/null 2>&1 &
}

wait_for_window_id() {
  local klass="$1"
  local timeout_sec="$2"
  local start_ts
  start_ts="$(date +%s)"
  while true; do
    local wid
    wid="$(find_window_id_by_class "$klass")"
    if [[ -n "$wid" ]]; then
      printf '%s\n' "$wid"
      return 0
    fi
    if (( "$(date +%s)" - start_ts >= timeout_sec )); then
      return 1
    fi
    sleep 1
  done
}

ensure_window_id() {
  local label="$1"
  local desktop_path="$2"
  local klass="$3"

  local wid
  wid="$(find_window_id_by_class "$klass")"
  if [[ -n "$wid" ]]; then
    printf '%s\n' "$wid"
    return 0
  fi

  if [[ ! -f "$desktop_path" ]]; then
    echo "Desktop shortcut not found for $label: $desktop_path" >&2
    exit 1
  fi

  echo "Launching $label via $desktop_path" >&2
  launch_desktop_file "$desktop_path"

  if [[ "$DRY_RUN" == "true" ]]; then
    printf 'dry-run-%s\n' "$label"
    return 0
  fi

  if ! wid="$(wait_for_window_id "$klass" "$LAUNCH_TIMEOUT_SEC")"; then
    echo "Timed out waiting for $label window ($klass)" >&2
    exit 1
  fi
  printf '%s\n' "$wid"
}

move_window() {
  local wid="$1"
  local x="$2"
  local y="$3"
  local w="$4"
  local h="$5"

  run_or_echo env DISPLAY="$DISPLAY_VALUE" wmctrl -i -r "$wid" -b remove,maximized_vert,maximized_horz
  run_or_echo env DISPLAY="$DISPLAY_VALUE" wmctrl -i -r "$wid" -b remove,fullscreen
  run_or_echo env DISPLAY="$DISPLAY_VALUE" wmctrl -i -r "$wid" -e "0,$x,$y,$w,$h"
  if [[ "$DRY_RUN" != "true" ]]; then
    sleep 0.2
  fi
  run_or_echo env DISPLAY="$DISPLAY_VALUE" wmctrl -i -r "$wid" -e "0,$x,$y,$w,$h"
}

restore_window_to_front() {
  local wid="$1"

  run_or_echo env DISPLAY="$DISPLAY_VALUE" wmctrl -i -r "$wid" -b remove,hidden
  run_or_echo env DISPLAY="$DISPLAY_VALUE" wmctrl -i -R "$wid"
}

require_cmd wmctrl
require_cmd xrandr
require_cmd xdpyinfo

DESKTOP_DIR="/home/yuiseki/.local/share/applications"

declare -a ORDERED_LABELS=(
  "yahoo-tenki"
  "tokyo-amesh"
  "tenki-jp"
)

declare -A DESKTOP_PATHS=(
  ["yahoo-tenki"]="${DESKTOP_DIR}/chrome-dfdpcjchnodkmgodjjpnmipjiemeejel-Default.desktop"
  ["tokyo-amesh"]="${DESKTOP_DIR}/chrome-lilfkepjfccihfhknkglhgbjcjejppjo-Default.desktop"
  ["tenki-jp"]="${DESKTOP_DIR}/chrome-blmpnkacpmoiiccofdmbahogbbdeblgp-Default.desktop"
)

declare -A WM_CLASSES=(
  ["yahoo-tenki"]="crx_dfdpcjchnodkmgodjjpnmipjiemeejel.Chromium"
  ["tokyo-amesh"]="crx_lilfkepjfccihfhknkglhgbjcjejppjo.Chromium"
  ["tenki-jp"]="crx_blmpnkacpmoiiccofdmbahogbbdeblgp.Chromium"
)

read -r SCREEN_W SCREEN_H <<<"$(detect_screen_size)"
HALF_W=$((SCREEN_W / 2))
HALF_H=$((SCREEN_H / 2))

# Match the current PWA layout: slight bleed beyond the screen edges to hide
# borders and keep the weather apps aligned with the existing desktop wall.
BLEED_X=16
TOP_BLEED_Y=10
BOTTOM_ROW_Y_OFFSET=59
TOP_ROW_HEIGHT_TRIM=7
BOTTOM_BLEED_Y=12

LEFT_X=$((-BLEED_X))
RIGHT_X=$((HALF_W - BLEED_X))
TOP_Y=$((-TOP_BLEED_Y))
BOTTOM_Y=$((HALF_H - BOTTOM_ROW_Y_OFFSET))
WINDOW_W=$((HALF_W + (BLEED_X * 2)))
TOP_H=$((HALF_H - TOP_ROW_HEIGHT_TRIM))
BOTTOM_H=$((SCREEN_H - BOTTOM_Y - BOTTOM_BLEED_Y))

if (( TOP_H < 100 || BOTTOM_H < 100 )); then
  echo "Computed invalid geometry for screen ${SCREEN_W}x${SCREEN_H}" >&2
  exit 1
fi

declare -A WINDOW_IDS
for label in "${ORDERED_LABELS[@]}"; do
  WINDOW_IDS["$label"]="$(ensure_window_id "$label" "${DESKTOP_PATHS[$label]}" "${WM_CLASSES[$label]}")"
done

echo "Arranging local weather monitor windows on DISPLAY=$DISPLAY_VALUE (${SCREEN_W}x${SCREEN_H})"

move_window "${WINDOW_IDS[yahoo-tenki]}" "$LEFT_X" "$TOP_Y" "$WINDOW_W" "$TOP_H"
move_window "${WINDOW_IDS[tokyo-amesh]}" "$LEFT_X" "$BOTTOM_Y" "$WINDOW_W" "$BOTTOM_H"
move_window "${WINDOW_IDS[tenki-jp]}" "$RIGHT_X" "$TOP_Y" "$WINDOW_W" "$TOP_H"

restore_window_to_front "${WINDOW_IDS[yahoo-tenki]}"
restore_window_to_front "${WINDOW_IDS[tokyo-amesh]}"
restore_window_to_front "${WINDOW_IDS[tenki-jp]}"

echo "Layout complete"
