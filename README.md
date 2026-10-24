# ai-secretary

## Install dependencies

- https://github.com/cli/cli
- https://github.com/microsoft/playwright-cli
- https://github.com/steipete/gogcli
- https://github.com/yuiseki/gkeepcli
- https://github.com/yuiseki/weathercli
- https://github.com/yuiseki/newscli
- https://github.com/yuiseki/hatebucli
- https://github.com/yuiseki/gyazocli
- https://github.com/yuiseki/moneycli



## amux

`bin/amux ls` / `bin/amux watch` でエージェントの状態を確認できます。
各行の先頭のアイコンは状態を表します。
`◐` は run、`◔` は wait (バックグラウンド処理待ち)、`◆` は ask (許可・質問など人の入力待ち)、`○` は idle、`×` は dead (エージェントが終了)、`·` は down (tmux セッションが無い) です。
Claude は入力欄の直下のステータス行で判定し、`esc to interrupt` があれば `run`、
権限確認・質問・folder の信頼確認の dialog (最終行が `Esc to cancel`) が出ていれば `ask`、ターン終了後もバックグラウンドのシェルや Monitor が動いていれば `wait`、それ以外を `idle` と表示します。
入力欄の上の `new task? /clear to save` は文脈が大きいという意味だけなので、判定には使いません。
Codex は実行中を `run`、時間・中断操作付きの `Waiting for …` 表示を `wait`、
承認確認 (最終行が `Press enter to confirm or esc to cancel`) を `ask` と表示します。
ターン終了後もバックグラウンド端末が動いていれば `wait`、それ以外は `idle` です。
実行中はバックグラウンド端末の有無より実行状態を優先します。
秒・分・時間の経過時間表示に対応しています。

`--agy` で Antigravity CLI (agy) のセッションも扱えます。
起動は `agy --mode auto`、再開は `agy --mode auto --conversation ID` です。
新規に起動したら `/rename` で名前を付け、名前から会話 ID は `~/.gemini/antigravity-cli/conversation_summaries.db` の title で引きます。
状態は画面で判定します。入力欄の上にスピナーがあれば `run`、シェルコマンドの権限確認や folder の信頼確認が出ていれば `ask`、
ターン終了後も背景タスク (フッターの `N task(s)`) が残っていれば `wait`、それ以外は `idle` です。

`--opencode` で opencode のセッションも扱えます (v2 で確認)。
起動は `opencode -s ID`、再開も同じです。`-s` は未知の ID なら新規セッションを作るので、ID は名前から `ses_` + uuid5 で決めます (`--auto` は付けません)。
状態は最終行で判定します。`esc interrupt` があれば `run`、`↓ N shell` (バックグラウンド実行中) があれば `wait`、
`Allow once … enter confirm` の許可確認が出ていれば `ask`、それ以外は `idle` です。
opencode はディレクトリごとに asdf で別版 (1.x) が選ばれることがあり、1.x は新規 ID の `-s` を受け付けません。

回帰テストは `python -m unittest discover -s tests -v` で実行できます。
