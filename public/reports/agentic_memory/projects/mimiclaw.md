# MimiClaw (mimiclaw)

## Quick facts
- ESP32/C implementation of OpenClaw-style personal assistant with file-backed memory on SPIFFS.
- Emphasizes low-resource persistence: markdown files + JSONL session logs.

## Storage model
- `MEMORY.md`: long-term memory.
- `memory/YYYY-MM-DD.md`: daily appended notes.
- `sessions/tg_<chat>.jsonl`: per-chat role/content/timestamp history.
- Additional persona/context files: `SOUL.md`, `USER.md`, `HEARTBEAT.md`.

## Write path
- `memory_write_long_term` overwrites `MEMORY.md`.
- `memory_append_today` appends line note into dated markdown (creates header when file is new).
- `session_append` appends JSONL message records.

## Read path
- `memory_read_long_term` reads `MEMORY.md`.
- `memory_read_recent(days)` concatenates recent daily files with separators.
- `session_get_history_json` returns recent ring-buffered conversation messages for agent loop context.

## Retrieval algorithm
- File/date based retrieval only; no embedding/vector index.
- Session recall uses bounded message window from JSONL ring reconstruction.

## Notable ideas
- Architecture tailored for constrained hardware: flat SPIFFS paths, fixed-size buffers, minimal dependencies.
- Keeps memory fully local and human-auditable.

## 留意点
- Buffer-size constraints and full-file reads may truncate or skip data as memory grows.
- Overwrite semantics on long-term file can lose updates.
- No semantic search; recall quality depends on explicit file structure and prompt instructions.
