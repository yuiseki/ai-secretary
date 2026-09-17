---
name: vision-room-status
description: GOD MODE ウィンドウをキャプチャし、Ollama Vision で部屋の状態（照明、配置、映り込み）を説明する。室内状況の視覚確認や監視画面デバッグ時に使う。
---

# vision-room-status

## 用途
- 部屋の現在の様子を視覚的に把握する。
- GOD MODE が意図どおり表示されているかを確認する。

## 実行手順
1. GOD MODE のウィンドウ ID を取得する。
```bash
WIN_ID="$(DISPLAY=:0 wmctrl -l | awk '/GOD MODE/{print $1; exit}')"
```

2. そのウィンドウを撮影する。
```bash
DISPLAY=:0 import -window "$WIN_ID" /tmp/vision_room.png
```

3. 画像を Vision で解析する。
```bash
/home/yuiseki/Workspaces/.gemini/skills/vision-room-status/scripts/analyze_image.sh \
  /tmp/vision_room.png \
  "この画像からお部屋の状況を簡潔に説明してください。"
```

## 補足
- `WIN_ID` が空の場合は GOD MODE ウィンドウが存在しない。先に GOD MODE を起動する。
- 既定モデルは `qwen3.5:4b`。
