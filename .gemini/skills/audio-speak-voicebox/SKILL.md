---
name: audio-speak-voicebox
description: "この KDE Plasma / PipeWire 環境で VOICEBOX（VOICEVOX）を使ってオーナーに音声で話しかける。VOICEVOX API(50021) でWAV合成し、Tauri字幕オーバーレイPoC (IPC) 経由で音声+字幕を同期再生する。必要時のみ paplay 直再生へフォールバックする。"
---

# audio-speak-voicebox Skill

このシステムで `VOICEBOX`（実体は `VOICEVOX`）を使い、オーナーに音声で話しかけるための専用スキルです。

目的は「合成に成功する」ではなく、**オーナーに実際に聞こえる + 字幕が同期表示される**ことです。  
この環境では、`VOICEVOX API` でWAVを作り、`tmp/tauri-caption-overlay-poc` の IPC サーバーへ渡して再生するのを主経路とします。

## 前提

- デスクトップ: KDE Plasma（X11）
- 音声基盤: PipeWire（PulseAudio 互換）
- VOICEVOX API: `http://127.0.0.1:50021`
- 推奨再生経路: `Tauri caption overlay IPC`（主経路）
- フォールバック再生コマンド: `paplay`
- よく使うコマンド:
  - `curl`
  - `jq`
  - `pactl`
  - `paplay`（フォールバック）
  - `tmux`（オーバーレイ起動管理）
  - `python3`（URLエンコード補助）

## この環境の実測値（重要）

- `VOICEVOX` バージョン: `0.25.1`（実測）
- 字幕オーバーレイ IPC:
  - `127.0.0.1:47832`（`tmp/tauri-caption-overlay-poc`）
- `Default Sink`（実測）:
  - `alsa_output.pci-0000_04_00.1.hdmi-stereo`（HDMI / テレビ）
- 話者ID:
  - `speaker=89`（Voidoll）を既定運用
- 既定の音量方針:
  - `volumeScale=2.5`

補足:

- `volumeScale=2.5` は聞こえやすいが、わずかにクリップ気味になることがある
- 実測で `clip_like_samples` は少量（約 `0.032%`）
- 「確実に聞こえる」優先なら `2.5` を使ってよい

## 重要ルール

- `VOICEBOX` と言われても実処理は `VOICEVOX API` を使う
- まず `:50021` が生きているか確認する
- まず `Tauri` 字幕オーバーレイ IPC を使う（字幕と音声の同期を確保）
- `paplay --device=<sink>` はデバッグ/フォールバック経路
- 合成成功と再生成功は別問題
  - WAV が生成できても sink が違うと聞こえない
- 再生後は必ずオーナーに「聞こえたか」を確認する（手動検証）

## 典型ユースケース

- `VOICEBOXで私に話しかけて`
- `VOICEVOXで「休憩しよう」と言って`
- `作業完了を音声で知らせて`
- `ちょっと大きめの音量で喋って`

## 基本ワークフロー（推奨）

1. VOICEVOX API 生存確認
2. Tauri 字幕オーバーレイ起動確認（IPC）
3. 出力先（sink）確認（フォールバック/デバッグ用）
4. 音声クエリ生成
5. `volumeScale=2.5` を適用
6. WAV 合成
7. IPC で `text + wav_path` をオーバーレイへ送信（同期再生）
8. オーナーに聞こえたか確認

## 1) VOICEVOX API 生存確認

```bash
curl -fsS http://127.0.0.1:50021/version
```

失敗する場合:

- VOICEVOX アプリが起動していない
- ポート `50021` が開いていない

## 2) Tauri 字幕オーバーレイ起動確認（IPC）

まず字幕オーバーレイが tmux 管理で起動していることを確認する。

```bash
tmp/whispercpp-listen/tmux_listen_only.sh status
tmp/whispercpp-listen/tmux_listen_only.sh start-overlay
tmp/whispercpp-listen/tmux_listen_only.sh logs-overlay
```

期待:

- `overlay: RUNNING`
- `overlay endpoint ready: 127.0.0.1:47832`

## 3) 出力先（sink）確認（フォールバック/デバッグ用）

VacuumTube の音がテレビから出ているなら、同じ HDMI sink を使う。

```bash
pactl info | sed -n 's/^Default Sink: //p'
pactl list short sinks
```

この環境の基本:

- `alsa_output.pci-0000_04_00.1.hdmi-stereo` を優先

## 4) オーナー向け発話（推奨テンプレート）

### 最小実用コマンド（`volumeScale=2.5`, Tauriオーバーレイ経由）

```bash
set -euo pipefail

TEXT='承知しました、動作確認をしています。'
SPEAKER=89
VOLUME_SCALE=2.5
SINK=$(pactl info | sed -n 's/^Default Sink: //p')
OUT=/tmp/voicevox-owner-speak.wav
Q_RAW=/tmp/voicevox-owner-query-raw.json
Q=/tmp/voicevox-owner-query.json
TEXT_ENC=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1]))' "$TEXT")

curl -fsS -X POST \
  "http://127.0.0.1:50021/audio_query?text=${TEXT_ENC}&speaker=${SPEAKER}" \
  -H 'accept: application/json' > "$Q_RAW"

jq --argjson volume "$VOLUME_SCALE" '.volumeScale = $volume' "$Q_RAW" > "$Q"

curl -fsS -X POST \
  "http://127.0.0.1:50021/synthesis?speaker=${SPEAKER}" \
  -H 'Content-Type: application/json' \
  --data-binary @"$Q" > "$OUT"

python3 - <<'PY' "$TEXT" "$OUT"
import json, socket, sys
text, wav = sys.argv[1], sys.argv[2]
payload = {"type":"speak","text": text, "wav_path": wav, "wait": True}
with socket.create_connection(("127.0.0.1", 47832), timeout=5) as s:
    s.sendall((json.dumps(payload, ensure_ascii=False) + "\n").encode("utf-8"))
    s.shutdown(socket.SHUT_WR)
    print(s.recv(4096).decode("utf-8").strip())
PY
```

補足:

- `SINK` はこのテンプレートでは直接使わない（Tauri 側が再生）
- `paplay` は IPC が死んでいるときのフォールバック

### 発話テンプレート例（敬語・短め）

- `ユイさま、こんにちは。`
- `ユイさま、作業が終わりました。`
- `ユイさま、5分ほど休憩しませんか。`
- `ユイさま、確認をお願いします。`

## 5) 話者IDの選び方

この環境の既定は `speaker=89`（Voidoll）。

必要なら一覧確認:

```bash
curl -fsS http://127.0.0.1:50021/speakers | jq '.[].name'
```

補足:

- 話者名と style ID は環境差がある
- 迷ったら「一覧確認 → 1つ選ぶ → 実再生で確認」

## 6) 音量ポリシー（この環境）

この環境ではシステム音量最大でも、VOICEVOX 音声が体感で小さく感じることがある。  
そのため、このスキルでは既定を `volumeScale=2.5` とする。

運用目安:

- `1.0`: 標準（小さく感じやすい）
- `1.5`: 改善するがまだ控えめな場合がある
- `2.0`〜`2.3`: バランス重視
- `2.5`: 聞こえやすさ優先（この環境の既定）

注意:

- `2.5` では軽微なクリップが発生しうる
- ノイズや歪みが気になる場合は `2.2` 前後に下げる

## ハマりポイント（実測ベース）

### 1. 「VOICEBOX」と言われたが API は VOICEVOX

- ユーザー発話の `VOICEBOX` は `VOICEVOX` を意味していることがある
- 実装上は `http://127.0.0.1:50021` を使う

### 2. 合成は成功したのに聞こえない（フォールバック経路）

- 原因の多くは再生先（sink）の不一致
- `paplay --device=<sink>` で明示する
- `VacuumTube` の音が出ている sink と揃える

### 3. システム音量最大なのに小さい

- PipeWire の sink 音量・ストリーム音量以外に、合成音声のラウドネス差がある
- 対策は `volumeScale` を上げる（この環境では `2.5`）

### 4. `notify-send` / overlay 通知と混同する

- 通知字幕（overlay `notify`）と VOICEVOX 発話（overlay `speak`）は別リクエスト
- 音声発話は `speak(text + wav_path)` を使う

### 5. 日本語テキストで `audio_query` が失敗する

- `text=` の URL エンコード漏れ
- `python3 -c 'urllib.parse.quote(...)'` を使う

### 6. VOICEVOX 側は生きているが再生されない / 字幕しか出ない

- Tauri overlay IPC が未起動（`127.0.0.1:47832` に繋がらない）
- Tauri 側の音声出力初期化失敗（`logs-overlay` を確認）
- フォールバック検証として `paplay --device=<sink> "$OUT"` で切り分け

## デバッグ手順（聞こえないとき）

1. `curl -fsS http://127.0.0.1:50021/version` で API 確認
2. `pactl info | sed -n 's/^Default Sink: //p'` で sink 確認
3. `tmp/whispercpp-listen/tmux_listen_only.sh logs-overlay` で IPC/再生ログ確認
4. `paplay --device=<sink> /usr/share/sounds/freedesktop/stereo/bell.oga` で効果音確認
5. それでも分からなければ 1kHz テストトーンで確認（`audio-play` スキル参照）
6. VOICEVOX の `volumeScale` を `2.5` に上げて再試行

## 成功条件（報告時）

- 話した文面
- `speaker` ID
- `volumeScale`（このスキルでは既定 `2.5`）
- 再生先 sink
- ユーザーの「聞こえた」確認

## ローカル参照

- 汎用音再生スキル: `.codex/skills/audio-play/SKILL.md`
- VOICEVOX API: `http://127.0.0.1:50021`
- 字幕オーバーレイ PoC: `tmp/tauri-caption-overlay-poc`
- 音声待ち受け tmux 管理: `tmp/whispercpp-listen/tmux_listen_only.sh`
- 典型 HDMI sink: `alsa_output.pci-0000_04_00.1.hdmi-stereo`
