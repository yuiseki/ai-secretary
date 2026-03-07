---
name: vision-desktop-status
description: デスクトップ全体のスクリーンショットを撮影し、Ollama Vision で表示中のウィンドウやレイアウトを説明する。画面構成の確認やウィンドウ操作の結果検証をしたいときに使う。
---

# vision-desktop-status

## 用途
- 現在のデスクトップ全体（ウィンドウ配置、前面アプリ、タスクバーなど）を把握する。
- レイアウト操作の結果が期待どおりかを確認する。

## 実行手順
1. デスクトップ全体を撮影する。
```bash
DISPLAY=:0 scrot /tmp/vision_desktop.png
```

2. 画像を Vision で解析する。
```bash
/home/yuiseki/Workspaces/.gemini/skills/vision-desktop-status/scripts/analyze_image.sh \
  /tmp/vision_desktop.png \
  "このデスクトップ画面に映っているアプリやウィンドウの内容を簡潔に説明してください。"
```

## 補足
- 既定モデルは `qwen3.5:4b`。
- モデルを変える場合は第3引数に指定する。
```bash
/home/yuiseki/Workspaces/.gemini/skills/vision-desktop-status/scripts/analyze_image.sh \
  /tmp/vision_desktop.png \
  "画面の要点を箇条書きで説明してください。" \
  gemma3:4b
```
