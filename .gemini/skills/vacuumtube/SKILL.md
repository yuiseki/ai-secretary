---
name: vacuumtube
description: "VacuumTube（/opt/VacuumTube/vacuumtube）を Chromium や playwright ではなく直接 remote debugging（CDP, 既定: http://127.0.0.1:9992）で操作して、YouTube TV のホームや視聴画面から BGM・音楽・ニュース動画を選択/再生する。ユーザーが「BGM再生して」「音楽再生して」「ライブニュース再生して」「国連総会の最新ニュース動画見たい」など依頼したときに使う。"
---

# vacuumtube Skill

VacuumTube を直接操作するためのスキルです。`Chromium` / `playwright-cli` を使うのではなく、VacuumTube の Electron/Chromium に対して **CDP (Chrome DevTools Protocol)** で接続して DOM を読み、動画タイルを選択します。

## 前提

- VacuumTube 本体: `/opt/VacuumTube/vacuumtube`
- Remote debugging: `127.0.0.1:9992`
- 推奨起動: `~/vaccumetube.sh`
  - `~/.config/VacuumTube/flags.txt` に `--remote-debugging-port=9992` を設定して起動する

確認:

```bash
curl -fsS http://127.0.0.1:9992/json/version
curl -fsS http://127.0.0.1:9992/json/list | jq '.[] | {type,title,url}'
```

## 重要ルール

- `playwright-cli` や通常の Chromium 操作に逃げない。対象は **VacuumTube**。
- スクリーンショット前提で判断しない。CDP で DOM を見る。
- `Esc` を連打しない。
  - 画面状態によっては終了/想定外遷移の原因になる。
  - 戻る/ホーム遷移はまず `location.hash` を使う。
- VacuumTube 設定オーバーレイ（`#vt-settings-overlay-root`）が重なっている場合がある。
  - DOM で存在判定し、必要なら `display:none` / `visibility:hidden` で一時的に退避してからタイル選択する。

## 典型ユースケース

- `BGM再生して`
- `音楽再生して`
- `ライブニュース再生して`
- `国連総会の最新ニュース動画見たい`

## 基本ワークフロー（推奨）

1. `:9992` の CDP エンドポイントを確認
2. `json/list` から `youtube.com/tv` の `page` target を取得
3. CDP (`Runtime`, `Page`, 必要なら `Input`) を有効化
4. 現在ルートを確認
   - `location.hash` が `#/watch?...` なら、必要に応じて `location.hash = '#/'` でホームへ戻す
5. DOM を横断（shadow DOM 含む）して `ytlr-tile-renderer` を列挙
6. 可視タイルだけを抽出し、要求に応じてスコアリング
7. 選択
   - まず DOM の `tile.click()` / `focus()`
   - 反応しない場合はタイル中心座標へ `Input.dispatchMouseEvent`
8. `location.hash` が `#/watch?v=...` に変わったら成功
9. 必要なら再生状態を確認（ただし選択直後の `paused=true` は瞬間値のことがある）

## 画面状態の判定（CDP / Runtime.evaluate）

最低限見る値:

- `location.href`, `location.hash`
- `document.title`
- `document.activeElement?.tagName`
- `document.body?.innerText`（先頭だけ）
- `#vt-settings-overlay-root` の可視状態
- `ytlr-tile-renderer`（可視タイル数とタイトル文字列）

動画要素の確認（任意）:

```js
const v =
  window.yt?.player?.utils?.videoElement_ || document.querySelector("video");
```

取得項目:

- `v.paused`
- `v.currentTime`
- `v.muted`
- `v.volume`

注意:

- **選択直後**は `paused=true`, `currentTime=0`, `muted=true` が見えることがある
- ユーザー体感で再生されていれば、route 遷移確認を優先して成功扱いにしてよい

## 選択ロジック（ヒューリスティック）

### 1) BGM / 音楽

優先キーワード（加点）:

- `ambient`, `ambience`, `relax`, `study`, `focus`, `music`, `bgm`, `lofi`, `jazz`, `piano`, `sleep`, `atmosphere`, `chill`
- `deep focus`, `flow state`, `serene`, `ethereal`, `winter`, `hyperflow`

除外（減点）:

- `news`, `速報`, `総理`, `国会`, `ウクライナ` などニュース系

### 2) ライブニュース / 最新ニュース

優先キーワード（加点）:

- `live`, `news`, `breaking`, `ライブ`, `速報`, `会見`, `ANN`, `TBS`, `NHK`, `BBC`, `Reuters`
- 要求語に合わせる: `国連`, `国連総会`, `停戦`, `ウクライナ` など

鮮度の目安（加点）:

- `minutes ago`, `hours ago`, `分前`, `時間前`, `live`

除外（減点）:

- 長尺 BGM / ambience / focus music など

## 国連総会など、具体トピック要求の扱い

優先順:

1. **ホーム可視タイル**に該当トピックがあるか CDP DOM で確認して再生
2. 可視タイルになければ、ホーム内の非可視タイル（DOM上に存在）をスコアリングして選択
3. それでも無ければ、外部検索/YouTube検索で動画IDを特定して `location.hash = '#/watch?v=<VIDEO_ID>'` を使う

補足:

- 「最新」を求められた場合は、タイトルだけでなく `○分前/○時間前` 等の表示を優先する
- 取得結果が曖昧なら、候補を 2-3 件提示して確認を取る

## クリック手順（実務上のコツ）

- DOM `click()` が効かないことがある
- その場合、**タイル中心座標**に対して CDP の mouse event を送ると通りやすい
- 先に `wmctrl -a VacuumTube` で前面化しておくと安定しやすい

例（前面化）:

```bash
DISPLAY=:1 wmctrl -a VacuumTube
```

## よくある失敗と対処

- `curl http://127.0.0.1:9992/json/version` が失敗:
  - VacuumTube が remote debugging なしで起動している
  - `~/vaccumetube.sh` で起動し直す
- `json/list` に `youtube.com/tv` がない:
  - 起動直後の読み込み途中。数秒待って再試行
- クリックしても遷移しない:
  - DOM `click()` → 座標クリックの順で試す
- 画面がおかしい / タイルが少ない:
  - VacuumTube の設定オーバーレイが重なっていないか確認
- `Esc` で戻れない/変な画面になる:
  - `Esc` 多用をやめて `location.hash = '#/'` を優先

## 実行時に見るべき最低限の成功条件

- `location.hash` が `#/watch?v=...` になった
- `document.body.innerText` 先頭が視聴画面らしい表示（再生時間/概要/チャンネル登録など）に変化した
- （任意）`video.currentTime` が増加、またはユーザー体感で再生確認済み

## ローカル参照

- VacuumTube ソース: `repos/_youtube/VacuumTube`
- 手動起動スクリプト: `~/vaccumetube.sh`
- 本体バイナリ: `/opt/VacuumTube/vacuumtube`
