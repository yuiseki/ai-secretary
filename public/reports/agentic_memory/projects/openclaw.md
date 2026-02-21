# OpenClaw

## Quick facts
- Memory tool surface is pluginized; default `memory-core` provides `memory_search` + `memory_get`.
- Source of truth is Markdown files in workspace (`MEMORY.md`, `memory/*.md`), then indexed into sqlite for retrieval.
- Optional backend switch: builtin sqlite indexer or QMD sidecar (`memory.backend = qmd`).
- Additional experimental plugin `memory-lancedb` exists (tool names `memory_store/recall/forget`) with auto-capture/auto-recall hooks.

## Storage model
- Markdown truth: `MEMORY.md`, `memory/**/*.md`, optional extra paths.
- Builtin index db schema: `files`, `chunks`, `embedding_cache`, optional FTS table + optional sqlite-vec table.
- Builtin supports multi-source indexing: `memory` + optional `sessions` (JSONL transcripts normalized to User/Assistant text).
- QMD backend keeps markdown as truth and delegates retrieval/index refresh to `qmd` process with isolated XDG cache/config.

## Write path
- Direct memory writes are done by agent using filesystem tools (and optionally memory flush turn before compaction).
- Builtin watcher (`chokidar`) marks index dirty on markdown add/change/unlink; debounced sync reindexes changed files.
- Session transcript updates are tracked by delta thresholds (bytes/messages) before session reindex.
- Safe reindex strategy: rebuild on temp sqlite db -> seed embedding cache -> swap db files atomically.

## Read path
- `memory_search` resolves manager via backend config (`qmd` first with fallback wrapper, then builtin).
- `memory_get` enforces path constraints to memory files/additional whitelisted paths and returns empty text for missing files.
- `memory_search` can include citations (`Source: path#Lx`) depending on mode (`auto/on/off`).
- For QMD backend, search scope can be restricted by session channel/chat type/key-prefix rules.

## Retrieval algorithm
- Builtin:
  - FTS query (BM25 normalized) + vector cosine similarity.
  - Weighted merge (`vectorWeight`, `textWeight`).
  - Optional temporal decay (based on dated memory files or mtime).
  - Optional MMR rerank for diversity.
  - Fallback mode when embeddings unavailable: FTS-only.
- QMD:
  - Uses external `qmd search|vsearch|query --json`, collection-filtered.
  - Update loop runs `qmd update` and periodic `qmd embed`.
  - Fallback to builtin on qmd failure.

## Notable ideas
- Pre-compaction memory flush: silent, model-triggered turn near token threshold to persist durable facts before compaction.
- Provider auto-selection and fallback for embeddings (local/openai/gemini/voyage).
- Embedding cache keyed by provider/model/provider-key/hash to avoid recomputation across syncs.
- Session transcript indexing redacts sensitive text before embedding.
- QMD path virtualization (`qmd/<collection>/<path>`) allows memory_get over non-workspace collections safely.

## 留意点
- Builtin `mmr` tokenization in JS seems ASCII-centric (`[a-z0-9_]`), may reduce diversity quality for CJK text.
- `memory-lancedb` plugin uses heuristic capture triggers and may miss high-value facts or overfit prompt style.
- 実運用で memory ファイルがどの程度の頻度で更新されるかは、プロンプト設計と運用ポリシーの実測確認が必要。
