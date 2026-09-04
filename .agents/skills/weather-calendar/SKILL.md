# 天気カレンダー記録スキル

指定した場所の天気を取得し、Google Calendar の「1 天気ログ」カレンダーに記録する手順。

## 概要
ユーザーから「今日の天気をカレンダーに記録して」などの依頼があった際に、`weathercli` でデータを取得し、`gog` CLI を使用してカレンダーに登録します。

## 手順

### 1. 天気情報の取得
`weathercli` を使用して、指定された座標（例：台東区 35.7126, 139.7799）の天気を取得します。

```bash
cd /home/yuiseki/Workspaces/repos/weathercli
npx tsx src/index.ts --lat 35.7126 --lon 139.7799 --json
```

### 2. カレンダーIDの特定
「1 天気ログ」という名前のサマリーを持つカレンダーの ID を特定します。

```bash
# .env からパスワードを読み込む
export $(grep -v '^#' /home/yuiseki/Workspaces/.env | xargs)
/home/yuiseki/bin/gog --account yuiseki@gmail.com calendar calendars --json | sed -n '/^{/,$p' | jq -r '.calendars[] | select(.summary=="1 天気ログ") | .id'
```

### 3. カレンダーへの記録（予定の作成）
取得した天気情報（天候、最低気温、最高気温）を元に、以下のフォーマットで終日予定を作成します。

- **タイトル形式**: `天候 | 最低気温 ～ 最高気温`
- **例**: `晴れ | 1.4°C ～ 13.3°C`

```bash
# .env からパスワードを読み込む
export $(grep -v '^#' /home/yuiseki/Workspaces/.env | xargs)
/home/yuiseki/bin/gog --account yuiseki@gmail.com calendar create "<CALENDAR_ID>" \
  --summary "晴れ | 1.4°C ～ 13.3°C" \
  --description "最高気温: 13.3°C / 最低気温: 1.4°C\n天候: 晴れ" \
  --from "2026-02-21" --to "2026-02-21" \
  --all-day --force
```

## 注意事項
- 実行前に必ず `/home/yuiseki/Workspaces/.env` から `GOG_KEYRING_PASSWORD` を読み込む必要があります。
- カレンダー名は `1 天気ログ` であることを確認してください。
- 気温の数値は `weathercli` の `daily` 予報データから当日の `temperature_2m_max` および `temperature_2m_min` を使用します。
