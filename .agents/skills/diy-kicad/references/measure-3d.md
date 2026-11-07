# 3D モデルで測る (STEP と STL)

筐体に収まるか、どこが何 mm 足りないかは、写真や定規より、部品と筐体の 3D モデルで測るほうが確か。

## STEP: 部品の高さ

STEP の `CARTESIAN_POINT` を正規表現で拾って最小と最大を取る方法は、使えない。組み立て (assembly) の部品ごとの配置の変換が反映されず、値が実物と合わない。OpenCASCADE (OCP) で読み、部品の変換を適用した形の外接箱を取る。

```python
from OCP.STEPControl import STEPControl_Reader
from OCP.Bnd import Bnd_Box
from OCP.BRepBndLib import BRepBndLib
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_SOLID

r = STEPControl_Reader(); r.ReadFile("part.step"); r.TransferRoots()
shape = r.OneShape()
b = Bnd_Box(); BRepBndLib.AddOptimal_s(shape, b, False, False)
lo, hi = b.CornerMin(), b.CornerMax()       # b.Get() は OCP では Python の値に変換できない
print(hi.X() - lo.X(), hi.Y() - lo.Y(), hi.Z() - lo.Z())

# 部品 (solid) ごとの外接箱: 一番背の高い部品を探す
ex = TopExp_Explorer(shape, TopAbs_SOLID)
while ex.More():
    bb = Bnd_Box(); BRepBndLib.AddOptimal_s(ex.Current(), bb, False, False)
    print(bb.CornerMin().Y(), bb.CornerMax().Y())
    ex.Next()
```

- どの軸が厚みかは、モデルによって違う。外接箱の 3 辺の長さを、データシートの寸法 (幅、長さ) と照らして決める
- 拡張基板つきのモデルと、本体だけのモデルが両方あるなら、両方を測って差を取る。たとえば、XIAO ESP32-S3 の本体は約 4.2 mm、Sense の拡張基板つきは約 8.5 mm、カメラまでつけると約 13.7 mm だった (基板の面から)

## STL: 筐体の壁

筐体の STL を高さごとに輪切りにして、内側の壁までの距離を測る。trimesh が無くても、三角形の辺と平面の交点を取れば足りる。

```python
import numpy as np, struct
d = open("case.stl", "rb").read()
n = struct.unpack("<I", d[80:84])[0]
tri = np.frombuffer(d[84:84 + n * 50], dtype=np.dtype([("n", "<3f4"), ("v", "<9f4"), ("a", "<u2")]))["v"].reshape(-1, 3, 3)
z0 = tri[:, :, 2].min()
for z in np.arange(z0 + 1, tri[:, :, 2].max(), 2.5):
    r = []
    for t in tri:
        for i in range(3):
            p, q = t[i], t[(i + 1) % 3]
            if (p[2] - z) * (q[2] - z) < 0:
                x = p + (z - p[2]) / (q[2] - p[2]) * (q - p)
                r.append(np.hypot(x[0], x[1]))
    if r:
        print(f"{z - z0:5.1f} mm: inner {min(r):.1f}, outer {max(r):.1f}")
```

(ASCII の STL なら `vertex` の行を正規表現で読む)

内側の最小距離が高さとともにどう変わるかで、壁の傾きが分かる。基板を何 mm 縮めれば何 mm 沈むかの見積もりになる。

## 写真と定規では足りないとき

写真の上の定規は、何から何までを測っているかが曖昧になる。数 mm の差を見たいときは、上のどちらかで測り、必要な高さ (部品の背の差) と、稼げる高さ (沈める量、ソケットを低くする量) を同じ単位で並べる。
