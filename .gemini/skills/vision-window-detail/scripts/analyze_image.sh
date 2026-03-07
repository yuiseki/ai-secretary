#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 || $# -gt 3 ]]; then
  echo "Usage: $0 <image_path> <prompt> [model]" >&2
  exit 1
fi

IMAGE_PATH="$1"
PROMPT="$2"
MODEL="${3:-qwen3.5:4b}"
OLLAMA_URL="${OLLAMA_URL:-http://127.0.0.1:11434}"

if [[ ! -f "$IMAGE_PATH" ]]; then
  echo "Error: image not found: $IMAGE_PATH" >&2
  exit 2
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required" >&2
  exit 3
fi

PAYLOAD="$(
  base64 < "$IMAGE_PATH" \
    | tr -d '\n' \
    | jq -Rs \
      --arg model "$MODEL" \
      --arg prompt "$PROMPT" \
      '{
        model: $model,
        messages: [
          { role: "user", content: $prompt, images: [.] }
        ],
        stream: false,
        options: {
          think: false,
          temperature: 0.2
        }
      }'
)"

RESPONSE="$(
  printf '%s' "$PAYLOAD" \
    | curl -fsS "${OLLAMA_URL}/api/chat" \
      -H "Content-Type: application/json" \
      --data-binary @-
)"

echo "$RESPONSE" | jq -r '.message.content // .error // empty'
