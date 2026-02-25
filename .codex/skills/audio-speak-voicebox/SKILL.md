---
name: audio-speak-voicebox
description: "この KDE Plasma / PipeWire 環境で VOICEBOX（VOICEVOX）を使ってオーナーに音声で話しかける。VOICEVOX API(50021) の確認、音声合成、HDMI sink への再生、volumeScale=2.5 の運用、ハマりポイント切り分けを行う。ユーザーが『VOICEBOXで話しかけて』『VOICEVOXで喋って』など依頼したときに使う。"
---

# audio-speak-voicebox Skill

このシステムで `VOICEBOX`（実体は `VOICEVOX`）を使い、オーナーに音声で話しかけるための専用スキルです。

目的は「合成に成功する」ではなく、**オーナーに実際に聞こえる**ことです。  
そのため、VOICEVOX API だけでなく、再生先（PipeWire/PulseAudio sink）まで含めて扱います。

## 前提

- デスクトップ: KDE Plasma（X11）
- 音声基盤: PipeWire（PulseAudio 互換）
- VOICEVOX API: `http://127.0.0.1:50021`
- 推奨再生コマンド: `paplay`
- よく使うコマンド:
  - `curl`
  - `jq`
  - `pactl`
  - `paplay`
  - `python3`（URLエンコード補助）

## この環境の実測値（重要）

- `VOICEVOX` バージョン: `0.25.1`（実測）
- `Default Sink`（実測）:
  - `alsa_output.pci-0000_04_00.1.hdmi-stereo`（HDMI / テレビ）
- 話者ID:
  - `speaker=3` で再生成功実績あり
- 既定の音量方針:
  - `volumeScale=2.5`

補足:

- `volumeScale=2.5` は聞こえやすいが、わずかにクリップ気味になることがある
- 実測で `clip_like_samples` は少量（約 `0.032%`）
- 「確実に聞こえる」優先なら `2.5` を使ってよい

## 重要ルール

- `VOICEBOX` と言われても実処理は `VOICEVOX API` を使う
- まず `:50021` が生きているか確認する
- 再生先は `paplay --device=<sink>` で明示する
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
2. 出力先（sink）確認
3. 音声クエリ生成
4. `volumeScale=2.5` を適用
5. WAV 合成
6. HDMI sink に `paplay` で再生
7. オーナーに聞こえたか確認

## 1) VOICEVOX API 生存確認

```bash
curl -fsS http://127.0.0.1:50021/version
```

失敗する場合:

- VOICEVOX アプリが起動していない
- ポート `50021` が開いていない

## 2) 出力先（sink）確認

VacuumTube の音がテレビから出ているなら、同じ HDMI sink を使う。

```bash
pactl info | sed -n 's/^Default Sink: //p'
pactl list short sinks
```

この環境の基本:

- `alsa_output.pci-0000_04_00.1.hdmi-stereo` を優先

## 3) オーナー向け発話（推奨テンプレート）

### 最小実用コマンド（`volumeScale=2.5`）

```bash
set -euo pipefail

TEXT='ユイさま、こんにちは。VOICEVOXの音声テストです。'
SPEAKER=3
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

paplay --device="$SINK" "$OUT"
```

### 発話テンプレート例（敬語・短め）

- `ユイさま、こんにちは。`
- `ユイさま、作業が終わりました。`
- `ユイさま、5分ほど休憩しませんか。`
- `ユイさま、確認をお願いします。`

## 4) 話者IDの選び方

まずは `speaker=3` を使う（この環境で再生実績あり）。

必要なら一覧確認:

```bash
curl -fsS http://127.0.0.1:50021/speakers | jq '.[].name'
```

補足:

- 話者名と style ID は環境差がある
- 迷ったら「一覧確認 → 1つ選ぶ → 実再生で確認」

## 5) 音量ポリシー（この環境）

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

### 2. 合成は成功したのに聞こえない

- 原因の多くは再生先（sink）の不一致
- `paplay --device=<sink>` で明示する
- `VacuumTube` の音が出ている sink と揃える

### 3. システム音量最大なのに小さい

- PipeWire の sink 音量・ストリーム音量以外に、合成音声のラウドネス差がある
- 対策は `volumeScale` を上げる（この環境では `2.5`）

### 4. `notify-send` の通知音と混同する

- `notify-send` は通知表示であり、音声発話の再生とは別経路
- VOICEVOX は `paplay` で再生する方が確実

### 5. 日本語テキストで `audio_query` が失敗する

- `text=` の URL エンコード漏れ
- `python3 -c 'urllib.parse.quote(...)'` を使う

### 6. VOICEVOX 側は生きているが再生コマンドが無音

- `SINK` の誤り
- `paplay` が別 sink に流れている
- 必要なら `pactl info` / `pactl list short sinks` を再確認

## デバッグ手順（聞こえないとき）

1. `curl -fsS http://127.0.0.1:50021/version` で API 確認
2. `pactl info | sed -n 's/^Default Sink: //p'` で sink 確認
3. `paplay --device=<sink> /usr/share/sounds/freedesktop/stereo/bell.oga` で効果音確認
4. それでも分からなければ 1kHz テストトーンで確認（`audio-play` スキル参照）
5. VOICEVOX の `volumeScale` を `2.5` に上げて再試行

## 成功条件（報告時）

- 話した文面
- `speaker` ID
- `volumeScale`（このスキルでは既定 `2.5`）
- 再生先 sink
- ユーザーの「聞こえた」確認

## ローカル参照

- 汎用音再生スキル: `.codex/skills/audio-play/SKILL.md`
- VOICEVOX API: `http://127.0.0.1:50021`
- 典型 HDMI sink: `alsa_output.pci-0000_04_00.1.hdmi-stereo`
