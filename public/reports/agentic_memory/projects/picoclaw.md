# PicoClaw

## Quick facts
- Go reimplementation inspired by nanobot, with markdown memory and session summarization.
- Keeps memory architecture simple: curated long-term file + date-based daily logs.

## Storage model
- `memory/MEMORY.md` for long-term facts.
- `memory/YYYYMM/YYYYMMDD.md` for daily notes.
- Session manager separately stores conversation history + optional compressed summary.

## Write path
- `WriteLongTerm` overwrites `MEMORY.md`.
- `AppendToday` appends to today file, creating date header on first write.
- Agent loop supports summarization thresholds and compressed session summaries (separate from memory files).

## Read path
- Context builder injects memory context (`Long-term Memory` + recent 3 days of daily notes).
- Prior conversation summary can be included in prompt (`Summary of Previous Conversation`).

## Retrieval algorithm
- No semantic index in memory module.
- Retrieval is deterministic by file recency (`GetRecentDailyNotes(days)`) and raw inclusion.

## Notable ideas
- Recent-notes window (3 days) balances persistence and prompt size.
- Keeps markdown memory human-editable while using session summary for long chat continuity.

## 留意点
- Overwrite semantics for long-term file can lose concurrent edits.
- No search/ranking on memory content; relies on model reading injected text.
- prompt への一括注入以外のターゲット検索機構があるかは追加確認の余地がある。
