# ZeroClaw

## Quick facts
- Trait-based memory abstraction (`Memory`) with swappable backends: sqlite/lucid/postgres/markdown/none.
- Memory tools are first-class (`memory_store`, `memory_recall`, `memory_forget`) and agent memory loader injects recalled context.
- Includes hygiene, snapshot/hydrate, and optional response cache as operational memory subsystems.

## Storage model
- SQLite backend (`memory/brain.db`): table `memories` + FTS5 virtual table + embedding cache.
- Markdown backend: `MEMORY.md` + `memory/YYYY-MM-DD.md` append model.
- Postgres backend: CRUD + keyword recall (no pgvector requirement for base functionality).
- Lucid backend: sqlite authoritative local store + external lucid CLI recall/store bridge.
- None backend: explicit no-op persistence.

## Write path
- `memory_store` tool validates category and writes via active backend.
- SQLite `store` does upsert by key, computes embedding (if provider enabled), updates FTS triggers.
- Lucid backend stores to local sqlite first, then async best-effort sync to lucid CLI.
- Hygiene can archive/purge old daily/session artifacts and prune conversation rows.
- Snapshot export can serialize core memories to `MEMORY_SNAPSHOT.md`; auto-hydrate repopulates sqlite on cold boot.

## Read path
- `memory_recall` tool calls backend recall, formats scored results.
- `DefaultMemoryLoader` injects recalled entries above `min_relevance_score` into prompt.
- Loader filters legacy assistant auto-save keys to avoid reinjecting model hallucinated summaries.

## Retrieval algorithm
- SQLite hybrid search:
  - FTS5 BM25 keyword results.
  - Vector cosine similarity scan over stored embeddings.
  - Weighted fusion (`vector_weight`, `keyword_weight`) in custom merge function.
  - Fallback LIKE search when hybrid results are empty.
- Markdown backend:
  - keyword contains-match scoring by matched term count.
- Postgres backend:
  - ILIKE-based scoring and recency sort.

## Notable ideas
- Strong operational lifecycle: hygiene cadence + snapshot/hydrate improves resilience on constrained devices.
- Embedding provider abstraction supports openai/openrouter/custom endpoints + no-op mode.
- Session-scoped memory entries are supported in trait API and sqlite schema.
- Memory behavior heavily tested (`memory_restart`, `memory_comparison`).

## 留意点
- SQLite vector search path currently does in-process full scan when no dedicated ANN index is used.
- Lucid bridge adds external-process failure modes; mitigated by cooldown + local fallback but still complex.
- OpenClaw/QMD 系と比較した大規模件数での性能評価は追加検証の余地がある。
