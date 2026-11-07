---
name: diy-kicad
description: KiCad 10 の基板を、Python (pcbnew) のスクリプトで生成し、kicad-cli で ERC と DRC を通し、絵にして目で確かめるための手順と落とし穴。基板を小さくする・反転する・部品の面を変える・手はんだの穴を設計するとき、DRC の指摘 (starved_thermal、silk_edge_clearance など) を直すとき、部品や筐体の 3D モデル (STEP、STL) から高さや隙間を測るときに使う。JLCPCB への発注ファイルと部品選びは diy-jlcpcb を使う。
---

# KiCad で作る

基板は、手で描くより、Python のスクリプト (`make.py` のようなもの) で生成する。寸法や間隔を定数 1 つで変えて、何度でも作り直せる。直したら毎回、ERC と DRC と回路図との一致を通し、絵に出して目で見る。

道具の入れ方は [install-deps.md](references/install-deps.md)。

## 進め方

1. 生成のスクリプトは pcbnew の Python API で書く ([スクリプトで生成する](references/scripting-pcbnew.md))
2. 変えたら必ず検査を通す。ERC、DRC (回路図との一致つき)。指摘 0 件を完了の条件にする ([検査と絵](references/checks-and-render.md))
3. 絵 (SVG から PNG) に出して、表と裏を目で見る。DRC は文字の読みやすさや、ケーブルの差しやすさを見ない
4. 大きさや間隔を詰めるときは、作業ツリーの外のコピーで、定数を 1 つずつ変えて試す。どこで何の指摘が出始めるかで、何が大きさを決めているかが分かる ([小さくする](references/shrink-a-board.md))
5. 面を変えるときは、反転の仕組みと、実装する面の制約を先に考える ([基板の反転](references/flip-board.md))
6. 手はんだの穴は、作る人の手で決める ([手はんだの穴](references/hand-solder-holes.md))
7. 筐体に収まるかは、部品と筐体の 3D モデルで測る ([3D モデルで測る](references/measure-3d.md))

## 完了の条件

- `kicad-cli sch erc` と `kicad-cli pcb drc --schematic-parity` が、どちらも違反 0 件 (警告も 0 件を目指す)
- 未配線 0 件
- 表と裏の絵を見た
- 実装を頼む部品が全部同じ面 (diy-jlcpcb)
- 変えた理由を、スクリプトのコメントか README に残した (前の版の値も)
