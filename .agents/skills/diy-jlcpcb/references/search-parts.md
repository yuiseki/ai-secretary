# 部品の探し方

2 段で探す。まず手元の部品 DB (jlcparts の `cache.sqlite3`) で、属性と型番から候補を広く拾う。次に、残った候補だけを、その日のライブ検索 (`jlc` CLI) で在庫と値段を確かめ、データシートを読む。

在庫が無い部品と、データシートが読めない部品は、候補の表から外す。「未確認」のまま比べると、判断の材料にならない。

## 1. 部品 DB で拾う

DB は大きい (2026 年 7 月の版で約 5.5 GB、約 715 万件)。読み取り専用で開く。

```bash
sqlite3 -readonly cache.sqlite3 ".schema jlc_components"
```

主な列: `lcsc` (C を除いた番号の整数)、`mfr` (型番)、`manufacturer`、`package`、`category`、`subcategory`、`stock`、`price` (数量帯ごとの米ドル)、`library_type` (basic、preferred、expand など)、`description`、`attributes` (JSON の文字列)、`datasheet`。

LCSC 番号での検索は一瞬。`mfr LIKE` や `attributes LIKE` で全件をなめると数秒から十数秒かかる。

```sql
-- 例: 2.54 mm、1 列 7 極のメスのピンソケットで、在庫があるもの
SELECT lcsc, mfr, manufacturer, stock, substr(price, 1, 30), library_type, description
FROM jlc_components
WHERE subcategory LIKE '%Female Header%'
  AND attributes LIKE '%"Number of Positions":"7P"%'
  AND attributes LIKE '%"Number of Rows":"1"%'
  AND attributes LIKE '%2.54mm%'
  AND stock > 0
ORDER BY stock DESC LIMIT 40;
```

- 属性 (`attributes`) は部品によって欠けている。高さなどが空の部品は、型番の命名 (例: `-5.0H-`、`-H85`) でも探す
- `description` が空の部品もある。空でも使えないとは限らない。データシートで確かめる
- `assembly_mode` が空でも、実装に使えないとは限らない (実際に発注に使えた部品で空だった例がある)。断定せず、JLCPCB の確認画面で見る
- DB は数か月前の版のことがある。在庫と値段は、ここでは決めない

## 2. ライブ検索で確かめる

`jlc` (npm の `@jlcpcb/cli`、非公式) は既定では対話の画面を開き、端末の無い環境では「Raw mode is not supported」で落ちる。`--json` を付ける。

```bash
jlc search "HC-PM254-5.0H-1x7PZ" --json --limit 5   # stock, price, library_type, attributes が出る
jlc search "74HC138" --json --in-stock --limit 20
```

`jlc info <LCSC番号> --json` は部品の詳細を返すが、在庫の欄が入っていないことがある。在庫は `search --json` の結果で見る。

## 3. データシートを読む

LCSC の PDF の URL (`lcsc.com/datasheet/...`、`wmsc.lcsc.com/...`) は、curl でも HTML しか返さないことが多い。部品 DB の `datasheet` 列にある `https://jlcpcb.com/api/file/downloadByFileSystemAccessId/...` は、curl でそのまま PDF が取れる。

```bash
url=$(sqlite3 -readonly cache.sqlite3 "select datasheet from jlc_components where lcsc=27985232")
curl -sL -o C27985232.pdf "$url" && file C27985232.pdf
pdftoppm -r 90 -png C27985232.pdf C27985232   # 図面は画像にして目で読む
```

寸法、穴の推奨径、受けられるピンの太さ、接点の位置は、図面で確かめる。DB の属性だけで決めない。

## 4. 比べる表に入れるもの

- 型番、LCSC 番号、メーカー
- その日の在庫と、使う数量帯の値段
- library_type (basic か extended か。extended は部品の種類ごとに追加の料金がかかる)
- データシートで確かめた寸法と、確かめた日
- 外した候補は「外した理由」を 1 行だけ残す
