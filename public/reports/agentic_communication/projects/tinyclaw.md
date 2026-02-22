# TinyClaw

## Quick facts
- Discord DM クライアントと queue processor をファイル queue で分離した構成。
- チャネル層は「DM 入出力の橋渡し」に徹し、agent/team orchestration は別プロセスが担当。
- Slack は未実装、Discord は DM 特化。

## 主要実装ファイル
- Discord client: `repos/_claw/tinyclaw/src/channels/discord-client.ts`
- Queue processor: `repos/_claw/tinyclaw/src/queue-processor.ts`
- Queue architecture docs: `repos/_claw/tinyclaw/docs/QUEUE.md`

## 全体アーキテクチャ

### file queue 分離（中核）
`docs/QUEUE.md` の構造は概ね次の流れ。

1. channel client（Discord DM）
2. `queue/incoming/*.json` へメッセージ書き込み
3. queue processor が読み取り、agent/team routing と AI 実行
4. `queue/outgoing/*.json` へ応答書き込み
5. channel client が送信

この設計により、Discord 接続不安定性と agent 実行負荷を分離できる。

## Discord 実装（`discord-client.ts`）

### チャネル責務
- `discord.js` ベースの DM client。
- inbound DM と attachments を `~/.tinyclaw/queue/incoming` に JSON + ファイルで保存。
- outbound queue をポーリングして Discord に送る。

### pairing / local commands
- `ensureSenderPaired` による送信者承認（pairing）を実装。
- `/agent`, `/team`, `/reset` のローカル command を DM client 側で処理し、agent 実行前の設定変更を行う。

### outbound UX
- Discord 2000文字制限で chunking。
- `pendingMessages` map で outgoing response と inbound request の相関を管理。

## queue processor（`queue-processor.ts`）
- channel 層から独立した常駐プロセス。
- incoming queue を処理し、agent/team ルーティングと AI 実行を担当。
- channels は dumb adapter、queue processor が intelligence を持つという分離が明確。

## Notable ideas
- チャネルと agent runtime をファイル queue で強制分離する設計は、障害切り分けと運用再起動が容易。
- DM client 側に pairing と軽量ローカル command を置くことで、queue processor 側の責務を減らしている。

## 留意点
- Slack 未実装。
- file queue とローカルファイル管理に依存するため、単一ホスト前提が強い。
- OpenClaw のような rich interactive components / guild routing とは問題設定が異なる。
