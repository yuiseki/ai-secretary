# IronClaw

## Quick facts
- Memory is modeled as a DB-backed virtual filesystem (`Workspace`) with path-based docs.
- Core tools: `memory_search`, `memory_write`, `memory_read`, `memory_tree`.
- Hybrid retrieval uses PostgreSQL FTS + pgvector cosine similarity fused by Reciprocal Rank Fusion (RRF).

## Storage model
- `memory_documents`: path/content/metadata timestamps.
- `memory_chunks`: chunked document pieces + optional vector embeddings.
- Well-known paths include `MEMORY.md`, `HEARTBEAT.md`, identity files, `daily/YYYY-MM-DD.md`.
- Migration `V9__flexible_embedding_dimension.sql` switches embeddings to variable vector dimension (drops fixed-dim ANN index).

## Write path
- `memory_write` maps targets (`memory`, `daily_log`, `heartbeat`, custom path) to workspace writes/appends.
- Every write triggers `reindex_document`: chunk -> delete old chunks -> insert new chunks (+ embeddings when provider configured).
- Identity files are protected from tool writes to reduce prompt-poisoning persistence risk.

## Read path
- `memory_search` performs workspace hybrid search and returns scored snippets with source ids.
- `memory_read` fetches full document content by path.
- `system_prompt` loads identity docs + recent daily logs (today/yesterday).

## Retrieval algorithm
- FTS path: PostgreSQL `ts_rank_cd` over `content_tsv`.
- Vector path: pgvector cosine distance (`embedding <=> query_embedding`).
- Fusion path: reciprocal rank fusion (RRF) + optional min score threshold.

## Notable ideas
- Treating memory as filesystem-like docs makes structure composable and transparent.
- DB-backed storage still keeps markdown-style user mental model.
- Flexible embedding dimension enables mixed providers/models (e.g., OpenAI, Ollama).
- Seeding of identity/memory files ensures predictable bootstrapping.

## 留意点
- After variable-dim migration, no ANN index means exact search may degrade at scale.
- Write-time reindex cost can be high for large documents.
- `memory_search` の利用強制度合いはエージェント側プロンプト設計に依存するため、運用時の確認が必要。
