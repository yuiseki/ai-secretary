---
name: desktop-windows-layout
description: "X11/KDE デスクトップ（主に DISPLAY=:1）で、スクリーンショット撮影・ウィンドウ一覧/座標確認・移動/リサイズ・KWin クイックタイル・全画面化/復元を行う。ユーザーが『いまの画面のレイアウト確認して』『このウィンドウを右下に移動して』『全画面にして10秒後に戻して』など依頼したときに使う。"
---

# desktop-windows-layout Skill

デスクトップ画面のレイアウト確認とウィンドウ配置操作を行うスキルです。  
主に `KDE Plasma + KWin` の X11 セッションを前提に、`wmctrl` / `xdotool` / `xprop` / `scrot` / `qdbus` を使います。

## 前提

- 対象セッションは通常 `DISPLAY=:1`
- 利用コマンド（よく使う順）:
  - `wmctrl`
  - `xdotool`
  - `xprop`
  - `scrot`
  - `qdbus`（KWin ショートカット呼び出し）
  - `file`, `identify`（画像サイズ確認）

## 重要ルール

- `DISPLAY` を明示する（SSH 転送の `DISPLAY=localhost:10.0` に引っ張られない）
  - 例: `export DISPLAY=:1`
- 操作前に対象ウィンドウIDを取得して固定する（タイトル曖昧一致の事故を避ける）
- 操作後は必ず座標/サイズ/状態を再確認する
- `Esc`/キー連打でアプリの状態遷移が不安定になるケースがあるので、レイアウト操作は WM 側コマンド優先

## 典型ユースケース

- 「いまのデスクトップ画面のスクリーンショットを撮ってレイアウト確認して」
- 「VacuumTube のウィンドウを右下に移動して」
- 「全画面にして 10 秒後に元に戻して」
- 「どのアプリがどこにあるか一覧で見たい」

## 画面レイアウト確認（基本手順）

1. スクリーンショットを保存
2. ウィンドウ一覧（座標・サイズ付き）を取得
3. アクティブウィンドウの情報を取得
4. 画像サイズを確認

### 例

```bash
export DISPLAY=:1
TS=$(date +%Y%m%d-%H%M%S)
OUT=/tmp/desktop-layout-$TS.png
scrot "$OUT"
wmctrl -lG
xdotool getactivewindow getwindowname getwindowgeometry --shell
file "$OUT"
```

## ウィンドウ特定（安全なやり方）

タイトルから拾ってすぐ使わず、**ID を変数に固定**してから操作する。

```bash
export DISPLAY=:1
WIN_ID=$(wmctrl -l | awk '/VacuumTube$/ {print $1; exit}')
wmctrl -lG | awk -v id="$WIN_ID" '$1==id {print}'
xdotool getwindowgeometry --shell "$WIN_ID"
```

補足:

- `wmctrl -lG` は `ID desktop x y w h host title`
- `xprop -id "$WIN_ID" _NET_WM_STATE` で fullscreen 等の状態確認ができる

## 移動・リサイズ（通常）

まず `wmctrl`、効かなければ `xdotool` を試す。

```bash
export DISPLAY=:1
WIN_ID=0x...
wmctrl -i -r "$WIN_ID" -e 0,2048,1108,2048,1008 || true
xdotool windowmove "$WIN_ID" 2048 1108 || true
xdotool windowsize "$WIN_ID" 2048 1008 || true
```

### 注意（KWin タイル環境）

- KWin のタイル状態だと `wmctrl` / `xdotool` の move/resize が無視されることがある
- その場合は **KWin の Quick Tile ショートカット**を使う方が通りやすい

## KWin クイックタイル（KDE）

### ショートカット一覧確認

```bash
qdbus org.kde.kglobalaccel /component/kwin org.kde.kglobalaccel.Component.shortcutNames \
  | rg -i 'tile|fullscreen|bottom|right'
```

よく使うもの:

- `Window Quick Tile Bottom Right`
- `Window Quick Tile Bottom Left`
- `Window Quick Tile Top Right`
- `Window Quick Tile Top Left`
- `Window Fullscreen`

### 呼び出し（タイムアウト推奨）

`qdbus` が環境によって待ち続けることがあるため `timeout` を付ける。
また、実運用では `wmctrl -a` より `xdotool windowactivate --sync` の方が KWin ショートカット反映が安定する場合がある。

```bash
export DISPLAY=:1
WIN_ID=0x...
xdotool windowactivate --sync "$WIN_ID"
timeout 2s qdbus org.kde.kglobalaccel /component/kwin \
  org.kde.kglobalaccel.Component.invokeShortcut \
  'Window Quick Tile Bottom Right' default || true
```

### 注意

- `wmctrl -i -a "$WIN_ID"` は前面化用（`-a` に引数が必要）
- `wmctrl -i -r "$WIN_ID" -a` のような組み合わせは誤用になりやすい
- `invokeShortcut` は **成功しても出力が空** のことがある。必ず `wmctrl -lG` / `xdotool getwindowgeometry` で結果確認する
- `Window Quick Tile Top/Bottom/Left/Right` 系は環境やタイミングで反応ムラがあるため、1回で動かないときは再前面化して再試行する

## 全画面化 / 復元（推奨: EWMH 直接）

KWin ショートカットより `wmctrl` の EWMH fullscreen state 切替が安定する場合がある。
（実運用で `Window Fullscreen` ショートカット呼び出しが no-op だったケースあり）

### 10 秒だけ全画面化して戻す

```bash
export DISPLAY=:1
WIN_ID=0x...
wmctrl -i -a "$WIN_ID" || true
wmctrl -i -r "$WIN_ID" -b add,fullscreen
sleep 10
wmctrl -i -r "$WIN_ID" -b remove,fullscreen
```

確認:

```bash
xprop -id "$WIN_ID" _NET_WM_STATE
wmctrl -lG | awk -v id="$WIN_ID" '$1==id {print}'
```

### 注意

- `wmctrl` はクライアント領域のサイズを扱うため、タイトルバー分だけズレが生じることがあります。
- **ピクセルパーフェクトな配置が必要な場合は、後述の KWin Scripting 方式を強く推奨します。**

## 究極の4分割スナップ (KWin Scripting)

4K画面（4096x2160）において、下部タスクバー（44px）を除いた有効領域を正確に4分割（各 2048x1058）し、タイトルバーを消して隙間なく敷き詰める手法です。

### 1. 配置先（有効領域: 4096 x 2116）

- **左上 (Top-Left):** `x: 0, y: 0, w: 2048, h: 1058`
- **右上 (Top-Right):** `x: 2048, y: 0, w: 2048, h: 1058`
- **左下 (Bottom-Left):** `x: 0, y: 1058, w: 2048, h: 1058`
- **右下 (Bottom-Right):** `x: 2048, y: 1058, w: 2048, h: 1058`

### 2. 実行手順（JavaScript テンプレート）

以下のスクリプトを `/tmp/quadrant_snap.js` として保存し、`qdbus` で実行します。

```javascript
var clients = workspace.clientList();
for (var i = 0; i < clients.length; i++) {
    var c = clients[i];
    
    // 例: "GOD MODE" を左下に配置
    if (c.caption.indexOf("GOD MODE") !== -1) {
        c.fullScreen = false;
        c.noBorder = true;    // 枠を消して隙間を無くす
        c.keepAbove = true;   // 常に最前面
        c.onAllDesktops = true;
        var g = c.frameGeometry;
        g.x = 0; g.y = 1058; g.width = 2048; g.height = 1058;
        c.frameGeometry = g;
    }
    // 他のウィンドウも同様に caption で判定して配置
}
```

実行コマンド:
```bash
export DISPLAY=:0
PLUGIN="snap_$(date +%s)"
qdbus org.kde.KWin /Scripting org.kde.kwin.Scripting.loadScript "/tmp/quadrant_snap.js" "$PLUGIN"
qdbus org.kde.KWin /Scripting org.kde.kwin.Scripting.start
sleep 0.5
qdbus org.kde.KWin /Scripting org.kde.kwin.Scripting.unloadScript "$PLUGIN"
```

## 実務で使う確認コマンド集

```bash
# 一覧（位置・サイズ）
DISPLAY=:1 wmctrl -lG

# アクティブウィンドウ詳細
DISPLAY=:1 xdotool getactivewindow getwindowname getwindowgeometry --shell

# ウィンドウ状態（fullscreen など）
DISPLAY=:1 xprop -id <WIN_ID> _NET_WM_STATE

# 画像サイズ確認
file /tmp/desktop-layout-*.png
identify /tmp/desktop-layout-*.png  # ImageMagick があれば
```

## よくある失敗と対処

- `wmctrl`/`xdotool` で移動できない
  - KWin タイル状態の可能性。Quick Tile を使う
- `qdbus` が反応しない/待ち続ける
  - `timeout 2s ... || true` を使う
- `qdbus` は返り値なしでも成功することがある
  - 出力ではなく window geometry/state の変化で判定する
- 位置は変わらないがサイズだけ変わる / その逆
  - WM が制約している。操作後に必ず再確認して結果ベースで報告
- `DISPLAY` が `localhost:10.0` になっている
  - `export DISPLAY=:1` を明示

## 成功条件（報告時）

- 実行した操作（例: 右下タイル / 全画面化）
- 操作前後の座標・サイズ
- `_NET_WM_STATE_FULLSCREEN` の有無（全画面操作時）
- 必要ならスクリーンショット保存先
