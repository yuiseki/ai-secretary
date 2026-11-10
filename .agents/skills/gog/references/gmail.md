# Gmail

前提と共通の使い方は [SKILL.md](../SKILL.md)。

## 未読があるかだけ確かめる

```bash
/home/yuiseki/bin/gog --account yuiseki@gmail.com gmail search 'is:unread in:inbox' --max 1 --plain --fail-empty
```

exit 0 なら未読あり、exit 3 なら未読なし。件数や中身の取得とは分けて実行する。

## 重要な未読を取る

次の通知はノイズとして除く。

- Vercel の preview デプロイ失敗 (`Failed preview deployment`)
- GitHub Actions の失敗・中止 (`Run failed`, `Run cancelled`)

```bash
/home/yuiseki/bin/gog --account yuiseki@gmail.com gmail search 'is:unread in:inbox -category:{social updates promotions} -subject:("Failed preview deployment" OR "Run failed" OR "Run cancelled")' --max 20 --json
```

## 最新のものを選ぶ

`gmail search` には並び順を指定するフラグが無く、返る順は日付の降順とは限らない
(`--oldest` は表示する日付を最初のメッセージにするだけで、並び順は変えない)。
「最新」を選ぶときは、多めに取ってからローカルで並べ直す。

```bash
/home/yuiseki/bin/gog --account yuiseki@gmail.com gmail search '<query>' --max 20 --json \
| sed -n '/^{/,$p' \
| jq -r '.threads | sort_by(.date) | reverse | .[0]'
```

`<query>` の例は `is:starred in:inbox`。20 件で足りなければ `--max 50` か `--all`。
