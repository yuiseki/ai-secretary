---
name: gog
description: >-
  gog CLI で Gmail、Google Calendar、Google Tasks、Drive を読み書きする。
  「未読メールを確認して」「今日の予定を見たい」「ToDo を追加して」「メール確認してタスク更新して」
  のような依頼や、gog の認証・TTY・keyring のエラーを直すときに使う。
argument-hint: "[gmail|calendar|tasks|drive] [依頼内容]"
---

# gog

Arguments: `$ARGUMENTS`

最初の語がサービスを指していれば、その手順だけを読む。無ければ依頼から判断する。

| サービス | 手順 |
|---|---|
| Gmail (未読確認、検索、最新順) | [references/gmail.md](references/gmail.md) |
| Calendar (今日・明日の予定) | [references/calendar.md](references/calendar.md) |
| Tasks (追加、更新、完了、メール起点のタスク) | [references/tasks.md](references/tasks.md) |
| Drive ほか | `gog <group> --help` から始める |

## この環境の前提 (2026-11-10 に確認)

- バイナリは `/home/yuiseki/bin/gog` (v0.11.0)。`./bin/gog` は無い。
- アカウントは `yuiseki@gmail.com`。API コマンドには毎回 `--account` を付ける。
- config は `/home/yuiseki/.config/gogcli/config.json`、keyring backend は `file`。
- 非 TTY ではトークンを読めずに次のエラーになることがある。
  `no TTY available for keyring file backend password prompt; set GOG_KEYRING_PASSWORD`
  TTY で実行してパスフレーズを入れるか、`GOG_KEYRING_PASSWORD` を設定する。
  `gog auth status` と `gog auth keyring` で状態を確かめられる。

## 共通の使い方

- エージェントからは `--json --no-input` を基本にする。人が読むなら `--plain` (TSV)。
- 読み取りを先に実行して疎通を確かめ、書き込みは後にする。
- 書き込み (`send`、`tasks add/update/done` など) は先に `--dry-run` を付けて確かめる。
  `--force` は本人が確認の省略を求めたときだけ。
- 0 件を失敗として扱いたいときは `--fail-empty` (0 件で exit 3)。
- TTY 実行ではパスフレーズのプロンプトが標準出力に混ざることがあるので、
  JSON を読む前に `sed -n '/^{/,$p'` で先頭のノイズを捨ててから `jq` に渡す。
- フラグが分からなければ `gog <group> <command> --help` を見る。

```bash
/home/yuiseki/bin/gog --account yuiseki@gmail.com --json --no-input <group> <command...>
```
