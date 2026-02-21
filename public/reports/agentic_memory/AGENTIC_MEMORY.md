# OpenClaw と派生プロジェクトにおける Agentic Memory アーキテクチャ調査（公開版）

調査日: 2026-02-21  
公開編集日: 2026-02-21

## 1. 調査スコープ
本レポートは、`openclaw` を基準に、派生・比較対象として以下を調査した。

- `openclaw`
- `nanobot`
- `picoclaw`
- `zeroclaw`
- `ironclaw`
- `mimiclaw`
- `nanoclaw`
- `safeclaw`（派生というより比較対象）
- `tinyclaw`（関連性確認のみ）

## 2. エグゼクティブサマリー
OpenClaw系の memory 設計は、大きく次の3系統に分かれる。

1. ファイル真実系（Markdown SoT）
- 代表: `openclaw`, `nanobot`, `picoclaw`, `mimiclaw`, `nanoclaw`
- 人間可読・可編集を優先。検索は grep/再読、または後段インデックスで補う。

2. インデックス派生系（File + Index）
- 代表: `openclaw` builtin/QMD, `zeroclaw`, `ironclaw`
- SoT は Markdown/Document だが、実用検索は FTS + Vector のハイブリッドで行う。

3. 状態ストア系（Operational State Memory）
- 代表: `safeclaw`
- LLMの文脈想起ではなく、業務状態（履歴、設定、リマインダ等）の永続化が主目的。

最も中核的なアイデアは以下。

- 「Memory を人間編集可能な一次情報（Markdown/Doc）として保持し、検索高速化は派生インデックスで担う」
- 「長期記憶と短期/日次/セッション記憶を分離する」
- 「検索は lexical（FTS/BM25）と semantic（embedding cosine）を融合する」
- 「運用上の memory lifecycle（圧縮前 flush、hygiene、snapshot/hydrate）を内蔵する」
- 「メモリ汚染（prompt injection）や越境読み書きに対するガードを memory レイヤで持つ」

## 3. 比較表（要点）
| Project | SoT | 検索方式 | 書き込みトリガ | 運用機能 | 特徴 |
|---|---|---|---|---|---|
| OpenClaw | `MEMORY.md` + `memory/*.md` (+ optional sessions) | Builtin: FTS + Vector + Hybrid merge + optional MMR/TemporalDecay / QMD: sidecar search | ファイル監視同期、検索時同期、セッションdelta同期、圧縮前memory flush | safe reindex(atomic swap), provider fallback, qmd fallback | 現時点で最も多層・高機能 |
| NanoBot | `memory/MEMORY.md`, `memory/HISTORY.md` | MEMORYは全注入、HISTORYは grep | セッション肥大時にLLMで `history_entry` + `memory_update` を生成 | 低複雑性 | ミニマル実装の代表 |
| PicoClaw | `memory/MEMORY.md`, `memory/YYYYMM/YYYYMMDD.md` | 最近日次ノート + 長期記憶を注入 | memory append/overwrite + セッション要約 | シンプル要約運用 | NanoBot系をGoで整理 |
| ZeroClaw | backend選択（sqlite/lucid/postgres/markdown/none） | sqlite: FTS5 + vector + hybrid + fallback LIKE | tool経由 store/forget、backend依存 | hygiene, snapshot/hydrate, response cache | traitベースで交換可能 |
| IronClaw | DB上の仮想FSドキュメント | Postgres FTS + pgvector + RRF | write/appendごとに再chunk・再index | seed、backfill、identity保護 | memoryを「DBファイルシステム」として統一 |
| MimiClaw | SPIFFS上のMarkdown + JSONL | 日付/ファイルベース、windowed session | C実装で直接append/write | 超軽量、組込向け | OpenClaw思想の組込最適化 |
| NanoClaw | `groups/*/CLAUDE.md` 階層 | Claudeランタイム依存 | エージェントがmarkdown更新 | コンテナ分離 | 独自検索器なし、外部ランタイム委譲 |
| SafeClaw | SQLite業務状態 | SQL条件検索 | 受信/操作時に更新 | prepared statement中心 | 文脈記憶より状態管理 |

## 4. OpenClaw 深掘り

### 4.1 設計の核
- デフォルトは `memory-core` plugin が `memory_search` / `memory_get` を提供。
- `MEMORY.md` と `memory/*.md` を一次情報とし、インデックスは派生物。
- backend は `builtin` と `qmd` を切替可能。qmd失敗時は builtin へフェイルバック。

### 4.2 Builtin メモリエンジン
- 索引DB: `files`, `chunks`, `embedding_cache`, optional FTS table, optional sqlite-vec table。
- `search` は
  - keyword: FTS/BM25
  - semantic: cosine similarity
  - merge: weighted hybrid
  - optional: MMR rerank / temporal decay
- Embedding provider は auto/openai/gemini/voyage/local で自動選択＋fallbackあり。

### 4.3 同期/再索引パイプライン
- chokidarでmemory markdown監視し dirty 化。
- sessionsソース有効時は transcript update を bytes/messages delta で閾値同期。
- full reindex は temp DB で構築して atomic swap（破損・中断耐性）。

### 4.4 QMD backend
- QMD CLI sidecar (`search`/`vsearch`/`query`) を利用。
- collection を明示管理、定期 `qmd update` + `qmd embed`。
- session transcript を markdown export して別collection化可能。
- session key/channel/chatType で検索スコープ制御可。

### 4.5 compaction直前 memory flush
- context圧縮直前に silent turn を実行し durable facts を保存させる。
- `NO_REPLY` を強制してユーザー向け応答を抑制。
- 1 compaction cycle 1回に制御。

### 4.6 セキュリティ観点
- `memory_get` path制約（workspace/許可extraPathのみ）。
- citations modeで注入文脈の扱いを制御。
- `memory-lancedb` plugin側では recall挿入時に prompt injectionパターンを検知しエスケープ。

## 5. 派生プロジェクト分析

### 5.1 NanoBot
- 2層 memory が明快:
  - `MEMORY.md`: 長期事実
  - `HISTORY.md`: 追記ログ
- セッション肥大時に LLM で JSON 要約を生成し、
  - `history_entry` を append
  - `memory_update` で長期記憶を更新
- 強み: 実装量が少なく理解容易。
- 弱み: semantic recall がなく、記憶品質が要約プロンプト品質依存。

### 5.2 PicoClaw
- NanoBot思想をGoへ移植し、日次ログを `YYYYMM/YYYYMMDD.md` で管理。
- `GetMemoryContext` で長期記憶 + 直近3日を注入。
- 別途 session summary を併用し、長会話の文脈維持を補助。

### 5.3 ZeroClaw
- `Memory` trait で backend を交換可能にした実装。
- sqlite backend は FTS5 + vector + hybrid、embedding cache LRU、fallback LIKE を持つ。
- memory hygiene（アーカイブ/削除）や snapshot/hydrate（`MEMORY_SNAPSHOT.md`）で運用回復力が高い。
- Lucid bridge は local sqlite を authoritative に保ちつつ外部context recallを併用。

### 5.4 IronClaw
- memory を「DB上の仮想ファイルシステム」として統合。
- すべての文書を chunk 化し、FTS + vector を RRF で統合。
- writeごとに再indexするため整合性は高いが、大文書更新コストは増える。
- identityファイルへの tool write を禁止し、memory汚染の永続化を防ぐ設計。

### 5.5 MimiClaw（mimiclaw）
- ESP32向け C 実装。
- `MEMORY.md` + 日次 markdown + session JSONL の構成。
- リソース制約下でも「長期記憶 + 日次記憶 + セッション履歴」を成立させる最小実装。

### 5.6 NanoClaw
- 独自の semantic memory engine は持たず、Claude runtime memory に依存。
- 代わりに、group単位コンテナ分離と階層 `CLAUDE.md`（global/group）で記憶境界を明確化。
- 記憶品質は外部ランタイム依存だが、隔離性は高い。

### 5.7 SafeClaw
- ルールベース自動化エンジンの状態永続化層。
- 会話文脈の semantic recall ではなく、operation state（reminder等）が中心。
- Agentic memory比較では「別カテゴリ」として扱うのが妥当。

## 6. 中核アイデアの抽出

### 6.1 「SoTは人間可読、検索は派生インデックス」
OpenClaw/ZeroClaw/IronClawは、編集可能な一次情報を維持しつつ、検索専用構造を別途持つ。これは監査性と性能を両立しやすい。

### 6.2 「長期記憶とイベント記憶の分離」
NanoBot/PicoClaw/MimiClawは、長期事実ファイルと時系列ログを分離。混在を防ぎ、要約や更新戦略を分けられる。

### 6.3 「Hybrid retrieval が実運用での妥協点」
pure vector はキーワード一致に弱く、pure keyword は言い換えに弱い。OpenClaw/ZeroClaw/IronClawはこのギャップを埋める。

### 6.4 「Memory lifecycle を組み込むと壊れにくい」
- OpenClaw: pre-compaction flush, atomic reindex
- ZeroClaw: hygiene + snapshot/hydrate
この層がないと、長期運用で memory が崩壊しやすい。

### 6.5 「Memoryはセキュリティ境界でもある」
path制約、identityファイル保護、groupコンテナ分離など、memoryは攻撃面でもある。派生ほどここに差が出る。

## 7. トレードオフ整理

### 7.1 実装複雑性 vs 想起品質
- 高品質側: OpenClaw, IronClaw, ZeroClaw(sqlite/lucid)
- 低複雑側: NanoBot, PicoClaw, MimiClaw

### 7.2 透過性 vs 依存性
- 高透過: Markdown主体（NanoBot/Pico/Mimi）
- 高依存: ランタイム委譲（NanoClawのClaude memory依存）

### 7.3 リソース制約
- 組込向け最適化: MimiClaw
- 高機能運用向け: OpenClaw/ZeroClaw/IronClaw

## 8. 設計上の改善余地（実装ベース）

### 8.1 OpenClaw
- MMRトークナイズがASCII寄りで、多言語（特に日本語）多様化効果が限定される可能性。
- `memory-lancedb` の capture trigger はヒューリスティック中心で取りこぼし/誤捕捉余地あり。

### 8.2 NanoBot / PicoClaw / MimiClaw
- `MEMORY.md` overwrite型更新が競合時に弱い。
- semantic recall欠如により、過去知識の言い換え想起が弱い。

### 8.3 IronClaw
- 可変次元対応で ANN index を外しており、規模増で vector検索コスト上昇可能性。

### 8.4 ZeroClaw
- backendと運用機構が豊富な分、設定面の運用難易度は上がる。

## 9. 結論
OpenClaw派生の memory 進化は、次の方向に収束している。

1. 記憶を「編集可能な知識資産」として残す（Markdown/Doc SoT）  
2. 想起は hybrid retrieval で行う（FTS + vector + rerank）  
3. 圧縮・劣化・破損を前提に lifecycle を組み込む（flush/hygiene/snapshot）  
4. 記憶境界をセキュリティ境界として扱う（path/identity/group isolation）

実装選択としては、
- 開発速度と単純性を優先するなら NanoBot/PicoClaw系
- 長期運用と検索品質を優先するなら OpenClaw/ZeroClaw/IronClaw系
- 極小ハードウェアなら MimiClaw系
が妥当。

---

## 付録: 関連ドキュメント（公開版）

- `AGENTIC_MEMORY.md`（本レポート）
- `projects/openclaw.md`
- `projects/nanobot.md`
- `projects/picoclaw.md`
- `projects/zeroclaw.md`
- `projects/ironclaw.md`
- `projects/mimiclaw.md`
- `projects/nanoclaw.md`
- `projects/safeclaw.md`
- `projects/tinyclaw.md`
