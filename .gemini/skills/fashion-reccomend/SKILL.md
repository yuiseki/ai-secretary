# ファッション提案スキル

Google Keep のファッションアイテム情報と、過去のコーディネート履歴、および当日の気温を組み合わせて、最適なファッションを提案し Google Calendar に記録する手順。

## 概要
ユーザーの「今日のコーデを提案して」という依頼に対し、所有アイテム（Keep）と過去の傾向（Calendar）を分析し、天候に適したスタイルを提案します。

## 手順

### 1. ファッションアイテム情報の取得
Google Keep から `__Fashion` ラベルの付いたノートを取得し、アイテムの詳細（カテゴリ、印象、適応気温など）を把握します。

```bash
gkeep notes ls --all --json | jq -r '.[] | select(.labels[]? == "__Fashion")'
```

### 2. カレンダー履歴の参照
Google Calendar の「0 ゆいせき コーデ」カレンダーから過去の記録を参照し、書式や好みの傾向を確認します。

```bash
# .env からパスワードを読み込む
export $(grep -v '^#' /home/yuiseki/Workspaces/.env | xargs)
# カレンダーIDの特定
CAL_ID=$(/home/yuiseki/bin/gog --account yuiseki@gmail.com calendar calendars --json | sed -n '/^{/,$p' | jq -r '.calendars[] | select(.summary=="0 ゆいせき コーデ") | .id')
# 履歴の取得
/home/yuiseki/bin/gog --account yuiseki@gmail.com calendar events ls "$CAL_ID" --from <開始日> --to <終了日> --json
```

### 3. 当日の天候・気温の確認
`weather-calendar` スキル等で取得した当日の最低・最高気温を確認し、適した厚さのアイテムを選定します。

### 4. コーディネートの提案と記録
選定したアイテムをそれぞれ**個別の終日予定**としてカレンダーに記録します。

- **タイトル**: Keep のノートタイトルをそのまま使用
- **形式**: アイテムごとに1つのイベントを作成

```bash
# .env からパスワードを読み込む
export $(grep -v '^#' /home/yuiseki/Workspaces/.env | xargs)

# アイテムAの登録
/home/yuiseki/bin/gog --account yuiseki@gmail.com calendar create "$CAL_ID" \
  --summary "Keepノートタイトル1" \
  --from "<当日日付>" --to "<当日日付>" --all-day --force

# アイテムBの登録
/home/yuiseki/bin/gog --account yuiseki@gmail.com calendar create "$CAL_ID" \
  --summary "Keepノートタイトル2" \
  --from "<当日日付>" --to "<当日日付>" --all-day --force
```

## 注意事項
- 実行前に必ず `/home/yuiseki/Workspaces/.env` から `GOG_KEYRING_PASSWORD` を読み込む必要があります。
- 気温が低い（10°C以下）場合は、防寒性の高いアウター（ファーブルゾン、ダウン等）を優先します。
- 「絶対領域」や「地雷系」といった、ユーザー固有のファッションスタイルやこだわりを尊重した提案を行います。
- `gkeep` と `gog` の両方の認証情報が必要です。
