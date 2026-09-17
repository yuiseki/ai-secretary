---
name: fashion-reccomend
description: Google Keep の `__Fashion` ラベル付きノート、Google Calendar の「0 ゆいせき コーデ」履歴、当日の天気を組み合わせてコーディネートを提案し、カレンダーへ記録する。ユーザーが「今日のコーデを提案して」「天気に合わせた服を選んで」「コーデをカレンダーに残して」と依頼したときに使う。
---

# Fashion Recommend

## 事前確認
- `gkeep` と `gog` を利用可能にする。
- 実行前に `.env` から `GOG_KEYRING_PASSWORD` を読み込む。

```bash
export $(grep -v '^#' /home/yuiseki/Workspaces/.env | xargs)
```

## 手順

1. `__Fashion` ラベルの Keep ノートを取得して候補アイテムを整理する。

```bash
gkeep notes ls --all --json | jq -r '.[] | select(.labels[]? == "__Fashion")'
```

2. 「0 ゆいせき コーデ」カレンダーの ID を特定し、過去記録を取得する。

```bash
CAL_ID=$(/home/yuiseki/bin/gog --account yuiseki@gmail.com calendar calendars --json | sed -n '/^{/,$p' | jq -r '.calendars[] | select(.summary=="0 ゆいせき コーデ") | .id')
/home/yuiseki/bin/gog --account yuiseki@gmail.com calendar events ls "$CAL_ID" --from <開始日> --to <終了日> --json
```

3. 当日の最低気温と最高気温を確認し、厚みの合うアイテムを選ぶ。
4. 選んだアイテムを Keep ノートタイトルそのままの終日予定として 1 アイテム 1 件で登録する。

```bash
/home/yuiseki/bin/gog --account yuiseki@gmail.com calendar create "$CAL_ID" \
  --summary "Keepノートタイトル1" \
  --from "<当日日付>" --to "<当日日付>" --all-day --force

/home/yuiseki/bin/gog --account yuiseki@gmail.com calendar create "$CAL_ID" \
  --summary "Keepノートタイトル2" \
  --from "<当日日付>" --to "<当日日付>" --all-day --force
```

## 運用ルール
- 気温が 10°C 以下なら防寒性の高いアウターを優先する。
- ユーザー固有のスタイル嗜好（例: 地雷系、絶対領域）を提案に反映する。
