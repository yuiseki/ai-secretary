---
name: owner-attention-call
description: "手動確認や意思決定が必要になったときに、ASEE の owner presence を見て呼びかけ経路を切り替える。owner が見えていれば asay/VOICEVOX + acaption で『ユイさま、…』と話しかけ、見えていなければ ntfy で通知する。"
---

# owner-attention-call Skill

手動確認や返答待ちに入る前に、お嬢様へ気づいていただくための skill です。

- `ASEE` の `/biometric_status` を確認する
- `ownerPresent=true` なら `asay` 経路で音声 + 字幕で呼びかける
- 見えていない、または音声経路が失敗した場合は `ntfy` へフォールバックする

## 使う場面

- 動作確認をお願いしたい
- 判断待ちに入る前に呼びかけたい
- まず部屋にいるかどうかを見て、通知経路を切り替えたい

## 実行

```bash
python3 /home/yuiseki/Workspaces/.codex/skills/owner-attention-call/scripts/call_owner.py \
  --message "ユイさま、動作確認のお願いがあります"
```

返り値は JSON です。`mode` が `speech` なら音声、`ntfy` なら通知です。

## 既定値

- biometric status: `http://127.0.0.1:8765/biometric_status`
- caption overlay: `127.0.0.1:47832`
- VOICEVOX: `http://127.0.0.1:50021`
- speaker: `89`
- volumeScale: `2.5`
- speedScale: `1.25`
- ntfy topic: `NTFY_TOPIC`

## 注意

- この skill は「呼びかけ経路の選択」が責務です
- 実際に確認が必要な作業では、この skill のあとに待機へ入る
- `ownerPresent` が無い古い payload では `ownerCount > 0` を補助判定に使う
