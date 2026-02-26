---
name: vacuumtube-silent-live-cam
description: "VacuumTube を2台目インスタンス（無音 / system-level mute）で並行起動し、CDP (:9993 既定) で TV版 YouTube のチャンネル streams からライブカメラ系タイル（例: FNN『いまの渋谷』）を高速に選んで開く。既存のメイン VacuumTube を維持したまま別ウィンドウだけ操作したいときに使う。"
---

# vacuumtube-silent-live-cam Skill

無音の 2nd `VacuumTube` を使って、TV版 YouTube のチャンネル `streams` からライブカメラ系タイルを開くためのスキルです。

このスキルは以下を扱います。

- メイン `VacuumTube` を維持したまま 2 台目を `tmux` で起動
- 2 台目だけを `PipeWire/PulseAudio` の `null sink` に流して無音化
- メインのログイン状態を引き継ぐため `~/.config/VacuumTube` を複製して使用
- `CDP :9993` で 2 台目だけを操作
- チャンネル個別ページの「数秒で別動画へ自動遷移」レースを、単一高速スクリプトで回避

## 前提

- 既存の `VacuumTube` スキル前提の環境が動作している
  - `~/vacuumtube.sh`
  - `/opt/VacuumTube/vacuumtube`
- `tmux`, `curl`, `jq`, `node`, `pactl`, `rsync`, `xdpyinfo` が利用可能
- KDE/X11 にログイン済み（`DISPLAY` は再起動後に `:0` / `:1` が変わりうる）

## 重要ルール / 注意点

- **同一 `user-data-dir` を同時共有しない**
  - 破損やロック競合の原因になるため、`~/.config/VacuumTube` を複製して使う
- **複製側の `flags.txt` の `--remote-debugging-port` を `9993` に直す**
  - これを忘れると 2 台目の DevTools HTTP server が `9992` と衝突する
- **チャンネル個別ページは数秒で自動遷移することがある**
  - タイル解析は「遷移→即解析→ID抽出→即 `#/watch`」を 1 本のスクリプトで実行する
- **`#/browse` 単体ではタイルが 0 件になることがある**
  - `#/browse?c=<channelId>` を使う（FNN は `UCoQBJMzcwmXrRSHBFAlTsIw`）

## 使い方（最小）

### 1) 無音 2nd VacuumTube を起動 / 更新

`scripts/start_silent_instance.sh` は以下をまとめて実行します。

- `vacuumtube_silent` (`null sink`) の作成/再利用 + mute
- `~/.config/VacuumTube` を複製 (`user-data-clone`)
- 複製側と `XDG_CONFIG_HOME` 側の `flags.txt` を `9993` に補正
- `tmux` セッション `vacuumtube-bg-2` で 2 台目起動
- `CDP :9993` 応答確認

```bash
.codex/skills/vacuumtube-silent-live-cam/scripts/start_silent_instance.sh
```

よく使うオプション:

```bash
.codex/skills/vacuumtube-silent-live-cam/scripts/start_silent_instance.sh \
  --display :0 \
  --port 9993 \
  --session vacuumtube-bg-2 \
  --sink vacuumtube_silent
```

### 2) TV版チャンネル streams からライブタイルを高速選択

`scripts/open_tv_channel_live_tile_fast.js` は以下を 1 回のCDPセッションで高速実行します。

- TVホームへ戻す（SPA状態リセット）
- `browse?c=` へ遷移
- 可視タイルからキーワード一致のタイルを高速抽出
- タイル内部データから `videoId` を直接抽出（優先）
- 抽出できない場合は `Enter` / CDP mouse をフォールバック
- 再生後にタイトル/本文で検証

```bash
node .codex/skills/vacuumtube-silent-live-cam/scripts/open_tv_channel_live_tile_fast.js \
  --cdp-port 9993 \
  --browse-url 'https://www.youtube.com/tv/@FNNnewsCH/streams#/browse?c=UCoQBJMzcwmXrRSHBFAlTsIw' \
  --keyword 'いまの渋谷' \
  --verify-regex '渋谷|スクランブル交差点|Shibuya'
```

成功時は JSON を返します（`videoId`, `finalHref`, `method` など）。

別例（Cerevo / 秋葉原ライブカメラ）:

```bash
node .codex/skills/vacuumtube-silent-live-cam/scripts/open_tv_channel_live_tile_fast.js \
  --cdp-port 9993 \
  --browse-url 'https://www.youtube.com/tv/@Cerevolivecamera/streams#/browse?c=UCrGS8VyrgCqYwaogH5bQpxQ' \
  --keyword '秋葉原ライブカメラ' \
  --verify-regex '秋葉原|Akihabara|Cerevo'
```

別例（TBS NEWS DIG / 新宿駅前ライブカメラ）:

```bash
node .codex/skills/vacuumtube-silent-live-cam/scripts/open_tv_channel_live_tile_fast.js \
  --cdp-port 9993 \
  --browse-url 'https://www.youtube.com/tv/@tbsnewsdig/streams#/browse?c=UC6AG81pAkf6Lbi_1VC5NmPA' \
  --keyword '新宿駅前のライブカメラ' \
  --verify-regex '新宿|Shinjuku|TBS NEWS DIG|JNN'
```

## 既知パターン（FNN / Cerevo / TBS NEWS DIG）

### FNN / いまの渋谷

- URL パスは `https://www.youtube.com/tv/@FNNnewsCH/streams` を使える
- タイル一覧は `#/browse?c=UCoQBJMzcwmXrRSHBFAlTsIw` が安定
- `#/browse`（`c=` なし）だと CDP上でタイル 0 件になる場合がある

### Cerevo / 秋葉原ライブカメラ

- URL パスは `https://www.youtube.com/tv/@Cerevolivecamera/streams` を使える
- チャンネルID（`c=`）は `UCrGS8VyrgCqYwaogH5bQpxQ`
- タイル一覧は `#/browse?c=UCrGS8VyrgCqYwaogH5bQpxQ` が安定
- `#/browse`（`c=` なし）だと数秒で `#/` に戻されやすく、ホームのおすすめタイルが混在して誤選択しやすい
- `秋葉原ライブカメラ` は `オノデンch` 等の別チャンネルおすすめにも混ざることがあるため、`verify-regex` に `Cerevo` を含めると安全

### TBS NEWS DIG / 新宿駅前ライブカメラ

- URL パスは `https://www.youtube.com/tv/@tbsnewsdig/streams` を使える
- チャンネルID（`c=`）は `UC6AG81pAkf6Lbi_1VC5NmPA`
- タイル一覧は `#/browse?c=UC6AG81pAkf6Lbi_1VC5NmPA` が安定
- タイル文言は `【LIVE】新宿駅前のライブカメラ ... Shinjuku, Tokyo JAPAN | TBS NEWS DIG` のように長いので、`keyword` は短め（`新宿駅前のライブカメラ`）が安定
- 取得済み `videoId` に直接 `#/watch?v=...` で飛ばした際、まれにアカウント選択画面に落ちることがある
  - その場合は既定フォーカスの `YuisekinTV` で `Enter` を 1 回送ると復帰し、そのまま目的動画に戻ることがある

## 確認コマンド

```bash
curl -fsS http://127.0.0.1:9992/json/list | jq -r '.[] | select(.type=="page") | .url'
curl -fsS http://127.0.0.1:9993/json/list | jq -r '.[] | select(.type=="page") | .url'
pactl get-sink-mute vacuumtube_silent
```

期待値:

- `:9992` はメインの `VacuumTube` のページ（維持）
- `:9993` は無音側のターゲットページ
- `vacuumtube_silent` は `Mute: yes`

## トラブルシュート

### 2 台目は起動するのに `:9993` のCDPが出ない

- 複製側 `user-data-clone/flags.txt` が `9992` のままになっている可能性が高い
- エラーログ例: `Cannot start http server for devtools` / `bind() failed`
- `scripts/start_silent_instance.sh` を再実行（`flags.txt` 補正を含む）

### 無音側が Web版 URL に落ちる / TVホームへ戻る

- `/tv/@.../streams` 単体は TVホーム (`#/`) に戻ることがある
- `#/browse?c=<channelId>` を使う
- その後に `#/watch?v=<videoId>` へ遷移させる

### 「いまの渋谷」以外の動画が開く

- チャンネル個別ページの自動遷移レースが原因
- 手動操作より `open_tv_channel_live_tile_fast.js` を優先する

## 関連スキル

- `vacuumtube`（VacuumTube の CDP 操作の基本）
- `system-reboot-bringup`（再起動後の常駐プロセス復旧）
- `desktop-windows-layout`（2台目 VacuumTube の配置調整）
