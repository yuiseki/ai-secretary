# vision-window-detail

特定のウィンドウの視覚的詳細状況認識

## 用途
- `VOICEVOX` や `VacuumTube` などの個別アプリの表示内容、設定、再生状況を把握する。
- 特定のウィンドウ内のボタンやテキストが正しく表示されているか確認する。

## 実行手順
1. `DISPLAY=:0 wmctrl -l` で対象ウィンドウのタイトルを特定。
2. `DISPLAY=:0 import -window <WINDOW_ID> tmp/vision_window_detail.png` でスクリーンショットを撮影。
3. `python3 tmp/vision_helper.py tmp/vision_window_detail.png "このウィンドウに何が映っているか詳細に説明してください。"` を実行。
