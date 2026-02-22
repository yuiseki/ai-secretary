# IronClaw

## Quick facts
- Slack / Discord の通信 runtime 実装よりも、WASM channel の registry/capability 設計が主題。
- `registry/channels/*.json` と capabilities manifest により、チャネル拡張を宣言的に扱う方向。
- 現状は設計先行で、OpenClaw級の会話チャネル実装は未充足。

## 主要実装ファイル
- registry:
  - `repos/_claw/ironclaw/registry/channels/slack.json`
  - `repos/_claw/ironclaw/registry/channels/discord.json`
- capabilities:
  - `repos/_claw/ironclaw/channels-src/slack/slack.capabilities.json`
  - `repos/_claw/ironclaw/channels-src/discord/discord.capabilities.json`
- status/docs:
  - `repos/_claw/ironclaw/README.md`
  - `repos/_claw/ironclaw/FEATURE_PARITY.md`

## 通信アーキテクチャ（設計意図）

### registry-based channel packages
- Slack/Discord を「runtimeに組み込まれた固定コード」ではなく、registry 登録された channel package として扱う発想。
- package metadata（名前、説明、実体パス、capabilities参照）を JSON registry に持つ。

### capabilities manifest（重要）
capabilities JSON には、典型的に以下のような情報を宣言できる。

- 必要 secrets（token / signing secret 等）
- webhook path の制約
- callback timeout
- rate limits
- 許可される操作面（channel runtime が触れてよい範囲）

この設計は、OpenClaw の plugin runtime をさらに sandbox / policy 化したものとして読める。

## 現状評価（Slack/Discord 会話実装として）
- registry / capabilities は存在し、設計の方向性は明確。
- ただし `FEATURE_PARITY.md` の内容から、Slack/Discord の実運用会話機能（routing, preflight, interactive, resilience）は未充足部分が多い。
- 本レポートの観点では「実装アーキテクチャの参考」というより、「将来の安全なチャネル拡張モデルの参考」に近い。

## Notable ideas
- チャネル拡張を **宣言的 manifest + sandboxed package** として扱う構想。
- runtime code に埋め込まず、権限と制約を registry/capabilities に出すことで監査性を上げる方向。

## 留意点
- 実装成熟度は OpenClaw / NanoBot / PicoClaw より低く、すぐに通信基盤として流用するのは難しい。
- 会話 UX の具体実装（typing, threads, slash/interactions, retries）は別途設計が必要。
