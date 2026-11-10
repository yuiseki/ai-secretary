# Tasks

前提と共通の使い方は [SKILL.md](../SKILL.md)。書き込みは必ず先に `--dry-run`。

## メールを確認してタスクを更新する

1. [gmail.md](gmail.md) の手順で対象のメールを特定する。「最新」は並べ直してから選ぶ。
2. メールから `date`、`from`、`subject`、`action` (何をやるか) を取り出す。
3. 同じ用件の未完了タスクがあれば `update`、無ければ `add`。
4. 終わったら `done` で閉じる。

notes には `subject` と `date` を残し、あとからメールまで辿れるようにする。

## タスクリスト

```bash
/home/yuiseki/bin/gog --account yuiseki@gmail.com tasks lists list --json \
| sed -n '/^{/,$p' \
| jq -r '.tasklists[] | select(.title=="マイタスク") | .id'
```

## 追加

```bash
/home/yuiseki/bin/gog --dry-run --account yuiseki@gmail.com tasks add <tasklistId> \
  --title '<title>' \
  --notes 'メール: <subject> (<date>) / from: <from> / action: <action>' \
  --json
```

問題が無ければ `--dry-run` を外して実行する。

## 更新

```bash
/home/yuiseki/bin/gog --account yuiseki@gmail.com tasks list <tasklistId> --all --show-completed --json \
| sed -n '/^{/,$p' \
| jq -r '.tasks[] | select(.status=="needsAction" and (.title | contains("<keyword>"))) | .id'

/home/yuiseki/bin/gog --account yuiseki@gmail.com tasks update <tasklistId> <taskId> \
  --notes '<latest notes>' --json
```

## 完了

```bash
/home/yuiseki/bin/gog --account yuiseki@gmail.com tasks done <tasklistId> <taskId> --json
```
