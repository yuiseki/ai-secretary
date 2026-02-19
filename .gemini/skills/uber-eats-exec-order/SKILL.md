# Uber Eats Execution Order

## 概要
Uber Eats で特定の商品を指定の住所に注文する自動化手順。
特にチェックアウト時の「アップセル（ついで買い提案）」による妨害を回避し、確実に注文を確定させる。

## 前提条件
- `.cookie/user-eats.cookie.json` が存在すること。
- `playwright-cli` が利用可能であること。
- `gog` CLI がメール確認用にセットアップされていること（推奨）。

## 実行手順

### 1. 認証状態の作成
Cookieファイルを Playwright 用の `storageState` 形式に変換する。

```python
import json
import os

with open(".cookie/user-eats.cookie.json", "r") as f:
    cookies = json.load(f)

cleaned_cookies = []
for c in cookies:
    if "name" not in c or "value" not in c: continue
    new_c = {
        "name": c["name"],
        "value": c["value"],
        "domain": c["domain"],
        "path": c["path"],
        "secure": c.get("secure", True),
        "httpOnly": c.get("httpOnly", False),
        "sameSite": "None" if c.get("sameSite") in ["no_restriction", "none"] else "Lax"
    }
    if "expirationDate" in c: new_c["expires"] = c["expirationDate"]
    cleaned_cookies.append(new_c)

with open(".ai-secretary/uber-auth-state.json", "w") as f:
    json.dump({"cookies": cleaned_cookies, "origins": []}, f)
```

### 2. 商品のカート追加
店舗ページに遷移し、セレクターを用いて商品をカートに入れる。

- **すた丼の例**:
```javascript
const item = page.locator('text=すた丼元祖盛り(腹十分目)').first();
await item.click({ force: true });
await page.waitForTimeout(2000);
const addBtn = page.locator('button[data-testid="add-to-cart-button"]').first();
await addBtn.click({ force: true });
```

### 3. チェックアウトと「スキップ」処理
`/checkout` ページでは、追加商品の提案（Magic Upsell）が表示される場合がある。これをスキップしないと「注文を確定する」ボタンがクリックできない。

- **重要**: URL に `mod=magicUpsell` が含まれている場合や、画面中央にポップアップがある場合は必ず「スキップ」をクリックする。

```javascript
// スキップボタンの処理
const skipButton = page.locator('button:has-text("スキップ"), button:has-text("Skip")').first();
if (await skipButton.isVisible()) {
    await skipButton.click({ force: true });
    await page.waitForTimeout(3000);
}
```

### 4. 注文の確定
最終的な確定ボタンは `button:has-text("注文を確定する")` で指定する。文言が「本ページの内容を確認の上、注文を確定する」のように長い場合があるため、部分一致で取得する。

```javascript
const confirmButton = page.locator('button:has-text("注文を確定する")').last();
if (await confirmButton.isVisible()) {
    await confirmButton.click({ force: true });
    await page.waitForTimeout(15000); // 処理待ち
}
```

### 5. 成功の検証
- **URL確認**: `ubereats.com/jp/orders/...` に遷移していれば成功。
- **ページタイトル**: 「ご注文の品を準備しています…」等の文言を確認。
- **メール確認**: `gog gmail search 'from:noreply@uber.com "領収書"'` で最新メールを確認。

## トラブルシューティング
- **ボタンがクリックできない**: `force: true` オプションを使用する。
- **ログイン画面に戻る**: Cookieの有効期限切れか、`sameSite` 属性の不一致。
- **商品が見つからない**: 住所設定（`lat`/`lng`）が正しいか確認する。
