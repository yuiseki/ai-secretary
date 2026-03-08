---
name: system-reboot-bringup
description: "Ubuntu/KDE デスクトップを再起動したあとに、この環境の常駐プロセス群（VOICEVOX API、VacuumTube、whisper.cpp 音声コマンド待受、acaption/asec オーバーレイ、ASEE Viewer ウェブカメラオーバーレイ）を順序よく復旧する。ユーザーが『再起動後の起動手順をやって』『常駐プロセスを全部立ち上げて』『音声待受とカメラ監視を復旧して』など依頼したときに使う。"
---

# system-reboot-bringup Skill

この環境を再起動した後に、日常運用で使っている常駐プロセス群を復旧するための runbook です。  
`tmux` 管理のプロセスを中心に、起動順・確認手順・ログ確認をまとめています。

## 対象プロセス（このスキルの範囲）

- `VOICEVOX` API（`http://127.0.0.1:50021`）
- `VacuumTube`（remote debugging `:9992`、通常 `tmux` セッション `vacuumtube-bg`）
- `whisper.cpp` 音声コマンド待受一式（`whisper-server-ja`, `whisper-agent-ja`）
- `acaption` 字幕オーバーレイ + `asec` lock screen
- `ASEE Viewer` ウェブカメラ + 顔認識オーバーレイ（`asee-bg` tmux / port 8765）

## 前提

- KDE Plasma デスクトップにログイン済み
- 実際に有効な `DISPLAY` を確認して GUI 操作できる（再起動後に `:0` / `:1` が変わることがある）
- `tmux`, `curl`, `jq`, `python3` 利用可能

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

### 3) 字幕オーバーレイ + lock screen を起動（`acaption-overlay` / `asec-lock-screen`）

字幕表示は `repos/acaption`、lock screen は `repos/asec` を使います。起動責務は `tmp/whispercpp-listen/tmux_listen_only.sh` に集約されています。

```bash
tmp/whispercpp-listen/tmux_listen_only.sh start-overlay
```

`acaption` / `asec` は起動時に X11 desktop session を自動検出するため、通常は
`DISPLAY` / `XAUTHORITY` を明示しない。

起動確認:

```bash
tmp/whispercpp-listen/tmux_listen_only.sh status
tmp/whispercpp-listen/tmux_listen_only.sh logs-overlay
tmp/whispercpp-listen/tmux_listen_only.sh logs-lock-screen
echo '{"type":"notify","text":"bringup OK"}' | nc -q1 127.0.0.1 47832
echo '{"type":"lock_screen_show","text":"SYSTEM LOCKED"}' | nc -q1 127.0.0.1 47833
echo '{"type":"lock_screen_hide"}' | nc -q1 127.0.0.1 47833
```

期待:

- `overlay: RUNNING (acaption-overlay)`
- `lock-screen: RUNNING (asec-lock-screen)`
- `overlay endpoint ready: 127.0.0.1:47832`
- `lock screen endpoint ready: 127.0.0.1:47833`

### 4) 音声待受（tmux 管理）

`tmp/whispercpp-listen/tmux_listen_only.sh` が以下をまとめて管理します。

**STT バックエンドは `STT_BACKEND` 環境変数で切り替えます（デフォルト: `whisper`）:**

| `STT_BACKEND` | 起動するセッション | レイテンシ | 精度 |
|---------------|-------------------|------------|------|
| `whisper`（既定）| `whisper-server-ja` + `whisper-agent-ja` + `acaption-overlay` + `asec-lock-screen` | ~4500ms | 100% |
| `moonshine` | `whisper-agent-ja` + `acaption-overlay` + `asec-lock-screen`（server不要） | ~270ms | 96.6% |

#### whisper バックエンド（既定）

```bash
tmp/whispercpp-listen/tmux_listen_only.sh start-agent
```

#### moonshine バックエンド + 声紋認証（推奨構成）

```bash
STT_BACKEND=moonshine \
WHISPER_AGENT_SPEAKER_ID=1 \
tmp/whispercpp-listen/tmux_listen_only.sh start-agent
```

#### moonshine バックエンド（声紋認証なし）

```bash
STT_BACKEND=moonshine \
tmp/whispercpp-listen/tmux_listen_only.sh start-agent
```

moonshine は `whisper-server-ja` セッションを起動しません。モデルは `voice_command_loop.py` プロセス内にロードされます。

モデルサイズ変更（既定: `base`）:

```bash
STT_BACKEND=moonshine MOONSHINE_MODEL_SIZE=tiny \
WHISPER_AGENT_SPEAKER_ID=1 \
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

- whisper 既定モデルは `ggml-small.bin`
- DJI マイクを明示したいときは `WHISPER_MIC_SOURCE=... tmp/whispercpp-listen/tmux_listen_only.sh restart-agent`
- moonshine バックエンドは音声キャプチャに `ffmpeg`（`parec` 不要）を使用します
- biometric lock は既定で有効です。無効化したいときだけ `WHISPER_AGENT_BIOMETRIC_LOCK=0` を付けます
- `WHISPER_AGENT_SPEAKER_ID=1` で ECAPA-TDNN 声紋認証を有効化（お嬢様のみコマンド実行可能）
  - マスターボイスプリント: `tmp/whispercpp-listen/tests/fixtures/master_voiceprint.npy`
  - 閾値: `WHISPER_AGENT_SPEAKER_THRESHOLD`（既定 0.60、ライブマイク実測値 0.63〜0.78）
  - 認証失敗時: 「声紋認証に失敗しました。もう一度お試しください。」と返答してコマンドをブロック
  - マスター再生成: `cd tmp/whispercpp-listen && python3 prototype_speaker_id.py`

### 5) ASEE Viewer（ウェブカメラ + 顔認識オーバーレイ）を起動（tmux 管理）

ASEE Viewer は `repos/asee/tmp_main.sh` が起動する Electron viewer + Python backend の組です。

`repos/asee/tmp_main.sh restart` を `tmux` セッション `asee-bg` から実行します。
内部では backend と Electron viewer を起動し、PID を `/tmp/asee_tmp_main_8765.pids` に保存します。
その後 `layout --full-screen → --backmost` で `ASEE Viewer` ウィンドウを全画面・最背面（壁紙代わり）に配置します。

```bash
tmux has-session -t asee-bg 2>/dev/null && tmux kill-session -t asee-bg || true
tmux new-session -d -s asee-bg \
  "bash -lc 'cd ~/Workspaces/repos/asee && DISPLAY=${DESKTOP_DISPLAY} XAUTHORITY=\"$HOME/.Xauthority\" bash tmp_main.sh restart --port 8765 --cameras 0,2,4,6 --capture-profile 720p --opencv-threads 1 && bash tmp_main.sh layout --port 8765 --full-screen && bash tmp_main.sh layout --port 8765 --backmost; exec bash'"
```

`tmp_main.sh` の呼び出し内容（参考）:

```bash
./tmp_main.sh restart --port 8765 --cameras 0,2,4,6 --capture-profile 720p --opencv-threads 1
./tmp_main.sh layout --port 8765 --full-screen
./tmp_main.sh layout --port 8765 --backmost
```

起動確認（起動完了まで 10〜20 秒かかります）:

```bash
# tmux セッションのログを確認
tmux capture-pane -pt asee-bg -S -40 | tail -n 20

# video server の HTTP 応答を確認
curl -fsS http://localhost:8765/status
```

手動でウィンドウレイアウトを変更したい場合:

```bash
cd ~/Workspaces/repos/asee

# 前面に出す（ウェブカメラが見たいとき）
DISPLAY=${DESKTOP_DISPLAY} bash tmp_main.sh layout --port 8765 --frontmost

# フルスクリーン
DISPLAY=${DESKTOP_DISPLAY} bash tmp_main.sh layout --port 8765 --full-screen

# 左下コンパクト配置
DISPLAY=${DESKTOP_DISPLAY} bash tmp_main.sh layout --port 8765 --left-bottom

# 最背面に戻す（壁紙モード）
DISPLAY=${DESKTOP_DISPLAY} bash tmp_main.sh layout --port 8765 --backmost
```

停止したい場合:

```bash
cd ~/Workspaces/repos/asee && DISPLAY=${DESKTOP_DISPLAY} bash tmp_main.sh stop --port 8765
```

補足:

- `repos/asee/electron` が公式 viewer で、ウィンドウ caption は `ASEE Viewer`
- `--cameras 0,2,4,6 --capture-profile 720p --opencv-threads 1` を現行の実用構成として使う（実際のデバイス番号は環境依存）
- 音声コマンド `システム、ウェブカメラが見たい` 等でも制御可能（`whisper-agent` 運用中の場合）

## まとめて確認（復旧完了チェック）

```bash
tmux ls | rg 'voicevox-bg|vacuumtube-bg|whisper-server-ja|whisper-agent-ja|acaption-overlay|asec-lock-screen|asee-bg'
curl -fsS http://127.0.0.1:50021/version
curl -fsS http://127.0.0.1:9992/json/version
curl -fsS http://localhost:8765/status
# overlay IPC 確認
echo '{"type":"notify","text":"bringup OK"}' | nc -q1 127.0.0.1 47832
```

期待される `tmux` セッション（通常運用）:

- `voicevox-bg`
- `vacuumtube-bg`
- `acaption-overlay`（字幕オーバーレイ / IPC :47832）
- `asec-lock-screen`（lock screen / IPC :47833）
- `whisper-server-ja`（STT_BACKEND=whisper のときのみ）
- `whisper-agent-ja`
- `asee-bg`（起動スクリプト完了後は idle、ASEE プロセス自体は tmux 管理で稼働中）

注意:

- `whisper-listen-ja` は `agent` 運用中は `STOPPED` が正常
- `asee-bg` の tmux は起動コマンド実行後に idle になるのが正常（`exec bash` で待機している）

## 最小の手動確認（UX）

1. `システム 状況報告` と話しかける
2. 字幕オーバーレイ + VOICEVOX 応答が出ることを確認
3. `YouTubeを小さくして` など簡単なコマンドを試す

手動確認をお願いするときは、`ASEE` が見えていれば先に `owner-attention-call` を使う。

```bash
python3 /home/yuiseki/Workspaces/.codex/skills/owner-attention-call/scripts/call_owner.py \
  --message "ユイさま、復旧後の動作確認をお願いします"
```

`mode=speech` なら音声で呼びかけ済み。`mode=ntfy` のときだけ追加で `ntfy` を使う。

## トラブルシュート（再起動直後に多いもの）

### 1) `whisper-agent` は動いているのに喋らない

- `VOICEVOX` が起動していないことが多い
- 再起動後に `DISPLAY` を取り違えて `VOICEVOX` が即終了していることもある
- 確認: `curl -fsS http://127.0.0.1:50021/version`

### 2) VacuumTube の CDP が見えない

- `~/vacuumtube.sh` 起動漏れ or `:9992` 未設定
- 確認: `curl -fsS http://127.0.0.1:9992/json/version`

### 4) overlay / lock screen IPC に繋がらない

- `acaption-overlay` または `asec-lock-screen` セッションが未起動、またはポート競合で落ちている
- 確認: `nc -zv 127.0.0.1 47832`
- ログ確認: `tmp/whispercpp-listen/tmux_listen_only.sh logs-overlay`
- ログ確認: `tmp/whispercpp-listen/tmux_listen_only.sh logs-lock-screen`
- 再起動手順は Step 3 を参照
- 別プロセスがポートを使用中の場合: `lsof -i :47832 -i :47833` で PID を特定して kill

### 5) ASEE Viewer の video server に繋がらない

- `tmp_main.sh restart` が失敗しているか、まだ起動中
- `tmux capture-pane -pt asee-bg -S -40` でログを確認
- `DISPLAY` が合っていないと Electron ウィンドウが開かない（step 0 で確認した値を使うこと）
- 手動で再起動: `cd ~/Workspaces/repos/asee && DISPLAY=${DESKTOP_DISPLAY} bash tmp_main.sh restart --port 8765 --cameras 0,2,4,6 --capture-profile 720p --opencv-threads 1`

### 6) ASEE Viewer ウィンドウが前面に出たまま戻らない

- `--backmost` の KWin スクリプトが効いていない可能性
- 手動で最背面に: `cd ~/Workspaces/repos/asee && DISPLAY=${DESKTOP_DISPLAY} bash tmp_main.sh layout --port 8765 --backmost`

## 関連スキル

- `vacuumtube`（VacuumTube の CDP 操作）
- `audio-stt-whisper`（whisper-agent 運用）
- `audio-speak-voicebox`（VOICEVOX + 字幕オーバーレイ）
- `owner-attention-call`（ASEE を見て音声呼びかけ / ntfy を自動切替）
- `desktop-windows-layout`（VacuumTube の右上配置など）
