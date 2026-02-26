---
name: audio-stt-whisper
description: "whisper.cpp（whisper-server）と PipeWire マイク入力を使って、日本語の音声待ち受け・文字起こし・音声コマンド待機（tmux常駐）を運用する。listen-only 実験、voice command loop（VOICEVOX応答 + VacuumTube操作）、モデル切替（small/medium）、マイク source 切替（DJI MIC MINI / Razer など）、ログ確認・デバッグを行う。ユーザーが『マイクで話しかけたい』『音声待ち受けを常駐したい』『whisper.cpp で音声認識したい』など依頼したときに使う。"
---

# audio-stt-whisper Skill

`whisper.cpp` を使ったローカル音声待ち受け（STT）を扱うスキルです。  
この環境では `tmux + whisper-server + PipeWire + Python listener` で常駐運用します。

用途は 2 段階あります。

- `listen-only`: 発話検知して文字起こしする（まずここを安定化）
- `voice command loop`: 文字起こし結果をコマンド解釈して VOICEVOX 応答 + VacuumTube 操作を行う

## 前提

- `whisper.cpp` ビルド済み
  - 例: `repos/whisper.cpp/build/bin/whisper-server`
- モデル配置済み
  - 例: `repos/whisper.cpp/models/ggml-small.bin`, `ggml-medium.bin`
- PipeWire / PulseAudio 互換コマンドが使える
  - `pactl`, `parec`
- `tmux` 利用可能
- このリポジトリの運用スクリプト
  - `tmp/whispercpp-listen/tmux_listen_only.sh`
  - `tmp/whispercpp-listen/listen_only_whisper_server.py`
  - `tmp/whispercpp-listen/voice_command_loop.py`

補足（voice command loop 時）:

- VOICEVOX（`http://127.0.0.1:50021`）が起動していると音声応答できる
- `VacuumTube` を操作する場合は `~/vacuumtube.sh` + remote debugging `:9992` が前提

## この環境の実運用デフォルト（2026-02-25 時点）

- `whisper-server` モデル既定: `ggml-small.bin`
  - `tmp/whispercpp-listen/tmux_listen_only.sh`
- 言語: `ja`
- `voice command loop`:
  - `VOICEVOX volumeScale=2.5`
  - `VOICEVOX speedScale=1.25`
  - `ack_headstart_ms=120`（応答音声を少し先に出す）
  - `notify-send` デスクトップ通知: 有効（best-effort）
- マイク source 自動検出優先順（実装済み）
  - `DJI MIC MINI`
  - `Razer Seiren Mini`
  - 非 webcam の USB マイク
  - その他の非 monitor source

## 重要ルール

- まずは `listen-only` で STT 精度と VAD を確認してから、音声コマンド化する
- `listener` と `agent` を同時に走らせない（マイク競合）
  - `start-agent` / `restart-agent` は自動で `listener` を止める
- 速度と精度のトレードオフを明示する
  - `small`: 速い（実用）
  - `medium`: 精度向上だが遅い
- UX は自動テストだけでは保証できない
  - 文字起こし精度、聞こえ方、体感速度は必ずオーナーの手動確認を取る

## 典型ユースケース

- `マイクで話しかける実験をしたい`
- `whisper.cpp で音声待ち受けを常駐したい`
- `DJI の無線マイクを使うように切り替えたい`
- `small と medium を切り替えて比較したい`
- `音声コマンドのログを見てデバッグしたい`

## まず使うコマンド（tmux 管理）

### `listen-only` を起動

```bash
tmp/whispercpp-listen/tmux_listen_only.sh start
```

### 音声コマンド待機（VOICEVOX / VacuumTube連携あり）を起動

```bash
tmp/whispercpp-listen/tmux_listen_only.sh start-agent
```

### 状態確認

```bash
tmp/whispercpp-listen/tmux_listen_only.sh status
```

### ログ確認

```bash
tmp/whispercpp-listen/tmux_listen_only.sh logs-server
tmp/whispercpp-listen/tmux_listen_only.sh logs-listener
tmp/whispercpp-listen/tmux_listen_only.sh logs-agent
```

### 再起動（よく使う）

```bash
# 音声コマンドループだけ再起動（serverは維持）
tmp/whispercpp-listen/tmux_listen_only.sh restart-agent

# 音声コマンドループ + whisper-server をまとめて再起動
tmp/whispercpp-listen/tmux_listen_only.sh restart-agent-all
```

## モデル切替（small / medium）

速度と精度の比較は `WHISPER_SERVER_MODEL` で行う。

```bash
# small（速め、現在の既定）
WHISPER_SERVER_MODEL=/home/yuiseki/Workspaces/repos/whisper.cpp/models/ggml-small.bin \
tmp/whispercpp-listen/tmux_listen_only.sh restart-agent-all

# medium（精度寄り、遅め）
WHISPER_SERVER_MODEL=/home/yuiseki/Workspaces/repos/whisper.cpp/models/ggml-medium.bin \
tmp/whispercpp-listen/tmux_listen_only.sh restart-agent-all
```

確認:

```bash
tmp/whispercpp-listen/tmux_listen_only.sh status
tmp/whispercpp-listen/tmux_listen_only.sh logs-server | rg 'loading model from|type\\s+=\\s+'
```

注意:

- `restart-all` は `listener` モードを起動する
- `agent` 運用中は `restart-agent-all` を使う方が安全

## マイク source 切替（DJI / Razer / 明示指定）

### 自動検出に任せる（推奨）

`listen_only_whisper_server.py` の `detect_source()` が `DJI MIC MINI` を優先します。

### 明示指定する

```bash
pactl list short sources

WHISPER_MIC_SOURCE='alsa_input.usb-DJI_Technology_Co.__Ltd._DJI_MIC_MINI_XSP12345678B-01.analog-stereo' \
tmp/whispercpp-listen/tmux_listen_only.sh restart-agent
```

確認:

```bash
tmp/whispercpp-listen/tmux_listen_only.sh logs-agent | rg '^\\[.*\\] source='
```

## `listen-only`（最小実験）の考え方

`listen-only` は「待機 → 発話検知 → 文字起こし → ログ出力」だけを行う。  
最初にここを通しておくと、マイク / VAD / STT の問題を切り分けやすい。

デバッグ付き例:

```bash
WHISPER_LISTEN_DEBUG=1 \
WHISPER_LISTEN_MAX_SEGMENTS=1 \
tmp/whispercpp-listen/tmux_listen_only.sh restart
```

## `voice command loop`（実用運用）

`voice_command_loop.py` は以下を 1 プロセスで回します。

1. マイク待機（VAD）
2. `whisper-server` に音声送信
3. コマンド解釈
4. `VOICEVOX` 応答（`volumeScale=2.5`, `speedScale=1.25`）
5. `notify-send` 通知（認識/完了/エラー）
6. `VacuumTube` / ウィンドウ操作
7. 再待機

デバッグ付き例:

```bash
WHISPER_AGENT_DEBUG=1 \
tmp/whispercpp-listen/tmux_listen_only.sh restart-agent
```

音声応答を止めたい場合:

```bash
WHISPER_AGENT_NO_VOICE=1 \
tmp/whispercpp-listen/tmux_listen_only.sh restart-agent
```

HDMI sink を明示したい場合:

```bash
WHISPER_AGENT_AUDIO_SINK='alsa_output.pci-0000_04_00.1.hdmi-stereo' \
tmp/whispercpp-listen/tmux_listen_only.sh restart-agent
```

## 現在対応している音声コマンド（代表）

音声コマンド実装は `tmp/whispercpp-listen/voice_command_loop.py` の `parse_command()` にある。

- 音楽/BGM
  - `音楽を再生して`
  - `音楽を停止して`
- 動画再生制御
  - `動画を再開して`
  - `動画を再生｜再開して`
  - `動画の再生を止めて`
- ニュース
  - `ニュースライブを再生して`
  - `朝のニュースを見せて`
  - `夕方のニュースが見たい`
- YouTube（VacuumTube）画面操作
  - `YouTubeのホームに移動して`
  - `YouTubeを全画面にして`
  - `YouTubeを大きくして`
  - `YouTubeを小さくして`
  - `4分割モード`

注意:

- `ホーム画面に戻って` 単独では発火しない（他アプリ誤操作防止）
- `YouTube` 明示が必要

## レイテンシ最適化の要点（実測ベース）

- 主要ボトルネックは `whisper.cpp` 推論時間
- `small` は速いが誤認識が増えることがある
- `medium` は精度が上がるが待ち時間が増える
- `voice command loop` 側では以下で体感を改善している
  - VAD `end-silence` 短縮（`listen-only` より短め）
  - VOICEVOX 応答のオーバーラップ再生
  - 同一プロセス内で dispatch（tmux polling 削減）

## ハマりポイント（重要）

### 1) `listener` と `agent` のマイク競合

- `restart-all` のあと `listener` が起動したままだと `agent` と競合する
- `agent` 運用時は `restart-agent` / `restart-agent-all` を使う

### 2) `notify-send` は表示だけ（通知音ではない）

- デスクトップ通知は `notify-send`
- 通知音は別経路（`paplay` / `canberra-gtk-play`）
- `voice command loop` の通知はエラー可視化目的（best-effort）

### 3) VOICEVOX が喋らない（でもコマンドは動く）

- 多くは audio sink 検出失敗
- `logs-agent` で `VOICEVOX audio sink:` を確認
- 必要なら `WHISPER_AGENT_AUDIO_SINK` を明示

### 4) `VacuumTube` 操作が不安定

- `~/vacuumtube.sh` で remote debugging 有効起動しているか確認
- `http://127.0.0.1:9992/json/version` を確認
- `VacuumTube` は CDP + DOM + window geometry を前提に操作する
- 詳細は `vacuumtube` / `desktop-windows-layout` スキル参照

### 5) 短いノイズをコマンド誤認識する / 発話を取りこぼす

- `small` は短い音を誤認識しやすいことがある
- `WHISPER_AGENT_DEBUG=1` で VAD ログを見る
- 長めにはっきり発話する（1秒前後）と安定しやすい
- 必要なら `voice_command_loop.py` の VAD 関連引数を調整

## トラブルシュート手順（短縮版）

1. `status` で `server/agent` 稼働確認
2. `logs-agent` で以下を確認
   - `source=...`（期待マイクか）
   - `transcript #...`
   - `command #... intent=...`
   - `action #... done ...` または `error`
3. `logs-server` でモデルと推論受信を確認
4. `VOICEVOX` の聞こえ方は `audio-speak-voicebox` / `audio-play` スキルで切り分け
5. `VacuumTube` の状態崩れは `vacuumtube` / `desktop-windows-layout` スキルで確認

## 成功条件（報告時）

- どのモードで運用したか（`listen-only` / `agent`）
- 使用モデル（`small` / `medium`）
- 使用マイク source（自動検出 or 明示）
- 期待した文字起こし/コマンド実行ができたか
- UX の手動確認結果（聞こえた・動いた・遅い等）

## ローカル参照

- 管理スクリプト: `tmp/whispercpp-listen/tmux_listen_only.sh`
- listen-only 実装: `tmp/whispercpp-listen/listen_only_whisper_server.py`
- 音声コマンド実装: `tmp/whispercpp-listen/voice_command_loop.py`
- 音声再生（通知音/テストトーン）: `.codex/skills/audio-play/SKILL.md`
- VOICEVOX 発話: `.codex/skills/audio-speak-voicebox/SKILL.md`
- VacuumTube 操作: `.codex/skills/vacuumtube/SKILL.md`
- ウィンドウ配置操作: `.codex/skills/desktop-windows-layout/SKILL.md`
