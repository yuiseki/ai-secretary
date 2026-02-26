---
name: vacuumtube-live-cam-tile-full
description: "VacuumTube を無音の複数インスタンス（例: 4台, CDP :9993-:9996）で並行起動し、渋谷/新宿/池袋/秋葉原などの YouTube TV ライブカメラを個別表示して、4K画面全体を左上/右上/左下/右下の4象限に分割して KWin で敷き詰め配置する。4地点ライブカメラを大きく常時監視したいときに使う。"
---

# vacuumtube-live-cam-tile-full Skill

複数の無音 `VacuumTube` を使って、YouTube TV のライブカメラを 4K 画面全体に大きく `2x2` で配置するスキルです。

`vacuumtube-live-cam-tile`（右下 FHD 領域版）の全画面版として使います。

このスキルは以下を扱います。

- 無音 `VacuumTube` を複数台（既定例: 4台）起動
- 各インスタンスを CDP ポートで個別制御
- チャンネル `streams` からライブカメラタイルを高速選択
- 4K 画面全体を 4 象限（左上/右上/左下/右下）に分割して配置
- `wmctrl` が効かない場合の KWin Scripting フォールバック

## 前提

- 既存スキル `vacuumtube-silent-live-cam` が使える状態
  - `.codex/skills/vacuumtube-silent-live-cam/scripts/start_silent_instance.sh`
  - `.codex/skills/vacuumtube-silent-live-cam/scripts/open_tv_channel_live_tile_fast.js`
- `VacuumTube` メインインスタンス（`vacuumtube-bg`, `:9992`）は維持したまま運用する前提
- KDE Plasma + KWin (X11)
- `tmux`, `curl`, `jq`, `node`, `pactl`, `lsof`, `wmctrl`, `xdotool`, `qdbus`, `xrandr`, `xdpyinfo`

## 重要ルール / 注意点

- **同一 `user-data-dir` を同時共有しない**
  - 無音側は `~/.config/VacuumTube` の複製プロファイルを使う
- **`verify-regex` は広すぎないようにする**
  - 例: TBS は `TBS NEWS DIG` 単体だと別動画が誤一致する場合がある
  - `新宿駅前|Shinjuku` のように目的タイトル寄りにする
- **KWin タイル状態では `wmctrl` / `xdotool` が no-op になりやすい**
  - その場合は KWin Scripting で `client.frameGeometry` を直接設定する
- **`wmctrl -lG` のサイズはクライアント領域**
  - タイトルバー分（例: 上端 28px）やパネル領域分が差し引かれて見えることがある
- **最終確認は目視が必要**
  - 4画面の見え方・視認性は自動確認だけでは保証できない

## 基本ワークフロー（4台 / 全画面4象限）

1. 無音 `VacuumTube` を `:9993`〜`:9996` で起動
2. 各ポートにライブカメラを割り当て（渋谷/新宿/池袋/秋葉原など）
3. KWin で 4K 画面全体の 4 象限に配置
4. URL / ミュート状態 / 位置を確認
5. オーナーに目視確認を依頼

## 1) 無音 VacuumTube を複数台起動

既存の `start_silent_instance.sh` をポート/セッション/instance-dir を変えて複数回使う。

```bash
.codex/skills/vacuumtube-silent-live-cam/scripts/start_silent_instance.sh \
  --session vacuumtube-bg-2 \
  --port 9993 \
  --sink vacuumtube_silent \
  --instance-dir ~/.cache/yuiclaw/vacuumtube-multi/instance2

.codex/skills/vacuumtube-silent-live-cam/scripts/start_silent_instance.sh \
  --session vacuumtube-bg-3 \
  --port 9994 \
  --sink vacuumtube_silent \
  --instance-dir ~/.cache/yuiclaw/vacuumtube-multi/instance3

.codex/skills/vacuumtube-silent-live-cam/scripts/start_silent_instance.sh \
  --session vacuumtube-bg-4 \
  --port 9995 \
  --sink vacuumtube_silent \
  --instance-dir ~/.cache/yuiclaw/vacuumtube-multi/instance4

.codex/skills/vacuumtube-silent-live-cam/scripts/start_silent_instance.sh \
  --session vacuumtube-bg-5 \
  --port 9996 \
  --sink vacuumtube_silent \
  --instance-dir ~/.cache/yuiclaw/vacuumtube-multi/instance5
```

確認:

```bash
for p in 9993 9994 9995 9996; do
  curl -fsS "http://127.0.0.1:$p/json/version" | jq -r '.Browser'
done
pactl get-sink-mute vacuumtube_silent
```

期待値:

- 4 ポートすべて `Chrome/...`
- `vacuumtube_silent` は `Mute: yes`

## 2) 各ポートにライブカメラを割り当て（例: 東京4地点）

`open_tv_channel_live_tile_fast.js` を各ポートへ実行する。
`#/browse?c=<channelId>` を使い、`verify-regex` は目的動画に寄せる。

### 左上候補: 渋谷（FNN）

```bash
node .codex/skills/vacuumtube-silent-live-cam/scripts/open_tv_channel_live_tile_fast.js \
  --cdp-port 9993 \
  --browse-url 'https://www.youtube.com/tv/@FNNnewsCH/streams#/browse?c=UCoQBJMzcwmXrRSHBFAlTsIw' \
  --keyword 'いまの渋谷' \
  --verify-regex '渋谷|スクランブル交差点|Shibuya|FNN'
```

### 右上候補: 新宿（TBS NEWS DIG）

```bash
node .codex/skills/vacuumtube-silent-live-cam/scripts/open_tv_channel_live_tile_fast.js \
  --cdp-port 9994 \
  --browse-url 'https://www.youtube.com/tv/@tbsnewsdig/streams#/browse?c=UC6AG81pAkf6Lbi_1VC5NmPA' \
  --keyword '新宿駅前のライブカメラ' \
  --verify-regex '新宿駅前|Shinjuku'
```

### 左下候補: 池袋（サンシャイン60通り）

```bash
node .codex/skills/vacuumtube-silent-live-cam/scripts/open_tv_channel_live_tile_fast.js \
  --cdp-port 9995 \
  --browse-url 'https://www.youtube.com/tv/@%E3%82%B5%E3%83%B3%E3%82%B7%E3%83%A3%E3%82%A4%E3%83%B360%E9%80%9A%E3%82%8A%E3%83%A9%E3%82%A4%E3%83%96%E3%82%AB%E3%83%A1%E3%83%A9/streams#/browse?c=UCEloGRn_GCcr-I_6f5MYJPw' \
  --keyword 'サンシャイン60通りライブカメラ' \
  --verify-regex 'サンシャイン60通り|池袋|Sunshine|ikebukuro'
```

### 右下候補: 秋葉原（Cerevo）

```bash
node .codex/skills/vacuumtube-silent-live-cam/scripts/open_tv_channel_live_tile_fast.js \
  --cdp-port 9996 \
  --browse-url 'https://www.youtube.com/tv/@Cerevolivecamera/streams#/browse?c=UCrGS8VyrgCqYwaogH5bQpxQ' \
  --keyword '秋葉原ライブカメラ' \
  --verify-regex '秋葉原|Akihabara|Cerevo'
```

## 3) 4K画面全体を 4 象限に敷き詰める

### レイアウトの考え方

- 画面全体: `SCREEN_W x SCREEN_H`
- 4 象限セルサイズ:
  - `cellW = SCREEN_W / 2`
  - `cellH = SCREEN_H / 2`
- 配置先（frame geometry）:
  - 左上: `(0, 0, cellW, cellH)`
  - 右上: `(cellW, 0, cellW, cellH)`
  - 左下: `(0, cellH, cellW, cellH)`
  - 右下: `(cellW, cellH, cellW, cellH)`

実測例:

- UHD 4K `3840x2160` → 各象限 `1920x1080`
- DCI 4K `4096x2160` → 各象限 `2048x1080`

### 画面サイズを自動取得する（X11 / xrandr）

```bash
export DISPLAY=:0
export XAUTHORITY="$HOME/.Xauthority"

read SCREEN_W SCREEN_H < <(
  xrandr --current \
    | awk '/ connected primary / { split($4, a, "+"); split(a[1], b, "x"); print b[1], b[2]; exit }'
)

CELL_W=$((SCREEN_W / 2))
CELL_H=$((SCREEN_H / 2))

echo "screen=${SCREEN_W}x${SCREEN_H} cell=${CELL_W}x${CELL_H}"
```

### KWin Scripting による確実配置（推奨）

`wmctrl` / `xdotool` が効かない場合でも、KWin の `client.frameGeometry` は通りやすい。
以下は `:9993-:9996` の PID を `lsof` で引き、4台を全画面4象限へ配置する一時スクリプト例。

```bash
export DISPLAY=:0
export XAUTHORITY="$HOME/.Xauthority"

read SCREEN_W SCREEN_H < <(
  xrandr --current \
    | awk '/ connected primary / { split($4, a, "+"); split(a[1], b, "x"); print b[1], b[2]; exit }'
)
CELL_W=$((SCREEN_W / 2))
CELL_H=$((SCREEN_H / 2))

PID_9993=$(lsof -nP -iTCP:9993 -sTCP:LISTEN -t | head -n1)
PID_9994=$(lsof -nP -iTCP:9994 -sTCP:LISTEN -t | head -n1)
PID_9995=$(lsof -nP -iTCP:9995 -sTCP:LISTEN -t | head -n1)
PID_9996=$(lsof -nP -iTCP:9996 -sTCP:LISTEN -t | head -n1)

cat > /tmp/codex_kwin_layout_4cams_full.js <<EOF
var cellW = $CELL_W;
var cellH = $CELL_H;
var targets = [
  { pid: $PID_9993, x: 0,     y: 0,     w: cellW, h: cellH }, // left-top
  { pid: $PID_9994, x: cellW, y: 0,     w: cellW, h: cellH }, // right-top
  { pid: $PID_9995, x: 0,     y: cellH, w: cellW, h: cellH }, // left-bottom
  { pid: $PID_9996, x: cellW, y: cellH, w: cellW, h: cellH }  // right-bottom
];
var clients = workspace.clientList();
for (var t = 0; t < targets.length; ++t) {
  var target = targets[t];
  for (var i = 0; i < clients.length; ++i) {
    var c = clients[i];
    if (c.pid !== target.pid) continue;
    try { c.fullScreen = false; } catch (e1) {}
    var g = c.frameGeometry;
    g.x = target.x; g.y = target.y; g.width = target.w; g.height = target.h;
    c.frameGeometry = g;
    break;
  }
}
EOF

PLUGIN=codex_kwin_layout_4cams_full
qdbus org.kde.KWin /Scripting org.kde.kwin.Scripting.loadScript /tmp/codex_kwin_layout_4cams_full.js "$PLUGIN" >/dev/null
qdbus org.kde.KWin /Scripting org.kde.kwin.Scripting.start >/dev/null
sleep 1
qdbus org.kde.KWin /Scripting org.kde.kwin.Scripting.unloadScript "$PLUGIN" >/dev/null || true
```

### `wmctrl` での確認

```bash
DISPLAY=:0 XAUTHORITY="$HOME/.Xauthority" wmctrl -lpG | rg 'VacuumTube'
```

注意:

- `wmctrl` の `x/y/w/h` はクライアント領域
- タイトルバー（例: 28px）や下部パネルの予約領域があると、`frameGeometry` より小さく見える
- 本当に「全面を隙間なく」見せたい場合は、パネル自動隠しや枠なし表示の検討が必要

## 4) 一括確認コマンド

URL確認:

```bash
for p in 9993 9994 9995 9996; do
  printf '%s ' "$p"
  curl -fsS "http://127.0.0.1:$p/json" \
    | jq -r 'map(select(.type=="page" and (.url|contains("youtube.com/tv"))))[0].url'
done
```

ミュート確認:

```bash
pactl get-sink-mute vacuumtube_silent
```

期待値:

- 各ポートが目的の `#/watch?v=...` にいる
- `vacuumtube_silent` は `Mute: yes`

## 推奨の東京4地点マッピング（例）

- 左上 (`:9993`): 渋谷 / FNN
- 右上 (`:9994`): 新宿 / TBS NEWS DIG
- 左下 (`:9995`): 池袋 / サンシャイン60通り
- 右下 (`:9996`): 秋葉原 / Cerevo

必要に応じて、ポートと地域の対応は入れ替えてよい。

## トラブルシュート

### TBS 新宿が別の TBS 動画に化ける

- `verify-regex` が広すぎる可能性が高い
- `新宿駅前|Shinjuku` のように絞る

### `wmctrl` / `xdotool` で位置が変わらない

- KWin タイル/制約で無視されている可能性が高い
- KWin Scripting（`workspace.clientList()` + `client.frameGeometry`）を使う

### 象限サイズが想定と違う（`3840` ではなく `4096` だった）

- DCI 4K (`4096x2160`) の可能性がある
- `xrandr --current` で実画面サイズを確認し、`CELL_W/CELL_H` を再計算する

### TVチャンネルページが数秒で別状態に遷移する

- `open_tv_channel_live_tile_fast.js` を使う
- 手動遷移→手動選択はレースに負けやすい

### アカウント選択画面に落ちる（TBSで稀発）

- 既定フォーカスのアカウントに `Enter` で復帰できる場合がある
- 復帰後に再度 CDP で `#/watch?v=...` を指定する

## 手動確認（必須）

- 4台が画面全体の左上/右上/左下/右下に並んでいるか
- 各ウィンドウが意図した地域（渋谷/新宿/池袋/秋葉原）になっているか
- 音が出ていないか（`vacuumtube_silent`）

## 関連スキル

- `vacuumtube-silent-live-cam`（無音複数起動と TV ライブタイル選択の基盤）
- `vacuumtube-live-cam-tile`（右下 FHD 領域版）
- `desktop-windows-layout`（X11/KDE のウィンドウ配置・確認）
- `system-reboot-bringup`（再起動後の常駐群復旧）

