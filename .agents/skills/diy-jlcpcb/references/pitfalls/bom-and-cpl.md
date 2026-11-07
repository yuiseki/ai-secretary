# BOM と CPL の書き方

## BOM: LCSC の部品番号ごとに 1 行

同じ部品番号の部品は、Designator をまとめて 1 行に書く (例: `"J7,J8"`)。同じ部品番号を複数の行に分けると、JLCPCB は行をまとめたうえで Designator を繰り返し、部品が水増しされる (3 行に分けた J1-J3 が 9 個として扱われた例がある)。

列は `Comment, Designator, Footprint, LCSC Part #`。Comment にカンマを入れない (CSV のセルが崩れる)。値が部品ごとに違うときは、Comment にフットプリント名を入れておけばよい。

## CPL: 部品の中心で、ガーバーと同じ原点で

列は `Designator, Mid X, Mid Y, Layer, Rotation`。JLCPCB は部品をその中心で置く。

- KiCad のピンソケットのフットプリント (`PinSocket_1x07_P2.54mm_Vertical` など) は原点が 1 番ピンにある。中心はパッドの座標の最小と最大の中点から求める
- 座標の原点はガーバーと同じ点にする。y は JLCPCB では上向き (KiCad の内部座標は下向きなので符号を反転する)
- Layer は `Top` か `Bottom`

## 回転: KiCad と JLCPCB で 0 度が違う部品がある

ある基板の確認画面で見つかった補正 (KiCad 標準のフットプリント):

| フットプリント | KiCad の回転に足す角度 | 見えたこと |
|---|---|---|
| `SOIC-16_3.9x9.9mm_P1.27mm` | -90 | KiCad の 90 度が、JLCPCB では立った向き (1 番ピンが右下) に出た。0 度ならパッドと同じ向きに寝て、1 番ピンが左下 |
| `PinSocket_1x07_P2.54mm_Vertical` | +90 | KiCad の 0 度と 180 度 (立った向き) が、横に寝て出た。極性が無いので +90 で合わせた |

2 枚の基板 (SOIC-16 の向きが 180 度違う 2 つの配置) で、この補正のまま確認画面の印が合った。ピンソケットは、LCSC の部品が変わっても (XFCN の 8.5 mm と Hong Cheng の 5.0 mm) 同じ補正で合った。別の部品では、確認画面で必ず見直す。向きのある部品は、IC の 1 番ピンの印が基板の印と合っているかを目で見る。

## 書き出しの例 (KiCad 10 の kicad-cli)

```bash
kicad-cli pcb export gerbers --layers "F.Cu,B.Cu,F.Paste,B.Paste,F.SilkS,B.SilkS,F.Mask,B.Mask,Edge.Cuts" \
  --subtract-soldermask --use-drill-file-origin -o gerbers/ board.kicad_pcb
kicad-cli pcb export drill --format excellon --excellon-separate-th --drill-origin plot -o gerbers/ board.kicad_pcb
```

BOM と CPL は、pcbnew の Python API で、LCSC の番号を持つフットプリントだけを書き出すと、手で直す箇所が減る。フットプリントにフィールド `LCSC` を持たせておく。
