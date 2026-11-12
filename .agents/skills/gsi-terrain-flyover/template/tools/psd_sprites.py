"""Cut reaction-wipe sprites out of a PSDTool-style character PSD.

PSDTool conventions: a layer or group whose name starts with "*" is one choice among its "*"
siblings (only one is shown); "!" means always shown. A selection maps a group path to the
child to show, e.g. {"目": "にっこり", "目/目セット/黒目": "カメラ目線"}. The key "/" picks among
the top-level "*" groups (e.g. the outfit). Names are matched without the "*" / "!" prefix.

usage (psd-tools is not a template dependency; run it with uv):
  uv run --with psd-tools python tools/psd_sprites.py <character.json> <file.psd> <outdir>

writes <outdir>/<face>_<eyes o|c>_<mouth o|c>.png for every face in the config, plus sheet.png.
"""
import json, os, sys
from psd_tools import PSDImage
from PIL import Image


def bare(name):
    return name.lstrip('*!').strip()


def find(group, path):
    """Walk a '/'-separated path of bare names from group; '' or '/' is the group itself."""
    node = group
    for part in [p for p in path.split('/') if p]:
        hits = [c for c in node if c.is_group() and bare(c.name) == part]
        if not hits:
            raise KeyError(f'no group "{part}" in path "{path}"')
        node = hits[0]
    return node


def choose(group, child):
    """Show the '*' child named child and hide its '*' siblings. The group's own visibility is left to
    its parent's choice, so choosing pupils inside the eye set does not bring back a hidden eye set."""
    names = [bare(c.name) for c in group if c.name.startswith('*')]
    if child not in names:
        raise KeyError(f'"{child}" is not a choice in "{group.name}" (choices: {", ".join(names)})')
    for c in group:
        if c.name.startswith('*'):
            c.visible = bare(c.name) == child


def toggle(psd, path, on):
    parent, _, leaf = path.rpartition('/')
    g = find(psd, parent)
    hits = [c for c in g if bare(c.name) == leaf]
    if not hits:
        raise KeyError(f'no layer "{leaf}" in "{parent or "/"}"')
    for h in hits:
        h.visible = on


def apply(psd, sel, on=(), off=()):
    for path, child in sel.items():
        choose(find(psd, '' if path == '/' else path), child)
    for p in on:
        toggle(psd, p, True)
    for p in off:
        toggle(psd, p, False)


def render(psd_path, cfg, outdir):
    os.makedirs(outdir, exist_ok=True)
    x0, y0, x1, y1 = cfg['crop']
    width = cfg.get('width', 360)
    made = []
    for face, f in cfg['faces'].items():
        for eyes in ('o', 'c'):
            for mouth in ('o', 'c'):
                psd = PSDImage.open(psd_path)  # fresh copy: visibility edits accumulate otherwise
                # later choices win: base, then the face, then the mouth, then closed eyes
                apply(psd, cfg.get('base', {}), cfg.get('on', []), cfg.get('off', []))
                apply(psd, f.get('select', {}), f.get('on', []), f.get('off', []))
                apply(psd, {'口': f['mouth_open'] if mouth == 'o' else f['mouth_closed']})
                if eyes == 'c':
                    apply(psd, f.get('blink', cfg['blink']))
                im = psd.composite(force=True).crop((x0, y0, x1, y1))
                im = im.resize((width, round(width * (y1 - y0) / (x1 - x0))), Image.LANCZOS)
                name = f'{face}_{eyes}_{mouth}.png'
                im.save(os.path.join(outdir, name))
                made.append((name, im))
    cols = 4
    w, h = made[0][1].size
    sheet = Image.new('RGBA', (w * cols, h * ((len(made) + cols - 1) // cols)), (60, 60, 70, 255))
    for i, (_, im) in enumerate(made):
        sheet.alpha_composite(im, ((i % cols) * w, (i // cols) * h))
    sheet.save(os.path.join(outdir, 'sheet.png'))
    return [n for n, _ in made]


if __name__ == '__main__':
    cfg = json.load(open(sys.argv[1], encoding='utf-8'))
    for n in render(sys.argv[2], cfg, sys.argv[3]):
        print(n)
