---
name: vision-window-detail
description: 指定ウィンドウだけをキャプチャして、Ollama Vision で表示内容を詳細に確認する。特定アプリの表示崩れ、再生状態、ボタン表示の確認時に使う。
---

# vision-window-detail

## 用途
- 特定ウィンドウ（例: VOICEVOX、VacuumTube）の状態を詳細に把握する。
- 画面内の要素や表示文言が正しいか確認する。

## 実行手順
1. 対象ウィンドウを一覧表示する。
```bash
DISPLAY=:0 wmctrl -l
```

2. 対象のウィンドウ ID を指定して撮影する。
```bash
WINDOW_ID="<ID>"
DISPLAY=:0 import -window "$WINDOW_ID" /tmp/vision_window_detail.png
```

3. 画像を Vision で解析する。
```bash
/home/yuiseki/Workspaces/.gemini/skills/vision-window-detail/scripts/analyze_image.sh \
  /tmp/vision_window_detail.png \
  "このウィンドウに何が表示されているか、重要な要素を中心に説明してください。"
```

## 補足
- 既定モデルは `qwen3.5:4b`。
- 必要に応じて第3引数にモデルを指定する。
