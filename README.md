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
Claude は入力欄の直下のステータス行で判定し、`esc to interrupt` があれば `run`、
ターン終了後もバックグラウンドのシェルやエージェントが動いていれば `wait`、それ以外を `idle` と表示します。
Codex は実行中を `run`、時間・中断操作付きの `Waiting for …` 表示、または
ターン終了後もバックグラウンド端末が動いている状態を `wait`、それ以外を `idle` と表示します。
実行中はバックグラウンド端末の有無より実行状態を優先します。
秒・分・時間の経過時間表示に対応しています。

回帰テストは `python -m unittest discover -s tests -v` で実行できます。
