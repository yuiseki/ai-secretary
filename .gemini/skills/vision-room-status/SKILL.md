# vision-room-status

お部屋の視覚的状況認識（GOD_MODE 経由）

## 用途
- お部屋の現在の様子（照明、家具、配置、映り込み）を視覚的に把握する。
- `GOD_MODE` がアクティブであることを視覚的に確認する。

## 実行手順
1. `DISPLAY=:0 wmctrl -l | grep "GOD MODE"` でウィンドウ ID を特定。
2. `DISPLAY=:0 import -window <ID> tmp/vision_room.png` でスクリーンショットを撮影。
3. `python3 tmp/vision_helper.py tmp/vision_room.png "この画像からお部屋の状況を丁寧に説明してください。"` を実行。
