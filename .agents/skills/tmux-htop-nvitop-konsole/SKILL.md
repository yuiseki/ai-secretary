---
name: tmux-htop-nvitop-konsole
description: "tmux セッションに htop（左）/ nvitop（右）の垂直分割レイアウトをスクリプトで再現し、KDE デスクトップの Konsole からその tmux セッションへアタッチする。ユーザーが『htop+nvitop の監視tmuxを再現したい』『Konsoleでtmux監視画面を開きたい』ときに使う。"
---

# tmux-htop-nvitop-konsole Skill

`tmux` の監視画面（左 `htop` / 右 `nvitop`）を再現し、`Konsole` で attach するスキルです。

このスキルは以下を扱います。

- `tmux` セッション作成（左右2ペイン）
- 左ペイン: `htop`
- 右ペイン: `nvitop`
- `Konsole` をデスクトップ上で起動して `tmux attach`
- 既存セッションの再利用 / 明示再作成（`--recreate`）

## 前提

- `tmux`, `konsole`, `htop`, `nvitop`, `xdpyinfo` が利用可能
- KDE Plasma / X11 デスクトップにログイン済み
- `DISPLAY` は再起動後に `:0` / `:1` が変わりうる（スクリプトは `auto` 検出対応）

## 重要ルール / 注意点

- 既存セッションを壊したくない場合は `--recreate` を付けない
- **現在の状態を正確に再現したい**場合は `--recreate` を付ける
- `tmux list-panes` では `nvitop` が `python` と表示されることがある
  - `nvitop` が Python 製のため正常
- `Konsole` 起動は GUI が必要
  - SSH セッション等で実行する場合は `DISPLAY` / `XAUTHORITY` を明示するか、`attach-cli` を使う
- Konsole 内から起動する場合、`TMUX` / `KONSOLE_DBUS_*` の継承で既存ウィンドウへ寄ることがある
  - 付属スクリプトは `Konsole` 起動前にこれらを `unset` して新しいウィンドウになりやすくしている

## スクリプト

- 実行スクリプト: `.codex/skills/tmux-htop-nvitop-konsole/scripts/tmux_htop_nvitop_konsole.sh`

主なコマンド:

- `open`（既定）: レイアウトを用意して `Konsole` attach
- `create`: レイアウトだけ作る（`Konsole` を開かない）
- `attach`: 既存セッションに `Konsole` attach
- `attach-cli`: 現在の端末で `tmux attach`
- `status`: pane 状態確認
- `kill`: セッション削除

## よく使う例

### 1) 現在の状態を再現して Konsole で開く（推奨）

```bash
.codex/skills/tmux-htop-nvitop-konsole/scripts/tmux_htop_nvitop_konsole.sh \
  open \
  --session 1 \
  --recreate
```

補足:

- `--session 1` は、いま確認した `tmux` セッション `1` を再現したい場合の例
- セッション名は `sysmon` など任意の名前でもよい

### 2) まず tmux だけ作って中身を確認する

```bash
.codex/skills/tmux-htop-nvitop-konsole/scripts/tmux_htop_nvitop_konsole.sh \
  create \
  --session sysmon \
  --recreate
```

### 3) 既存セッションを Konsole で開く

```bash
.codex/skills/tmux-htop-nvitop-konsole/scripts/tmux_htop_nvitop_konsole.sh \
  attach \
  --session sysmon
```

### 4) SSH / 現在の端末で直接 attach（GUI不要）

```bash
.codex/skills/tmux-htop-nvitop-konsole/scripts/tmux_htop_nvitop_konsole.sh \
  attach-cli \
  --session sysmon
```

## 状態確認

```bash
.codex/skills/tmux-htop-nvitop-konsole/scripts/tmux_htop_nvitop_konsole.sh \
  status \
  --session 1
```

期待値の例:

- `pane=0 cmd=htop`
- `pane=1 cmd=python`（`nvitop` の可能性あり）
- `window_layout=...{...,...}`（左右2ペイン）

## カスタマイズ

環境変数で pane コマンドを差し替え可能:

```bash
HTOP_CMD='htop' \
NVITOP_CMD='nvitop --monitor full' \
.codex/skills/tmux-htop-nvitop-konsole/scripts/tmux_htop_nvitop_konsole.sh \
  open --session sysmon --recreate
```

Konsole 関連:

```bash
.codex/skills/tmux-htop-nvitop-konsole/scripts/tmux_htop_nvitop_konsole.sh \
  open \
  --session sysmon \
  --profile 'Shell' \
  --hold
```

## トラブルシュート

### `konsole` が `could not connect to display` で失敗する

- `DISPLAY` が実デスクトップとズレている可能性が高い
- `--display auto`（既定）を使う
- 必要なら `--display :0 --xauthority ~/.Xauthority` を明示する

### `nvitop` が見つからない

- PATH 上に `nvitop` がない可能性がある
- `NVITOP_CMD=/path/to/nvitop` を指定する

### 既存セッションのペイン構成が違う

- `--recreate` を付けて作り直す

## 手動確認（必須）

- Konsole がデスクトップ上で開くこと
- `tmux` 内が左右分割になっていること
- 左が `htop`、右が `nvitop`（`tmux` 的には `python` 表示でも可）

## 関連スキル

- `desktop-windows-layout`（Konsole ウィンドウの配置調整）
