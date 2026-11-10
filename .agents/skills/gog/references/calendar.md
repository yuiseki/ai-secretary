# Calendar

前提と共通の使い方は [SKILL.md](../SKILL.md)。

## 今日の予定

```bash
/home/yuiseki/bin/gog --account yuiseki@gmail.com calendar events primary --today --plain --all-pages --max 50
```

`--plain` の列は `ID START END SUMMARY`。

予定があるかだけ確かめるときは `--max 1 --fail-empty` (exit 0 であり、exit 3 で 0 件)。

```bash
/home/yuiseki/bin/gog --account yuiseki@gmail.com calendar events primary --today --max 1 --plain --fail-empty
```

## 期間と絞り込み

- 明日以降や任意の期間: `--from` と `--to`、または `--days`、`--week`
- 全カレンダーを横断: `calendar events --all --today`
- 文字列で絞り込み: `--query`
