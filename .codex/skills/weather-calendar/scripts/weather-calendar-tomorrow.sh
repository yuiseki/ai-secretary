#!/usr/bin/env bash
set -euo pipefail

LAT="35.7126"
LON="139.7799"
ACCOUNT="yuiseki@gmail.com"
CAL_NAME="1 天気ログ"
ENV_FILE="/home/yuiseki/Workspaces/.env"

if [[ -f "$ENV_FILE" ]]; then
  # Skill runbook compatibility: load gog keyring password and related vars.
  export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

TOMORROW="$(date -d 'tomorrow' +%F)"

WEATHER_JSON="$(weathercli --lat "$LAT" --lon "$LON" --json)"
FORECAST_JSON="$(printf '%s' "$WEATHER_JSON" | jq -c --arg d "$TOMORROW" '.snapshot.forecast[] | select(.date == $d)' | head -n1)"

if [[ -z "$FORECAST_JSON" ]]; then
  echo "ERROR: forecast for $TOMORROW not found" >&2
  exit 1
fi

LABEL="$(printf '%s' "$FORECAST_JSON" | jq -r '.weatherLabel')"
MAX_C="$(printf '%s' "$FORECAST_JSON" | jq -r '.temperatureMaxC')"
MIN_C="$(printf '%s' "$FORECAST_JSON" | jq -r '.temperatureMinC')"
SUMMARY="${LABEL} | ${MIN_C}°C ～ ${MAX_C}°C"
DESCRIPTION="最高気温: ${MAX_C}°C / 最低気温: ${MIN_C}°C\n天候: ${LABEL}"

CAL_ID="$({ /home/yuiseki/bin/gog --account "$ACCOUNT" calendar calendars --json || true; } | sed -n '/^{/,$p' | jq -r --arg name "$CAL_NAME" '.calendars[] | select(.summary == $name) | .id' | head -n1)"

if [[ -z "$CAL_ID" ]]; then
  echo "ERROR: calendar '$CAL_NAME' not found" >&2
  exit 1
fi

if [[ "${DRY_RUN:-}" == "1" ]]; then
  printf 'DRY_RUN calendar=%s date=%s summary=%s\n' "$CAL_ID" "$TOMORROW" "$SUMMARY"
  exit 0
fi

/home/yuiseki/bin/gog --account "$ACCOUNT" calendar create "$CAL_ID" \
  --summary "$SUMMARY" \
  --description "$DESCRIPTION" \
  --from "$TOMORROW" --to "$TOMORROW" \
  --all-day --force
