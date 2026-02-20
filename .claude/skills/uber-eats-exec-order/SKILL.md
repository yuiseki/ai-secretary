---
name: uber-eats-exec-order
description: Uber Eats で指定商品を注文する自動化手順。Playwright で商品追加から checkout、magic upsell のスキップ、注文確定、成功確認まで実行する。ユーザーが「Uber Eats でこの商品を注文して」「自動で注文を確定して」と依頼したときに使う。
---

# Uber Eats Exec Order

## 前提条件
- `.cookie/user-eats.cookie.json` を配置する。
- `playwright-cli` を利用可能にする。
- 必要に応じて `gog` CLI で確認メールを検索できる状態にする。

## 手順

1. Cookie を Playwright の `storageState` 形式へ変換して `.ai-secretary/uber-auth-state.json` を作成する。

```python
import json

with open(".cookie/user-eats.cookie.json", "r") as f:
    cookies = json.load(f)

cleaned_cookies = []
for c in cookies:
    if "name" not in c or "value" not in c:
        continue
    new_c = {
        "name": c["name"],
        "value": c["value"],
        "domain": c["domain"],
        "path": c["path"],
        "secure": c.get("secure", True),
        "httpOnly": c.get("httpOnly", False),
        "sameSite": "None" if c.get("sameSite") in ["no_restriction", "none"] else "Lax",
    }
    if "expirationDate" in c:
        new_c["expires"] = c["expirationDate"]
    cleaned_cookies.append(new_c)

with open(".ai-secretary/uber-auth-state.json", "w") as f:
    json.dump({"cookies": cleaned_cookies, "origins": []}, f)
```

2. 店舗ページで対象商品をカートに追加する。

```javascript
const item = page.locator('text=すた丼元祖盛り(腹十分目)').first();
await item.click({ force: true });
await page.waitForTimeout(2000);
const addBtn = page.locator('button[data-testid="add-to-cart-button"]').first();
await addBtn.click({ force: true });
```

3. `/checkout` で `magicUpsell` が表示されたら必ず「スキップ」を押して閉じる。

```javascript
const skipButton = page.locator('button:has-text("スキップ"), button:has-text("Skip")').first();
if (await skipButton.isVisible()) {
    await skipButton.click({ force: true });
    await page.waitForTimeout(3000);
}
```

4. `button:has-text("注文を確定する")` を部分一致で取得して最終確定する。

```javascript
const confirmButton = page.locator('button:has-text("注文を確定する")').last();
if (await confirmButton.isVisible()) {
    await confirmButton.click({ force: true });
    await page.waitForTimeout(15000);
}
```

5. 成功を検証する。
- URL が `ubereats.com/jp/orders/...` へ遷移しているか確認する。
- 画面に「ご注文の品を準備しています…」など注文進行中の文言があるか確認する。
- 必要に応じて `gog gmail search 'from:noreply@uber.com "領収書"'` でメールを確認する。

## トラブル対応
- ボタンが押せない場合は `force: true` を優先する。
- ログイン画面へ戻る場合は Cookie 期限切れと `sameSite` を再確認する。
- 商品が見つからない場合は住所設定（`lat`/`lng`）を再確認する。
