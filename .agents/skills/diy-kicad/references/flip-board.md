# 基板の反転

描いた基板を、裏返しで使いたくなることがある (たとえば、モジュールを下に吊る設計にしたが、USB に手が届かず、上から挿したい)。生成の最後に、基板全体を軸のまわりに反転すれば、配線や穴は鏡像のまま有効で、検査も通る。

```python
def flip_board(board, axis_x_mm):
    axis = pcbnew.VECTOR2I(pcbnew.FromMM(axis_x_mm), 0)
    for fp in board.GetFootprints():
        fp.Flip(axis, pcbnew.FLIP_DIRECTION_LEFT_RIGHT)
    for t in board.GetTracks():          # ビアも含む
        t.Flip(axis, pcbnew.FLIP_DIRECTION_LEFT_RIGHT)
    for d in board.GetDrawings():        # 外形、文字
        d.Flip(axis, pcbnew.FLIP_DIRECTION_LEFT_RIGHT)
    for z in board.Zones():
        z.Flip(axis, pcbnew.FLIP_DIRECTION_LEFT_RIGHT)
    board.BuildConnectivity()            # これが無いと、未配線とビアの孤立が出る
    pcbnew.ZONE_FILLER(board).Fill(board.Zones())
```

## 軸の選び方

軸は、外形を自分自身に重ね、動かせない穴 (筐体の決まった位置に来るコネクタ) を動かさない線にする。正多角形の基板なら、頂点と中心を通る線が候補。

## 反転は面を入れ替える

反転すると、上の面の部品は下に、下の面の部品は上に移る。実装を片面に限る発注 (JLCPCB の経済的な PCBA など) では、これで両面になってしまう。

- 反転したあとで、IC だけを元の面に戻すことはできない。SOIC などは裏返すとピンの順が鏡像になり、回転では戻らない
- 最後に同じ面にそろえたい部品は、反転する前の段階で、反対の面に描く。反転のあとで、全部が同じ面に来る
- そのとき、IC の配線は描き直しになる。ピンの並びが逆になるので、どの信号をどのピンにつなぐかを、線が交差しない順に選び直す (マイコンのピンの割り当てや、デコーダの出力の割り当て)。ファームの対応表も分け、基板の生成スクリプトの表と一致するかをテストで確かめる
- 裏に描いた IC のまわりの長い線は、もう一方の層に残し、パッドの脇のビアから短い線でつなぐと、その層の自動配線を邪魔しない

## 反転のあとの塗りつぶし

反転の前は消えていた銅の切れ端が、反転のあとで残り、`starved_thermal` が出ることがある (塗りつぶしの順番が層によって違うため、と見ている)。手はんだの穴を塗りつぶしにつながない設定 (`ZONE_CONNECTION_NONE`) で消えた。
