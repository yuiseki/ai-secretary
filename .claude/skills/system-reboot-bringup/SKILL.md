---
name: system-reboot-bringup
description: "Ubuntu/KDE デスクトップを再起動したあとに、この環境の常駐プロセス群（VOICEVOX API、VacuumTube、whisper.cpp 音声コマンド待受、Tauri 字幕オーバーレイ、Webカメラ qwen3-vl キャプション daemon、GOD MODE ウェブカメラオーバーレイ）を順序よく復旧する。ユーザーが『再起動後の起動手順をやって』『常駐プロセスを全部立ち上げて』『音声待受とカメラ監視を復旧して』など依頼したときに使う。"
---

# system-reboot-bringup Skill

この環境を再起動した後に、日常運用で使っている常駐プロセス群を復旧するための runbook です。  
`tmux` 管理のプロセスを中心に、起動順・確認手順・ログ確認をまとめています。

## 対象プロセス（このスキルの範囲）

- `VOICEVOX` API（`http://127.0.0.1:50021`）
- `VacuumTube`（remote debugging `:9992`、通常 `tmux` セッション `vacuumtube-bg`）
- `whisper.cpp` 音声コマンド待受一式（`whisper-server-ja`, `whisper-agent-ja`）
- `Tauri` 字幕オーバーレイ（`caption-overlay-poc`）
- `Webカメラ + qwen3-vl` 常駐キャプション daemon（`webcam-vision-daemon`）
- `GOD MODE` ウェブカメラ + 顔認識オーバーレイ（`god-mode-bg` tmux / port 8765）

## 前提

- KDE Plasma デスクトップにログイン済み
- 実際に有効な `DISPLAY` を確認して GUI 操作できる（再起動後に `:0` / `:1` が変わることがある）
- `tmux`, `curl`, `jq`, `python3` 利用可能
- `Ollama` サーバー起動済み（`http://127.0.0.1:11434`）
- `qwen3-vl:*` モデル導入済み（既定は `qwen3-vl:4b`）

## 重要ルール

- 音声待受は `listener` と `agent` を同時起動しない（マイク競合）
- 再起動後はまず `VOICEVOX` と `VacuumTube` の土台を復旧してから `whisper-agent` を起動する
- UX（音声・字幕・VacuumTube 操作）は自動テストだけで保証できないため、最後に必ず手動確認する

## 推奨の起動順（再起動後）

### 0) 有効な `DISPLAY` を確認（重要）

再起動後は `DISPLAY` が `:0` になることがあるため、固定値 `:1` を前提にしない。

```bash
for d in :0 :1 :2; do
  echo "== $d =="
  DISPLAY="$d" XAUTHORITY="$HOME/.Xauthority" xdpyinfo >/dev/null 2>&1 && echo ok || echo ng
done
```

`ok` になった値を以降のコマンドで使う（例: `:0`）。

```bash
export DESKTOP_DISPLAY=:0
export XAUTHORITY="$HOME/.Xauthority"
```

### 1) VOICEVOX (VOICEBOX) を起動（`tmux` 推奨, API :50021）

`VOICEVOX` も `tmux` で常駐化しておくと、作業セッション終了時に巻き込まれて落ちにくい。

```bash
tmux has-session -t voicevox-bg 2>/dev/null && tmux kill-session -t voicevox-bg || true
tmux new-session -d -s voicevox-bg \
  "bash -lc 'export DISPLAY=${DESKTOP_DISPLAY}; export XAUTHORITY=\"$HOME/.Xauthority\"; exec \"$HOME/.voicevox/VOICEVOX.AppImage\"'"
```

確認:

```bash
curl -fsS http://127.0.0.1:50021/version
tmux capture-pane -pt voicevox-bg -S -40 | tail -n 20
```

補足:

- `VOICEVOX` が起動していないと、`whisper-agent` は音声応答できない（字幕だけになる/フォールバックになる）

### 2) VacuumTube を起動（tmux 推奨）

```bash
tmux new-session -d -s vacuumtube-bg \
  "bash -lc 'export VACUUMTUBE_DISPLAY=${DESKTOP_DISPLAY}; export XAUTHORITY=\"$HOME/.Xauthority\"; exec ~/vacuumtube.sh'"
```

確認:

```bash
pgrep -af '^/opt/VacuumTube/vacuumtube( |$)'
curl -fsS http://127.0.0.1:9992/json/version
```

起動直後の手動操作（必要な場合）:

- アカウント選択画面で `YuisekinTV` を選択
- 右上にタイル配置（`desktop-windows-layout` / `vacuumtube` スキル手順）

### 3) 音声待受 + 字幕オーバーレイ（tmux 管理）

`tmp/whispercpp-listen/tmux_listen_only.sh` が以下をまとめて管理します。

- `whisper-server-ja`
- `whisper-agent-ja`
- `caption-overlay-poc`

起動:

```bash
CAPTION_OVERLAY_DISPLAY="${DESKTOP_DISPLAY}" \
CAPTION_OVERLAY_XAUTHORITY="$HOME/.Xauthority" \
tmp/whispercpp-listen/tmux_listen_only.sh start-agent
```

状態確認:

```bash
tmp/whispercpp-listen/tmux_listen_only.sh status
```

よく使うログ:

```bash
tmp/whispercpp-listen/tmux_listen_only.sh logs-agent
tmp/whispercpp-listen/tmux_listen_only.sh logs-agent-tail
tmp/whispercpp-listen/tmux_listen_only.sh logs-overlay
```

補足:

- 既定モデルは `ggml-small.bin`
- DJI マイクを明示したいときは `WHISPER_MIC_SOURCE=... tmp/whispercpp-listen/tmux_listen_only.sh restart-agent`

### 4) Webカメラ qwen3-vl daemon（tmux 管理）

新規 `tmux` ラッパー:

- `tmp/webcam_ollama_vision/tmux_webcam_daemon.sh`

起動（既定: `qwen3-vl:4b`, 60秒間隔, 複数カメラ+横結合+stitch-only優先）:

```bash
tmp/webcam_ollama_vision/tmux_webcam_daemon.sh start
```

状態/ログ:

```bash
tmp/webcam_ollama_vision/tmux_webcam_daemon.sh status
tmp/webcam_ollama_vision/tmux_webcam_daemon.sh logs
```

保存先（既定）:

- `~/.cache/yuiclaw/camera/YYYY/MM/DD/HH/MM.png`
- `~/.cache/yuiclaw/camera/YYYY/MM/DD/HH/MM.txt`

補足:

- キャプションは前回結果を次回プロンプトへ渡し、「前回との差分」を優先して説明する
- カメラが1台しか見つからない場合は `--stitch-only` を自動で無効化して起動する

### 5) GOD MODE（ウェブカメラ + 顔認識オーバーレイ）を起動（tmux 管理）

`tmp/GOD_MODE/god_mode_restart.sh` を `tmux` セッション `god-mode-bg` から実行します。
内部では `god_mode.sh restart` が各プロセスを `nohup` で起動し PID を `/tmp/god_mode_8765.pids` に保存します。
その後 `layout --full-screen → --backmost` でウィンドウを全画面・最背面（壁紙代わり）に配置します。

```bash
tmux has-session -t god-mode-bg 2>/dev/null && tmux kill-session -t god-mode-bg || true
tmux new-session -d -s god-mode-bg \
  "bash -lc 'cd ~/Workspaces/tmp/GOD_MODE && DISPLAY=${DESKTOP_DISPLAY} XAUTHORITY=\"$HOME/.Xauthority\" bash god_mode_restart.sh; exec bash'"
```

`god_mode_restart.sh` の内容（参考）:

```bash
./god_mode.sh restart --chromium --port 8765 --cameras 0,2,4
./god_mode.sh layout --full-screen
./god_mode.sh layout --backmost
```

起動確認（起動完了まで 10〜20 秒かかります）:

```bash
# tmux セッションのログを確認
tmux capture-pane -pt god-mode-bg -S -40 | tail -n 20

# video server の HTTP 応答を確認
curl -fsS http://localhost:8765/status
```

手動でウィンドウレイアウトを変更したい場合:

```bash
cd ~/Workspaces/tmp/GOD_MODE

# 前面に出す（ウェブカメラが見たいとき）
DISPLAY=${DESKTOP_DISPLAY} bash god_mode.sh layout --frontmost

# フルスクリーン
DISPLAY=${DESKTOP_DISPLAY} bash god_mode.sh layout --full-screen

# 左下コンパクト配置
DISPLAY=${DESKTOP_DISPLAY} bash god_mode.sh layout --left-bottom

# 最背面に戻す（壁紙モード）
DISPLAY=${DESKTOP_DISPLAY} bash god_mode.sh layout --backmost
```

停止したい場合:

```bash
cd ~/Workspaces/tmp/GOD_MODE && DISPLAY=${DESKTOP_DISPLAY} bash god_mode.sh stop
```

補足:

- GOD MODE は `--chromium` モードで Chromium ウィンドウを使用（`--chromium` なし: Tauri モード）
- `--cameras 0,2,4` でカメラ 0・2・4 番を使用（実際のデバイス番号は環境依存）
- 音声コマンド `システム、ウェブカメラが見たい` 等でも制御可能（`whisper-agent` 運用中の場合）

## まとめて確認（復旧完了チェック）

```bash
tmux ls | rg 'voicevox-bg|vacuumtube-bg|whisper-server-ja|whisper-agent-ja|caption-overlay-poc|webcam-vision-daemon|god-mode-bg'
curl -fsS http://127.0.0.1:50021/version
curl -fsS http://127.0.0.1:9992/json/version
curl -fsS http://127.0.0.1:11434/api/tags | jq -r '.models[].name' | rg '^qwen3-vl:' | head
curl -fsS http://localhost:8765/status
```

期待される `tmux` セッション（通常運用）:

- `voicevox-bg`
- `vacuumtube-bg`
- `whisper-server-ja`
- `whisper-agent-ja`
- `caption-overlay-poc`
- `webcam-vision-daemon`
- `god-mode-bg`（起動スクリプト完了後は idle、GOD_MODE プロセス自体は nohup で稼働中）

注意:

- `whisper-listen-ja` は `agent` 運用中は `STOPPED` が正常
- `god-mode-bg` の tmux は起動コマンド実行後に idle になるのが正常（`exec bash` で待機している）

## 最小の手動確認（UX）

1. `システム 状況報告` と話しかける
2. 字幕オーバーレイ + VOICEVOX 応答が出ることを確認
3. `YouTubeを小さくして` など簡単なコマンドを試す
4. `tmp/webcam_ollama_vision/tmux_webcam_daemon.sh logs` で最新キャプションが流れることを確認

## トラブルシュート（再起動直後に多いもの）

### 1) `whisper-agent` は動いているのに喋らない

- `VOICEVOX` が起動していないことが多い
- 再起動後に `DISPLAY` を取り違えて `VOICEVOX` が即終了していることもある
- 確認: `curl -fsS http://127.0.0.1:50021/version`

### 2) Webcam daemon がすぐ落ちる

- `Ollama` 未起動 / `qwen3-vl:*` 未ロード
- 確認:
  - `curl -fsS http://127.0.0.1:11434/api/tags`
  - `tmp/webcam_ollama_vision/tmux_webcam_daemon.sh logs`

### 3) VacuumTube の CDP が見えない

- `~/vacuumtube.sh` 起動漏れ or `:9992` 未設定
- 確認: `curl -fsS http://127.0.0.1:9992/json/version`

### 4) GOD MODE の video server に繋がらない

- `god_mode.sh restart` が失敗しているか、まだ起動中
- `tmux capture-pane -pt god-mode-bg -S -40` でログを確認
- `DISPLAY` が合っていないと Chromium ウィンドウが開かない（step 0 で確認した値を使うこと）
- 手動で再起動: `cd ~/Workspaces/tmp/GOD_MODE && DISPLAY=${DESKTOP_DISPLAY} bash god_mode_restart.sh`

### 5) GOD MODE ウィンドウが前面に出たまま戻らない

- `--backmost` の KWin スクリプトが効いていない可能性
- 手動で最背面に: `cd ~/Workspaces/tmp/GOD_MODE && DISPLAY=${DESKTOP_DISPLAY} bash god_mode.sh layout --backmost`

## 関連スキル

- `vacuumtube`（VacuumTube の CDP 操作）
- `audio-stt-whisper`（whisper-agent 運用）
- `audio-speak-voicebox`（VOICEVOX + 字幕オーバーレイ）
- `webcam-vision-ollama`（Webカメラ + qwen3-vl）
- `desktop-windows-layout`（VacuumTube の右上配置など）
- `webcam-vision-ollama`（GOD MODE の Webカメラ画像確認）
