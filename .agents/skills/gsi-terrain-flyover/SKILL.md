---
name: gsi-terrain-flyover
description: 地理院タイルの空中写真と標高で地形を 3D にし、カメラを動かしながら線・範囲・地名・数字・章見出しを重ね、VOICEVOX の掛け合いの声と字幕を付けた解説動画のカット(mp4)を作る。土木・地理の解説動画のような「斜めから見た地形にゆっくり寄る、川を線で引く、範囲を囲う、数字を出す、昔の写真と今を切り替える」画を、ショットの JSON から何度でも同じに書き出す。「地形の 3D で視点移動する動画」「地理院地図のデータで空撮風のカット」「この場所を斜めから見せる映像」「昔の空中写真と今を比べる映像」「地形の映像に合成音声のナレーションと字幕を付けたい」のときに使う。
---

# gsi-terrain-flyover

下地は地理院タイルの写真と標高、引いた画は NASA Blue Marble。ショットの一覧 (JSON) → セリフを VOICEVOX で合成してショットの長さと字幕を決める → ヘッドレス Chromium の MapLibre で 1 コマずつ描く → ffmpeg で声 (と BGM) を重ねて mp4。

```
shots/*.json ─▶ voice.mjs (VOICEVOX) ─▶ render.mjs ─▶ page/ (MapLibre 5.24 + 地理院タイル) ─▶ frames/*.png ─▶ <名前>.mp4
```

- 1 コマごとにカメラを置き、タイルが全部読み終わるまで待ってから撮る。読み込み途中の画が映らず、同じ JSON からは同じ動画が出る。
- 見た目の文法 (何をどう重ねるか) は `references/look.md`。手本にした映像を見て書き出したもの。
- JSON の書き方は `references/shots.md`。声と字幕は `references/narration.md` (手本を測った数字と、VOICEVOX の速さの合わせ方)。タイルの種類と出典の書き方は `references/gsi-tiles.md`。困ったら `references/troubleshooting.md`。

## 1. プロジェクトを作る

1. `template/` の中身を作業フォルダにコピーする (置き場は `~/Workspaces/tmp/<名前>/` など。`.gitignore` を含む)。
2. `npm install`、続けて `npx playwright install chromium-headless-shell`。
3. `npm test` (補助関数の単体テスト) が通ることを確かめる。

前提: Node.js 20 以上、ffmpeg、日本語フォント (`fc-list :lang=ja`。Noto Sans CJK JP を使う)。声を付けるなら VOICEVOX のエンジン (`curl http://127.0.0.1:50021/version`。無ければ feed-news-video スキルの Docker の手順)。GPU があれば速い (下の 3)。

## 2. 試しに書き出す

実データを読む実行は、メモリと CPU に上限を掛けて流す (母艦のルール)。

```bash
systemd-run --user --scope -q -p MemoryMax=8G -p MemorySwapMax=0 -p CPUQuota=400% -- \
  node render.mjs shots/example.json --stills 1.5     # 1.5 秒おきの静止画と一覧 (out/example/stills.jpg)
systemd-run --user --scope -q -p MemoryMax=8G -p MemorySwapMax=0 -p CPUQuota=400% -- \
  node render.mjs shots/example.json                  # 30fps の mp4 (out/example/example.mp4)
```

- まず `--stills` で構図と重ね物を目で確かめ (stills.jpg を Read で見る)、よければ通しで書き出す。
- 一部だけ: `--from 5 --to 11` (画だけ、声なし)。小さく: `--size 1280x720`。コマ数: `--fps 24`。声を合成せず長さだけ見積もる下書き: `--no-voice`。
- `shots/narrated.json` は 2 人の掛け合いの例。声は `out/<名前>/voice-cache/` に残るので、2 回目からは合成しない。
- 実測 (RTX 3060、1920x1080): 1 コマ 0.55〜0.65 秒。15 秒のカットで約 4 分。

## 3. GPU で描く

ヘッドレス Chromium は既定でソフトウェア描画 (SwiftShader) になり、地形では遅すぎてスクリーンショットが 30 秒で時間切れになる。`render.mjs` は `--use-gl=angle --use-angle=gl-egl` で GPU を使う。起動時に `webgl: ANGLE (NVIDIA ...)` と出れば GPU。GPU の無い機械では `FLYOVER_GL=swiftshader` (とても遅い)。GPU のメモリは数百 MB しか使わないが、常駐 LLM が載っている機械では空きを `nvidia-smi` で見てから流す。

## 4. ショットを書く

1 ショット = 長さ (秒) + カメラの始まりと終わり (または途中のキー) + 重ね物。詳しくは `references/shots.md`。

```json
{ "duration": 6,
  "from": { "center": [138.712, 35.356], "zoom": 12.6, "pitch": 66, "bearing": 75 },
  "to":   { "center": [138.716, 35.357], "zoom": 13.1, "pitch": 68, "bearing": 85 },
  "overlays": [
    { "type": "line", "coords": [[138.7255, 35.3605], [138.704, 35.3545]], "color": "#ff8a1f", "draw": [0.1, 0.55] },
    { "type": "label", "at": [138.712, 35.3565], "text": "大沢崩れ", "dot": true, "show": [0.3, 1] },
    { "type": "counter", "caption": "谷の長さ", "prefix": "約", "value": 2, "unit": "km", "show": [0.45, 1] } ] }
```

セリフ: ショットに `lines` (`[{ "voice": "a", "text": "…", "speech": "読み" }]`) を書くと、声の長さに合わせてショットが伸び、話し手の色の字幕が 1 セリフ 1 枚で入る。手本は 1 ショット 1〜2 セリフ、1 秒 6.9 文字、セリフの間 0.24 秒 (`references/narration.md`)。

重ね物: `line` (引きながら描く線) / `polygon` (範囲) / `label` (地図に貼り付く地名、画面に固定の札) / `counter` (大きな数字、数え上げ) / `chapter` (暗くした地形に章見出し) / `note` (右上の「模式図」など) / `subtitle` (下の字幕帯) / `quote` (ニュースの引用カード) / `panel` (写真などの図) / `chart` (線が引かれていく折れ線グラフ) / `sticker` (イラスト) / `base` (昔の空中写真などへの切り替え) / `image` (自分で位置合わせした画像)。

重ね物はすべて、出てからの秒数で動く (タイプライター、拭い出し、弾み、数え上げ。`references/shots.md` の「動き」)。冒頭 20 秒のダイジェストと、素材 (いらすとや、Wikimedia Commons) の決まりは `references/look.md`。カメラの動きの決め方は `references/look.md` の「カメラ」。要点: 1 ショット 4〜8 秒で、ゆっくり寄るか回り込む。見せたい物を画面の中央より少し上に置く。斜めの角度 (pitch) は 55〜70 度。

## 5. 守ること

- 出典を画面に出す。使ったタイルの出典と「音声：VOICEVOX:キャラ名」は自動で右下に入る。足すものは JSON の `credits` に書く (`references/gsi-tiles.md`)。出典を消さない。VOICEVOX のクレジットは概要欄にも書く (`out/<名前>/credits.txt`)。
- 声の聞こえ方、速さ、読み違いは数字では確かめられない。書き出したら本人に聞いてもらう。
- 線・範囲・数字が実際の位置や値でないときは、`note` で「模式図」、`credits` で「位置は概略」と書く。
- 地理院タイルのサーバーに負荷をかけない。書き出しは同時に 1 本まで。何度も試すときは `--size 1280x720 --stills` で数を減らす。
- 手本の映像の素材 (キャラクター、BGM、ロゴ、字幕の色の組み合わせそのもの) は使わない。真似るのは画の文法だけ。
- 書き出した動画の公開はユーザーが行う。

## 6. いまの限界

- 標高は地理院の標高タイル (z14、約 10m メッシュ) だけ。海と国外は 0 m の平らな面になる (画は Blue Marble で埋まるが、山は立たない)。海外の地形は、標高の source を足す改修が要る (`references/gsi-tiles.md`)。
- 3D の建物、断面図、重機などの CG は作らない。手本の映像では、そこは別の 3D ソフトで作っている。
- `image` は北が上の画像だけ。緯度は線形に当てはめるので、広い範囲 (数十 km 以上) ではずれる。
- 昔の空中写真のタイルは場所によって抜けがある。全体を見せるには、自分で写真をつなぎ合わせて `image` で貼る。
