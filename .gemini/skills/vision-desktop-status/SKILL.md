# vision-desktop-status

デスクトップ全体の視覚的状況認識

## 用途
- 現在のデスクトップ全体の表示状況（ウィンドウ配置、最前面のアプリ、壁紙、タスクバー等）を把握する。
- ウィンドウ操作の結果が正しいかデバッグする。

## 実行手順
1. `DISPLAY=:0 scrot tmp/vision_desktop.png` でスクリーンショットを撮影。
2. `python3 tmp/vision_helper.py tmp/vision_desktop.png "このデスクトップ画面に映っているアプリやウィンドウの内容を詳細に説明してください。"` を実行。
