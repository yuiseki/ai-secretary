# NanoBot

## Quick facts
- Very small, file-based two-layer memory design.
- No vector DB, no embedding pipeline, no external search service.
- Long-term + history separation is explicit.

## Storage model
- `workspace/memory/MEMORY.md`: durable facts/preferences (always loaded to system prompt).
- `workspace/memory/HISTORY.md`: append-only event summary log (not auto-loaded; searched via grep).

## Write path
- `MemoryStore.write_long_term` rewrites `MEMORY.md`.
- `MemoryStore.append_history` appends paragraphs to `HISTORY.md`.
- Agent loop periodically runs `_consolidate_memory` when session grows beyond `memory_window`.
- Consolidation prompts LLM to emit JSON with `history_entry` + `memory_update`; writes both files.

## Read path
- Context builder injects `MEMORY.md` as `# Memory` in system prompt.
- For episodic recall, prompt instructs agent to grep `HISTORY.md` using tool execution.
- Session manager still holds recent raw chat history separately.

## Retrieval algorithm
- Long-term: direct full-file injection (no ranking).
- Episodic: user-driven lexical retrieval (`grep`).
- Compaction: LLM-generated summary + extracted facts from old messages.

## Notable ideas
- Ultra-low complexity memory stack that is inspectable/editable by humans.
- Clear division: stable facts vs chronological breadcrumbs.
- Defensive JSON repair in consolidation step handles malformed model output.

## 留意点
- Full rewrite of `MEMORY.md` risks race/conflict under concurrent flows.
- No dedupe/score/ranking for long-term facts; quality depends on LLM consolidation prompt.
- Grep-only recall can miss semantic paraphrases.
