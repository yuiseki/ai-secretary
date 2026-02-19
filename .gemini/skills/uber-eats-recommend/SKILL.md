---
name: uber-eats-recommend
description: Uber Eats のレコメンド。注文分析スキルを活用し、過去の傾向や時間帯に合わせておすすめの店舗を提案する。店舗の閉鎖情報なども管理する。
---

# Uber Eats Recommend Runbook

## トリガー

- 「おなかすいた」
- 「Uber Eats オススメ教えて」
- 「何か食べたい」
- 「今日のお昼/夜は何がいいかな」

## 処理フロー

1. **分析データの確認・更新**
   - `.gemini/skills/uber-eats-analysys/SKILL.md` の手順に従い、最新の注文データを集計する。
   - すでに `.ai-secretary/uber-analysis/uber_orders_summary_all.json` が存在し、最新の状態であればそれを読み込む。

2. **リアルタイム情報の取得 (Cookie利用)**
   - `.cookie/user-eats.cookie.json` が存在する場合、以下の手順で `ubereats.com` を開く。
   - クッキーを Playwright の `storageState` 形式に変換（`sameSite` のマッピング、`id` フィールドの削除など）。
   - `playwright-cli` を使用し、Firefox で `https://www.ubereats.com/jp` にアクセスする。
   - 現在のトップページ（Feed）に表示されている店舗リストを取得し、営業状況や現在のレコメンドを確認する。

3. **レコメンドロジックの適用**
   - **時間帯マッチ**: 現在時刻（時間帯・曜日）に過去よく注文していた店舗を抽出し、その店舗が現在営業中か確認する。
   - **ご無沙汰マッチ**: 過去の注文回数が多いが最近注文がない店舗を抽出し、現在営業中であれば提案に加える。
   - **知識ベースの反映**: `.ai-secretary/uber-eats-knowlegde/` を参照し、閉鎖店舗を除外する。

3. **提案の構成**
   - 理由を添えて提案する（例: 「19時台によく頼んでいる店舗」「以前よく頼んでいたが最近ご無沙汰な店舗」）。
   - メニュー詳細データ（`.ai-secretary/uber_eats_data`）がある場合は、その店舗でよく頼んでいたメニューも併せて提示する。

## 特殊な対話への対応

- **「そのお店はなくなった」「もう頼めない」と言われた場合**
  - 対象店舗名をタイトルにしたファイルを `.ai-secretary/uber-eats-knowlegde/<store_name>.md` に作成する。
  - 内容に「閉店した」「デリバリー外」などの理由と日付を記録する。
  - 以降のレコメンドではこのディレクトリ内の店舗名をブラックリストとして扱う。

## 依存スキル・データ

- スキル: `.gemini/skills/uber-eats-analysys/SKILL.md`
- データ:
  - `.ai-secretary/uber-analysis/` (集計データ)
  - `.ai-secretary/uber_eats_data/` (メニュー詳細)
  - `.ai-secretary/uber-eats-knowlegde/` (店舗知識)

## 運用ルール

- 提案時は「なぜおすすめなのか」というロジックを簡潔に説明する。
- リアルタイムの営業状況や配達料は把握できないため、最終的な確認はアプリで行うよう促す。

## クッキーの準備 (開発用メモ)

Playwright でクッキーを読み込む際は、以下の Python スクリプト等で形式を整えて `.ai-secretary/uber-auth-state.json` に保存して使用する。

```python
import json
with open(".cookie/user-eats.cookie.json", "r") as f:
    cookies = json.load(f)
for c in cookies:
    if "id" in c: del c["id"]
    ss = c.get("sameSite", "").lower()
    if ss == "no_restriction": c["sameSite"] = "None"
    elif ss == "lax": c["sameSite"] = "Lax"
    elif ss == "strict": c["sameSite"] = "Strict"
    else: c["sameSite"] = "Lax"
state = {"cookies": cookies, "origins": []}
with open(".ai-secretary/uber-auth-state.json", "w") as f:
    json.dump(state, f)
```
