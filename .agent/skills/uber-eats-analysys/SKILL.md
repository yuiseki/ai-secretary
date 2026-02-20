---
name: uber-eats-analysys
description: Uber Eats 注文分析。`.ai-secretary/uber-analysis` を網羅データとして全体傾向を集計し、`.ai-secretary/uber_eats_data` がある場合はメニュー詳細の補完データとして重ねて分析する。直近7日/30日などの analysis window 集計にも対応。
---

# Uber Eats Analysys

## 目的

Uber Eats の分析は次の二層で扱う。

- 主データ（網羅）: `.ai-secretary/uber-analysis`
  - `gog` で収集した Gmail 領収書を元に全期間の注文傾向を集計する。
- 補完データ（詳細）: `.ai-secretary/uber_eats_data`
  - ubereats.com スクレイピング由来の注文詳細（メニュー明細）を持つ。
  - **このディレクトリを詳細データの SSoT (Single Source of Truth) とし、新規取得分は既存 ID との重複を確認した上で継ぎ足す。**
  - カバレッジが主データより狭い可能性があるため、主データを置き換えずに補完として使う。

出力は原則 `.ai-secretary/uber-analysis` 配下に保存する。

## ファイル配置

- スクリプト: `.codex/skills/uber-eats-analysys/scripts/analyze_uber_orders.py`
- 主入力データ: `.ai-secretary/uber-analysis/raw_by_year/uber_YYYY.json`
- 補完入力データ: `.ai-secretary/uber_eats_data/uber_eats_*.json`
- 出力データ:
  - `.ai-secretary/uber-analysis/uber_orders_all.csv`
  - `.ai-secretary/uber-analysis/uber_orders_summary_all.json`
  - 必要に応じて詳細補完ファイル（例）:
    - `.ai-secretary/uber-analysis/uber_detail_orders.csv`
    - `.ai-secretary/uber-analysis/uber_detail_items_ranking.csv`

## 収集クエリ

```text
from:noreply@uber.com (subject:"Uber Eats" OR subject:"Uber の領収書")
```

## 実行手順

### 1. 補完データ（詳細）の更新 (Webスクレイピング) - **推奨**
`.cookie/user-eats.cookie.json` がある場合、ブラウザから最新の注文詳細を取得する。**このディレクトリ（`.ai-secretary/uber_eats_data`）を詳細データの SSoT (Single Source of Truth) とし、新規取得分は既存 ID との重複を確認した上で継ぎ足す。**

1. **クッキーの変換と読み込み**
   `uber-eats-recommend` スキルの手順に従い、`.ai-secretary/uber-auth-state.json` を作成する。

2. **注文履歴のキャプチャ**
   `getPastOrdersV1` API のレスポンスを抽出する。複数ページ（遡りたい分だけ）スクロールして取得する。

```bash
playwright-cli -s=uber open --browser=firefox
playwright-cli -s=uber state-load .ai-secretary/uber-auth-state.json
playwright-cli -s=uber run-code "async page => {
  const responses = [];
  page.on('response', async r => {
    if (r.url().includes('getPastOrdersV1') && r.status() === 200) {
      try { const j = await r.json(); responses.push(j); } catch(e) {}
    }
  });
  await page.goto('https://www.ubereats.com/jp/orders');
  await page.waitForTimeout(5000);
  for(let i=0; i<10; i++) { // 10回スクロール（約100件分）
    await page.evaluate(() => window.scrollBy(0, 3000));
    await page.waitForTimeout(4000);
  }
  return responses;
}" > .ai-secretary/uber_eats_data/uber_eats_batch_raw.json
```

3. **既存データへの継ぎ足し**
   `merge_batch.py` 等を使用して、重複しない新しい注文だけを連番ファイル（`uber_eats_NNN.json`）として保存する。

### 2. 主データ（網羅）の更新 (Gmail経由)
年別に本文付きメールを取得する（Web で取得しきれない長期履歴の補完用）。

### 3. 分析の実行
分析ウィンドウを指定して集計する。

2. 主データを集計する（analysis window 指定）。

```bash
python3 .codex/skills/uber-eats-analysys/scripts/analyze_uber_orders.py --windows 7,30
```

3. 必要なら window を増やす。

```bash
python3 .codex/skills/uber-eats-analysys/scripts/analyze_uber_orders.py --windows 7,30,90 --top-stores 30
```

4. `.ai-secretary/uber_eats_data` が存在する場合、詳細補完を実行する。

```bash
mkdir -p .ai-secretary/uber-analysis
tmp_file=".ai-secretary/uber-analysis/uber_detail_orders.csv"
rm -f "$tmp_file"
for f in .ai-secretary/uber_eats_data/uber_eats_*.json; do
  jq -r '
    .data.ordersMap[]
    | select(.baseEaterOrder.isCompleted == true)
    | [
        .baseEaterOrder.completedAt,
        (.storeInfo.title // ""),
        ([(.baseEaterOrder.shoppingCart.items[]?.title)] | join(",")),
        ((.fareInfo.totalPrice // 0) / 100)
      ]
    | @csv
  ' "$f" >> "$tmp_file"
done
```

5. レポート作成時は次の優先順位で統合する。

- 全体件数・全体金額・window比較: 主データ（`.ai-secretary/uber-analysis`）を採用。
- メニュー頻度・店舗内メニュー構成: 補完データ（`.ai-secretary/uber_eats_data`）を採用。
- 同じ軸で値が衝突する場合: 主データを正、補完データは「詳細参考値」として別枠表示する。

## 出力の見方

- `totals`: 全期間の件数・合計金額・平均・中央値（主データ基準）
- `analysis_windows.last_7d` など:
  - `totals`: 対象 window の集計（主データ基準）
  - `compare_previous_same_length_window`: 直前同期間との増減
  - `by_day`, `by_weekday`, `by_hour`: 時系列/曜日/時間帯の傾向
  - `top_stores_by_orders`, `top_stores_by_spend`: 店舗傾向
- 補完データがある場合:
  - `items` 系指標（よく注文するメニュー、店舗×メニュー）を追加で示す。
  - メニュー分析はカバレッジ期間を必ず併記する。

## 運用ノウハウ

- `gog` は keyring の都合で非TTY実行に失敗することがある。`no TTY available...` が出たら TTY 実行に切り替える。
- 取得件数が多いときは必ず年別で分割する。1回で全期間 `--include-body --all` は重い。
- 最新状況だけ更新したいときは当年ファイルだけ再取得して再集計すればよい。
- window の基準時刻はスクリプト実行時刻（`analysis_anchor`）なので、比較時は実行時刻を揃える。
- `uber_eats_data` の `fareInfo.totalPrice` は 100 倍スケール（例: `146000 -> 1460円`）なので補正して扱う。
- `uber_eats_data` の日時は UTC なので、時間帯分析は必要に応じて JST へ変換して解釈する。
- 補完データの範囲は主データより短いことがあるため、全期間結論は必ず主データ側で確定する。
