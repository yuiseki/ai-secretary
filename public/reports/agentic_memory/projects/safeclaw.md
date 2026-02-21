# SafeClaw

## Quick facts
- Not an LLM-agentic semantic memory system; primarily a rule-based automation engine with persistent SQLite state.
- Memory is generalized app state: messages, preferences, reminders, webhooks, crawl cache, key-value, learned intent patterns.

## Storage model
- Single sqlite db with prepared statements (`messages`, `preferences`, `reminders`, `webhooks`, `crawl_cache`, `keyvalue`, `user_patterns`).
- WAL enabled; row_factory uses named column access.

## Write path
- Incoming commands are stored in `messages`.
- Action handlers update domain-specific tables (reminders, cache, preferences).
- Parser correction flow writes `user_patterns` to learn phrase->intent mappings.

## Read path
- Command parser can load and match learned user patterns.
- Engine/actions fetch recent history/preferences/reminders/cache entries as needed.

## Retrieval algorithm
- Mostly key-based or filter-based SQL retrieval; no embeddings, no semantic vector search.
- Pattern recall is exact + fuzzy matching in parser layer (rapidfuzz), not semantic memory retrieval.

## Notable ideas
- Strong SQL safety posture: predeclared prepared statements with named parameters.
- Memory is intentionally operational and deterministic (no model-dependent memory consolidation).

## 留意点
- If used as agentic memory comparison target, scope should be labeled clearly: state store, not contextual memory retrieval.
- No explicit long-term narrative memory artifacts like `MEMORY.md` or semantic recall.
