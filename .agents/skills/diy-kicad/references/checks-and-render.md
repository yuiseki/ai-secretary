# 検査と絵

## 検査 (毎回、全部)

```bash
mkdir -p build
kicad-cli sch erc --severity-all --exit-code-violations -o build/erc.rpt board.kicad_sch
kicad-cli pcb drc --schematic-parity --severity-all --exit-code-violations -o build/drc.rpt board.kicad_pcb
```

`--exit-code-violations` で、指摘があれば終了コードが 0 でなくなる。`check.sh` にまとめておき、生成のたびに流す。

指摘の種類ごとの件数:

```bash
grep -E "^\[" build/drc.rpt | sed 's/\].*//' | sort | uniq -c
grep -A4 "^\[clearance" build/drc.rpt   # 場所と相手
```

報告の座標はシートの座標 (mm)。設計の座標に直して、どの部品のどの線かを突き止める。

## よく出る指摘と、この作業で効いた直し方

| 指摘 | 意味 | 効いた直し方 |
|---|---|---|
| `copper_edge_clearance` | 銅が基板の縁に近い (既定 0.3 mm) | 穴の列を内側に寄せる。外形を小さくしすぎた合図 |
| `silk_edge_clearance` | 文字や線が縁に近い | 文字の向きを変える (下の「文字の向き」) |
| `silk_over_copper` | 文字が露出した銅 (パッド) に重なる | 文字をパッドから離す。マスクで覆われた配線の上は問題ない |
| `silk_overlap` | 文字どうし、文字と部品の外形が重なる | 3 文字の名前は 2 文字より長い。向きを変えるか位置をずらす |
| `text_height` | 文字が小さすぎる | 0.65 mm で出た。0.8 mm なら出なかった |
| `starved_thermal` | 熱の逃がしのスポークが、孤立した銅の切れ端につながる | 手はんだの穴は塗りつぶしにつながない (`ZONE_CONNECTION_NONE`)。その穴の GND は専用の配線とビアで取る |
| `unconnected_items`、`via_dangling` (基板を反転したあと) | 接続の情報が古い | 塗りつぶしの前に `board.BuildConnectivity()` |

`pad.SetThermalSpokeAngle(...)` でスポークの向きを変えても、`starved_thermal` は消えなかった (KiCad 10 で観測。描かれた絵も変わらなかった)。塗りつぶしの外形を縁から内側に縮めても消えなかった。

### 文字の向き

穴の列の名前 (VCC、GND など) を、穴から外へ向けて (辺に垂直に) 書くと、3 文字で約 2.4 mm の帯を縁の側に使う。辺と平行に書けば、文字の高さ (0.8 mm) だけで済み、基板を小さくできる。

## 絵に出す

```bash
kicad-cli pcb export svg --layers "F.Cu,F.SilkS,Edge.Cuts,F.Mask,F.Fab" --page-size-mode 2 --exclude-drawing-sheet -o front.svg board.kicad_pcb
kicad-cli pcb export svg --mirror --layers "B.Cu,B.SilkS,Edge.Cuts,B.Fab" --page-size-mode 2 --exclude-drawing-sheet -o back.svg board.kicad_pcb
rsvg-convert -w 1600 -b white front.svg -o front.png
```

- `--page-size-mode 2` で基板の大きさに合わせて切り取る。`--mirror` で裏から見た向きになる
- 1 つの層 (F.Cu だけ) を出すと、塗りつぶしの形や、スポークの切れ端が見える
- 細かいところは、大きく出して切り抜く (`rsvg-convert -w 4200` のあと PIL で crop)
- 人に見てもらう絵は、相手が開ける場所に置き、何を見てほしいかを添える
