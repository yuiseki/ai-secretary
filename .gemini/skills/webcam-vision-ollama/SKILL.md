---
name: webcam-vision-ollama
description: "Webカメラ画像を取得して Ollama の qwen3-vl シリーズで内容を日本語テキスト化する。ユーザーが『部屋の様子を見て』『Webカメラで何が映っているか教えて』『カメラ画像を qwen3-vl で説明して』など依頼したときに使う。複数カメラ（--all-cameras）に対応し、必要に応じて結合画像（--stitch horizontal|vertical）を作って『同じ部屋の別画角』前提で説明させる。待ち時間短縮のため結合画像だけ説明する --stitch-only にも対応。Logitech C920 複数台の video-index0 を順に撮影し、ffmpeg で静止画取得、Ollama /api/generate への画像送信、qwen3-vl:4b 優先選択、反復観測（repeat）に対応。--daemon では1分ごと撮影・キャプションを `~/.cache/yuiclaw/camera/YYYY/MM/DD/HH/MM.(png|txt)` に保存し、前回キャプションとの差分を優先して説明させる。"
---

# webcam-vision-ollama Skill

Webカメラ画像を `Ollama` の視覚モデル（主に `qwen3-vl`）で説明させるスキルです。

この環境では、既に動作確認済みのスクリプトを使います。

- 実行スクリプト: `tmp/webcam_ollama_vision/describe_webcam_with_ollama.py`

## 使う場面

- `部屋の様子を見て`
- `Webカメラで何が映っているか教えて`
- `カメラ画像を qwen3-vl で説明して`
- `定期的に部屋の様子を見てログ化したい（repeat実験）`
- `常駐で1分ごとにカメラ画像とキャプションを保存したい`

## 前提

- `Ollama` サーバー起動中（既定: `http://127.0.0.1:11434`）
- `qwen3-vl:*` モデルが少なくとも 1 つインストール済み
- `ffmpeg` 利用可能
- Webカメラが `/dev/video*` として認識されている

この環境の実測（2026-02-25）:

- Webカメラ: `Logitech HD Pro Webcam C920`
- 安定デバイスパス例:
  - `/dev/v4l/by-id/usb-046d_HD_Pro_Webcam_C920_8DB9885F-video-index0`
- `video1` は非 capture のことがある（`index0` を使う）

## 重要ルール

- 画像の内容説明は「見えている範囲」に限定し、推測しすぎない
- 人物の属性（年齢・職業・感情など）の断定は避ける
- 継続監視・保存はプライバシー配慮が必要。ユーザーの意図を確認してから範囲を広げる
- まずは 1 枚撮影 + 1 回説明で動作確認する

## 最短コマンド（1回）

```bash
python3 tmp/webcam_ollama_vision/describe_webcam_with_ollama.py
```

既定動作:

- Webカメラ自動検出（C920 `video-index0` 優先）
- `qwen3-vl:4b` 優先選択（インストール済みなら）
- `1280x720` / `mjpeg` で静止画1枚取得
- 日本語の説明文を標準出力へ表示

## 部屋の様子を複数カメラで見る（推奨）

「部屋の様子を見て」は、カメラが複数台ある場合は `--all-cameras` を優先する。  
さらに、より筋の通った全体説明が欲しい場合は `--stitch horizontal` を使う（推奨）。  
待ち時間を抑えたいなら `--stitch-only` を併用して、個別カメラ説明を省略する。

```bash
python3 tmp/webcam_ollama_vision/describe_webcam_with_ollama.py --all-cameras --stitch horizontal --stitch-only
```

出力は以下を含む:

- `stitched`（結合画像1枚の説明）
- 各カメラごとの個別説明（デバイス/画像保存先/説明文）
  - `--stitch-only` 時は個別説明は省略され、画像保存先のみ出る

## よく使うオプション

### モデル指定

```bash
python3 tmp/webcam_ollama_vision/describe_webcam_with_ollama.py --model qwen3-vl:8b
```

### 繰り返し観測（repeat）

```bash
python3 tmp/webcam_ollama_vision/describe_webcam_with_ollama.py \
  --repeat 5 \
  --interval-sec 3
```

### 常駐監視（daemon, 1分ごと保存）

```bash
python3 tmp/webcam_ollama_vision/describe_webcam_with_ollama.py --daemon
```

既定の保存先:

- `~/.cache/yuiclaw/camera/YYYY/MM/DD/HH/MM.png`
- `~/.cache/yuiclaw/camera/YYYY/MM/DD/HH/MM.txt`

補足:

- `qwen3-vl:4b` 優先でキャプショニング
- 直前のキャプションを次回プロンプトに渡し、「前回との差分」を先に説明させる

テスト実行（1回だけで終了）:

```bash
python3 tmp/webcam_ollama_vision/describe_webcam_with_ollama.py \
  --daemon --max-runs 1 --archive-root /tmp/yuiclaw-camera-test
```

### 複数カメラ + 結合画像（横/縦）

```bash
# 横に結合（推奨）
python3 tmp/webcam_ollama_vision/describe_webcam_with_ollama.py --all-cameras --stitch horizontal

# 横に結合 + 結合画像だけ説明（速い）
python3 tmp/webcam_ollama_vision/describe_webcam_with_ollama.py --all-cameras --stitch horizontal --stitch-only

# 縦に結合
python3 tmp/webcam_ollama_vision/describe_webcam_with_ollama.py --all-cameras --stitch vertical
```

### JSON出力（後段処理しやすい）

```bash
python3 tmp/webcam_ollama_vision/describe_webcam_with_ollama.py --json
```

### 明示デバイス指定（自動検出を上書き）

```bash
python3 tmp/webcam_ollama_vision/describe_webcam_with_ollama.py \
  --device /dev/v4l/by-id/usb-046d_HD_Pro_Webcam_C920_8DB9885F-video-index0
```

### カメラ一覧だけ確認

```bash
python3 tmp/webcam_ollama_vision/describe_webcam_with_ollama.py --list-cameras
```

### プロンプト変更（用途特化）

```bash
python3 tmp/webcam_ollama_vision/describe_webcam_with_ollama.py \
  --prompt '机の上の物、モニター周辺、手元の状態を日本語で箇条書き風に説明してください。見えないものは推測しないでください。'
```

## モデル選択の目安（qwen3-vl）

- `qwen3-vl:4b`:
  - 既定の推奨。速度と説明品質のバランスが良い
- `qwen3-vl:8b`:
  - 品質寄り。待ち時間が増えてもよい場合
- `qwen3-vl:2b`:
  - 速度寄り。粗くても素早く把握したい場合
- `qwen3-vl:30b` / `32b`:
  - 高品質だが重い。用途が明確なときだけ

## 典型ワークフロー（推奨）

1. `ollama list` または `--list-models` で `qwen3-vl:*` を確認
2. 1回実行して説明品質を確認
3. 必要なら `--model` を `8b` / `2b` に切り替えて比較
4. 定期観測が必要なら `--repeat` を使う
5. 別処理に渡すなら `--json`

## トラブルシュート

### 1) `Error: ollama server unreachable`

- `ollama` が起動していない、または `11434` に来ていない

確認:

```bash
curl -fsS http://127.0.0.1:11434/api/tags | jq '.models | length'
```

### 2) `no qwen3-vl:* model is installed`

- モデル未導入

確認:

```bash
ollama list | rg '^qwen3-vl:'
```

### 3) Webカメラが見つからない / 思ったカメラが使われない

- `/dev/video0` が無い、または別番号になっている
- 安定パス `/dev/v4l/by-id/*video-index0` を使う
- 複数台あるときは `--list-cameras` で列挙し、必要なら `--device` を明示する

確認:

```bash
ls -l /dev/video* /dev/v4l/by-id
```

### 4) `ffmpeg` の入力フォーマットで失敗する

- スクリプトは `mjpeg` 失敗時にフォールバックを試す
- それでもダメなら `--input-format yuyv422` を試す

### 5) 説明が重い / 遅い

- `--model qwen3-vl:2b` を試す
- 解像度を落とす（例: `--width 960 --height 540`）
- `--all-cameras --stitch ...` は推論回数が増える（個別 + 結合）ため遅くなる
- 全体説明だけ欲しい場合は `--stitch-only` を併用する

## 成功条件（報告時）

- 使用モデル（例: `qwen3-vl:4b`）
- 使用デバイス（例: `...video-index0`）
- 画像保存先
- 要約された説明文（主要な物体/人物/状態）
- 必要なら処理時間

## ローカル参照

- 実行スクリプト: `tmp/webcam_ollama_vision/describe_webcam_with_ollama.py`
- テスト: `tmp/webcam_ollama_vision/test_describe_webcam_with_ollama.py`
- Webカメラ調査ログ: `agent/activity/2026/02/2026-02-25.md`
