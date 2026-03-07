---
name: vision-room-status
description: ASEE Viewer ウィンドウをキャプチャし、Ollama Vision で部屋の状態（照明、配置、映り込み）を説明する。室内状況の視覚確認や監視画面デバッグ時に使う。
---

# vision-room-status

## 用途
- 部屋の現在の様子を視覚的に把握する。
- ASEE Viewer が意図どおり表示されているかを確認する。

## 実行手順
1. ASEE Viewer のウィンドウ ID を取得する。
```bash
WIN_ID="$(DISPLAY=:0 wmctrl -l | awk '/ASEE Viewer/{print $1; exit}')"
```

2. そのウィンドウを撮影する。
```bash
DISPLAY=:0 import -window "$WIN_ID" /tmp/vision_room.png
```

3. 画像を Vision で解析する。
```bash
/home/yuiseki/Workspaces/.codex/skills/vision-room-status/scripts/analyze_image.sh \
  /tmp/vision_room.png \
  "この画像からお部屋の状況を簡潔に説明してください。"
```

## 補足
- `WIN_ID` が空の場合は ASEE Viewer ウィンドウが存在しない。先に `repos/asee/tmp_main.sh` で起動する。
- 既定モデルは `qwen3.5:4b`。
