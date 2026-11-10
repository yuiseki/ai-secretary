# ショットの JSON

## 全体

```json
{
  "width": 1920, "height": 1080, "fps": 30,
  "base": "seamlessphoto",
  "dem": "gsi",
  "exaggeration": 1.3,
  "hillshade": 0.25,
  "saturation": -0.1, "contrast": 0.08,
  "credits": ["線と数字は説明のための模式図(位置は概略)"],
  "shots": [ ... ]
}
```

- `world` / `worldFade`: 引いた画の NASA Blue Marble と、地理院の写真に切り替わる zoom の範囲 (`gsi-tiles.md`)。
- `background`: 写真がどのズームにも無い所 (遠くの海) の色。既定は暗い海の青 `#10243a`。
- `base`: 下地のタイル。`seamlessphoto` (既定) / `std` / `pale` / `relief`。一覧は `gsi-tiles.md`。
- `hillshade`: 陰影の強さ (0〜1)。`false` で消す。写真だけだと平たく見えるので薄く足している。
- `sky`: 空と霧の設定 (MapLibre の sky)。省略すると水色の空に白い霧。
- `credits`: 自動で入る出典に足す行。
- `voices` / `tts` / `bgm` / `subtitles`: 声と字幕 (`narration.md`)。
- `--size` と `--fps` は JSON より優先される。

## ショット

| キー | 意味 |
|---|---|
| `duration` | 秒。`lines` があれば声に合わせて伸びる (これより短くはならない) |
| `lines` | セリフ `[{ "voice", "text", "speech" }]` (`narration.md`) |
| `from` / `to` | カメラ。`center` [経度, 緯度]、`zoom`、`pitch` (0〜85 度)、`bearing` (北が 0、時計回り) |
| `keys` | 途中を通るとき: `[{ "t": 0, ...カメラ }, { "t": 0.5, ... }, { "t": 1, ... }]`。`from`/`to` の代わり |
| `ease` | `inOut` (既定) / `linear` / `in` / `out`。ショット全体にかかる |
| `tint` | 地形を暗くする量 (0〜1)。`chapter` を置くと自動で 0.55 |
| `overlays` | 重ね物の配列 |

bearing は近い向きに回る (350 度 → 10 度は 20 度だけ回る)。

## 重ね物の共通キー

- `show`: [開始, 終了] をショットの進み (0〜1) で。省略すると最初から最後まで。
- `fade`: 出入りにかける長さ (同じ単位、既定 0.06)。終了が 1 のときは消えずに次のショットへ切り替わる。

## 種類

```json
{ "type": "line", "coords": [[lng, lat], ...], "color": "#4aa3ff", "width": 6, "draw": [0.1, 0.5] }
{ "type": "polygon", "coords": [[lng, lat], ..., 最初の点], "fill": "#4aa3ff", "fillOpacity": 0.35, "outline": "#ffffff", "width": 4 }
{ "type": "label", "at": [lng, lat], "text": "大沢崩れ", "dot": true }
{ "type": "label", "screen": [190, 70], "text": "1974〜78年", "style": "tag" }
{ "type": "counter", "screen": [70, 120], "caption": "谷の長さ", "prefix": "約", "value": 2, "unit": "km" }
{ "type": "counter", "value": 1969, "from": 1950, "grouping": false, "unit": "年", "countUp": [0.2, 0.7] }
{ "type": "counter", "value": "40〜50", "unit": "m" }
{ "type": "chapter", "kicker": "第2章", "text": "谷がなければ受け皿を造る" }
{ "type": "note", "text": "模式図" }
{ "type": "subtitle", "text": "字幕の 1 行。\n改行もできる", "color": "#ffe94a" }
{ "type": "quote", "source": "帝国データバンク", "date": "2026-11-03", "text": "記事の一文", "screen": [70, 160], "width": 780 }
{ "type": "quote", "source": "…", "text": "要約した内容", "marks": false }
{ "type": "panel", "src": "assets/chart.png", "caption": "図の見出し", "credit": "出典", "screen": [1090, 150], "width": 780 }
{ "type": "chart", "caption": "見出し", "credit": "出典", "points": [["2021-01", 158], ["2026-09", 180]], "ymin": 145, "ymax": 192, "yticks": [150, 170, 190], "unit": "円", "labels": [0, 1], "xlabels": [["2021", 0], ["2026", 1]], "drawSec": 3 }
{ "type": "sticker", "src": "assets/irasutoya/ramen_moyashi.png", "screen": [1500, 400], "width": 280, "credit": "イラスト：いらすとや" }
{ "type": "base", "layer": "gazo1", "show": [0.45, 1], "fade": 0.2 }
{ "type": "image", "src": "assets/mosaic_1948.png", "bbox": [west, south, east, north], "credit": "1948年の空中写真：米軍撮影(国土地理院)をつないで加工" }
```

- 画面の座標 (`screen`) は 1920x1080 の上の px。出力の大きさが違っても同じ比率に縮む。
- `line` の `draw` は線が伸びていく区間。省略すると最初から全部見える。長さは平面の距離で測っている (短い線なら十分)。
- `counter` の `decimals` で小数の桁、`countEase: "linear"` で等速に数える (既定はだんだん遅く)。
- `image` の `src` はプロジェクトのフォルダからの相対パス。北が上の画像だけ。
- `quote` はニュースの引用カード (媒体名と日付の下に本文)。本文は「」で囲む。記事の文そのままでないとき (要約) は `"marks": false` で「」を外す。
- `panel` は画面に置く図 (グラフの PNG など)。画像の読み込みを待ってから撮る。グラフは別に作る (例: matplotlib で暗い背景、1 系列、凡例なし、見出しは `caption`)。

## 位置の取り方

- 地理院地図 (https://maps.gsi.go.jp/) で場所を開くと、URL に `#zoom/緯度/経度` が出る (緯度が先なので、JSON では入れ替える)。
- 線や範囲の座標は、地理院地図の作図機能で描いて GeoJSON で書き出すと楽。
- カメラの値は `--stills` で何度か試して決める。zoom 0.5 の違いで、写る範囲は約 1.4 倍変わる。

## 動き (モーショングラフィックス)

画面に置く重ね物は、出てからの秒数で動く。同じ JSON なら同じ動きになる。

| type | 入り | そのあと / 出 |
|---|---|---|
| `chapter` | 地形が暗くなり、肩書きの字間が詰まり、題が左から現れ、下の線が伸びる | 上へ抜けて消える |
| `label` (tag) | 0.5 倍から弾んで出る | |
| `label` (dot) | 文字が左から現れる | 点から輪が広がり続ける |
| `counter` | 下から上がってくる、線が伸びる、数を数える | |
| `quote` | 左から滑り込み、色の帯が伸び、本文がタイプライターで出る (`cps` 文字/秒、既定 30) | 左へ抜ける |
| `panel` | 左から右へ拭うように出て、写真がゆっくり寄る | |
| `chart` | 拭うように出て、目盛りが出て、線が `drawSec` 秒で引かれ、点と数字が線の到着で弾む | 最後の点が脈打つ |
| `sticker` | 弾んで出る | ゆらゆら浮く |
| `subtitle` | 少し下から上がる | |

`show` の終わりが 1 未満なら、その時刻に向けて 0.3 秒で抜ける。1 なら次のショットへのカットで終わる。
