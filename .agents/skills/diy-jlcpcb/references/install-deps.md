# 道具の入れ方

## 部品 DB (jlcparts の cache.sqlite3)

jlcparts (https://github.com/yaqwsx/jlcparts) が、JLCPCB/LCSC の部品の DB を分割 zip で公開している。取得の手順は、同リポジトリの `.github/workflows/update_components.yaml` が正。2026 年 11 月の時点では次の形だった。

```bash
DATAURL=https://yaqwsx.github.io/jlcparts/data
wget -q "$DATAURL/cache.zip"
for i in $(seq -w 1 99); do wget -q "$DATAURL/cache.z$i" || break; done
7z x cache.zip            # cache.sqlite3 (数 GB) ができる
sqlite3 -readonly cache.sqlite3 "select count(*) from jlc_components"
```

置き場は、作業ツリーの外の、容量のあるところにする。版の日付をメモしておく (在庫と値段は古くなる)。

## ライブ検索 (jlc)

npm の `@jlcpcb/cli` (非公式、JLCPCB とは無関係のコミュニティの道具) が `jlc` コマンドを入れる。

```bash
npm install -g @jlcpcb/cli
jlc search "74HC138" --json --limit 5
```

端末の無い環境 (エージェントのシェル) では `--json` を付ける。付けないと対話の画面が開こうとして落ちる。

## 発注ファイルの書き出し

KiCad 10 の `kicad-cli` (ガーバー、ドリル) と、pcbnew の Python API (BOM と CPL)。入れ方は diy-kicad の [install-deps.md](../../diy-kicad/references/install-deps.md)。

## データシートの図面を読む

```bash
sudo apt install poppler-utils   # pdftoppm, pdftotext
```

図面の寸法は、PDF を画像にして目で読む。pdftotext では図の中の数字の位置が分からない。
