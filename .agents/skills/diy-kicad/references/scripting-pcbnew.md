# pcbnew のスクリプトで基板を生成する

## 座標を 1 か所で決める

基板の中心を原点にした座標 (y 上向き) で設計し、シートの座標 (KiCad は y 下向き) への変換を 1 つの関数にまとめる。寸法の定数 (外形、穴の列の位置、間隔) は、ファイルの先頭に集め、前の版の値と、その値にした理由をコメントに残す。

```python
import pcbnew
def mm(v): return pcbnew.FromMM(v)
ORIGIN = (100.0, 100.0)                       # 基板の中心のシート上の位置
def pt(p): return pcbnew.VECTOR2I(mm(ORIGIN[0] + p[0]), mm(ORIGIN[1] - p[1]))
def cup(v): return (pcbnew.ToMM(v.x) - ORIGIN[0], ORIGIN[1] - pcbnew.ToMM(v.y))
```

## パッドの位置は、置いたフットプリントから読む

配線の端点に使うパッドの座標を、式で書かない。フットプリントを一時的な基板に、本番と同じ手順 (位置、面、回転) で置き、そのパッドの座標を読む。置く手順は 1 つの関数にして、本番の配置と共有する。

```python
def place_part(fp, place, on_back):
    fp.SetPosition(pt(place[:2]))
    if on_back:
        fp.Flip(fp.GetPosition(), pcbnew.FLIP_DIRECTION_LEFT_RIGHT)
    fp.SetOrientationDegrees(place[2] % 360)

def placed_pads(fp_path, name, place, on_back):
    board = pcbnew.BOARD()
    fp = pcbnew.FootprintLoad(fp_path, name)
    board.Add(fp)
    place_part(fp, place, on_back)
    return {int(p.GetNumber()): cup(p.GetPosition()) for p in fp.Pads()}
```

特に、部品を裏の面に置くと、ピンの並びが鏡像になる。SOIC を裏返すと、1 番ピンが列の反対の端に来る。式で書いた座標は、ここで黙って間違う。

パッドの銅の形 (自動配線の障害物などに使う):

```python
poly = pad.GetEffectivePolygon(pcbnew.B_Cu, pcbnew.ERROR_INSIDE).Outline(0)
corners = [cup(poly.CPoint(i)) for i in range(poly.PointCount())]
```

## 自動配線を自分で書くとき

- 障害物は、パッド、ビア、短い配線を、必要な間隔 (線幅の半分 + クリアランス) だけ太らせた多角形として渡す。円で近似すると、間隔が 0.147 mm (規則は 0.15 mm) のような、わずかな違反が出る。直線の辺で回り込むので、0.02 mm ほど余分に太らせる
- 後から配線する線の端点 (パッドからビアまでの短い線など) も、最初から障害物に入れる。配線する順番によっては、まだ決まっていない線をまたいで、交差やショートになる

## よく使う API (KiCad 10)

| したいこと | 書き方 |
|---|---|
| パッドを塗りつぶしにつながない | `pad.SetLocalZoneConnection(pcbnew.ZONE_CONNECTION_NONE)` |
| 塗りつぶしの前に接続を作り直す | `board.BuildConnectivity()` |
| 塗りつぶす | `pcbnew.ZONE_FILLER(board).Fill(board.Zones())` |
| 部品を裏返す | `fp.Flip(fp.GetPosition(), pcbnew.FLIP_DIRECTION_LEFT_RIGHT)` |
| 角度 | `pcbnew.EDA_ANGLE(45, pcbnew.DEGREES_T)` |
