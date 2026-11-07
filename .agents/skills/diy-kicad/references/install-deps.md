# 道具の入れ方 (Ubuntu 24.04、KiCad 10)

## KiCad 10

KiCad の公式 PPA から入れる。`kicad-cli` と、Python の `pcbnew` モジュールが一緒に入る。

```bash
sudo add-apt-repository ppa:kicad/kicad-10.0-releases
sudo apt install kicad
kicad-cli version
```

## pcbnew を Python から使う

`pcbnew` はシステムの Python 用に、`/usr/lib/python3/dist-packages` に入る。conda や venv の Python からは import できないので、システムの Python (`/usr/bin/python3`) で動かす。ほかのパッケージ (shapely など) は venv に入れ、`PYTHONPATH` で足す。

```bash
python3 -m venv .venv && .venv/bin/pip install shapely numpy
PYTHONPATH=/usr/lib/python3/dist-packages:$(ls -d .venv/lib/python3*/site-packages) /usr/bin/python3 make.py
```

import のときに `assert "m_choices.GetCount() > 0" failed in PROPERTY_ENUM()` が何行か出ることがある。動作には関係ない (KiCad 10 で観測)。出力を読むときは grep で除く。

## 絵にする

```bash
sudo apt install librsvg2-bin   # rsvg-convert
```

## 3D モデル (STEP) を測る

STEP の読み込みには OpenCASCADE の Python バインディング (OCP) を使う。システムを汚さないよう、使い捨ての venv に入れる。

```bash
uv venv ocpenv && uv pip install --python ocpenv/bin/python cadquery-ocp numpy
ocpenv/bin/python -c "import OCP; print('ok')"
```

配布元からダウンロードした zip (部品メーカーの 3D モデルなど) は、それぞれ空のディレクトリに展開し、スクリプトは別の場所に置く。
