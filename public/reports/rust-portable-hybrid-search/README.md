# Rust Portable Hybrid Search DB Evaluation

Date: 2026-02-21  
Scope: local, standalone, serverless search stack for `amem`

## Goal

Select a DB/search foundation that satisfies:

1. Local standalone operation (no server required)
2. UTF-8 unigram inverted index support (phase 1 lexical baseline)
3. Vector search support
4. Strong Rust implementation fit

## Candidate Summary

| Candidate | Serverless | UTF-8 Unigram Path | Vector Search | Rust Fit | License | Verdict |
|---|---|---|---|---|---|---|
| SQLite + sqlite-vec | Yes | FTS5 custom tokenizer or app-side unigram indexing | Yes (`sqlite-vec`) | Excellent (`rusqlite`) | SQLite: Public Domain, sqlite-vec: MIT | **Best for v1** |
| LanceDB | Yes | Possible, but lexical internals are less transparent than SQLite path | Strong native vector focus | Good | Apache-2.0 | Strong 2nd option |
| DuckDB (+ fts + vss) | Yes | Works with preprocessing; raw JP tokenization is limited | Yes (`vss`, experimental) | Good | MIT | Useful, but higher risk for core |
| Tantivy | Yes (library) | Strong lexical tooling, easy tokenizer control | Not a full vector DB by default | Excellent | MIT | Great lexical engine, not single-store answer |

## Local Machine Verification

The following checks were run on this machine:

- `sqlite3` available and built with `ENABLE_FTS5`, `ENABLE_LOAD_EXTENSION`
- `duckdb` available
- DuckDB `fts` extension: install/load succeeded
- DuckDB `vss` extension: install/load succeeded
- DuckDB FTS with raw Japanese token (`東京`) did not match expected row without preprocessing
- DuckDB FTS matched when text was pre-segmented (space-separated unigram-like form)
- SQLite FTS5 showed similar behavior: raw Japanese token matching is weak without tokenizer strategy

Practical implication: unigram needs explicit tokenizer/preprocessing strategy regardless of DB.

## Recommendation

### Primary: SQLite + sqlite-vec

Why:

1. Lowest implementation and operational risk in Rust (`rusqlite` is mature)
2. Perfect for single-binary local architecture
3. Easy to keep SoT in Markdown and derived indexes in `.amem/.index/*`
4. Clear phase strategy:
   - Phase 1: UTF-8 unigram lexical candidate generation + vector rerank
   - Phase 2: Lindera + BM25 rollout

### Secondary: LanceDB

Why:

1. Better long-term vector scaling path
2. Rust SDK is good
3. Good fallback if vector volume/latency exceeds SQLite-based approach

## Suggested amem Architecture (Short)

1. SoT: `.amem/**/*.md`
2. Derived index:
   - `.amem/.index/lexical.db` (SQLite)
   - `.amem/.index/vector.db` (SQLite/sqlite-vec)
   - `.amem/.index/embedding_cache.db` (SQLite)
3. Retrieval:
   - Lexical phase 1: UTF-8 unigram overlap + IDF-like candidate scoring
   - Semantic: cosine similarity
   - Fusion: RRF
4. Phase 2:
   - Lindera tokenizer
   - BM25 with morphology-aware tokens

## Primary Sources

- SQLite FTS5: https://sqlite.org/fts5.html
- SQLite license: https://sqlite.org/copyright.html
- rusqlite: https://github.com/rusqlite/rusqlite
- sqlite-vec: https://github.com/asg017/sqlite-vec
- sqlite-vec docs: https://alexgarcia.xyz/sqlite-vec/
- DuckDB overview: https://duckdb.org/why_duckdb
- DuckDB FTS extension: https://duckdb.org/docs/stable/core_extensions/full_text_search.html
- DuckDB VSS extension: https://duckdb.org/docs/stable/core_extensions/vss
- duckdb-rs: https://github.com/duckdb/duckdb-rs
- LanceDB docs: https://docs.lancedb.com/
- LanceDB Rust crate: https://docs.rs/lancedb/latest/lancedb/
- Tantivy: https://github.com/quickwit-oss/tantivy
- Tantivy tokenizer docs: https://docs.rs/tantivy/latest/tantivy/tokenizer/
