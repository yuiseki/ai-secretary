#!/usr/bin/env bash
set -euo pipefail

SESSION_NAME="${SESSION_NAME:-opencode-llama-qwen35a3b-moe18}"
PORT="${PORT:-18091}"
HOST="${HOST:-127.0.0.1}"

MODEL_PATH="/data/models/unsloth/Qwen3.6-35B-A3B-GGUF/Qwen3.6-35B-A3B-UD-IQ4_XS.gguf"
LLAMA_SERVER_BIN="/Workspaces/repos/_yuiseki/_fork/llama.cpp/build/bin/llama-server"
LOG_PATH="/tmp/${SESSION_NAME}.log"

if ! command -v tmux >/dev/null 2>&1; then
  echo "tmux is required" >&2
  exit 1
fi

if [ ! -x "${LLAMA_SERVER_BIN}" ]; then
  echo "llama-server binary not found: ${LLAMA_SERVER_BIN}" >&2
  exit 1
fi

if [ ! -f "${MODEL_PATH}" ]; then
  echo "model file not found: ${MODEL_PATH}" >&2
  exit 1
fi

if tmux has-session -t "${SESSION_NAME}" 2>/dev/null; then
  echo "tmux session already exists: ${SESSION_NAME}"
  echo "log: ${LOG_PATH}"
  exit 0
fi

CMD=$(cat <<EOF
${LLAMA_SERVER_BIN} \
  -m ${MODEL_PATH} \
  -ngl 999 \
  -ncmoe 18 \
  -c 131072 \
  -np 1 \
  -fa on \
  -ctk q8_0 \
  -ctv q8_0 \
  -t 9 \
  --reasoning off \
  --host ${HOST} \
  --port ${PORT} \
  > ${LOG_PATH} 2>&1
EOF
)

tmux new-session -d -s "${SESSION_NAME}" "bash -lc '${CMD}'"
echo "started tmux session: ${SESSION_NAME}"
echo "endpoint: http://${HOST}:${PORT}/v1"
echo "log: ${LOG_PATH}"
