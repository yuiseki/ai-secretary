"""Render independent narrated chapters from a JSON manifest and join them.

Run from the project directory inside a single resource-limited scope.  Each
chapter specification must include narration and produce stereo AAC.  The
manifest and all its paths are project-relative, except --out and --voice-cache. Cached files are copied into each job.
"""
from __future__ import annotations
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import subprocess
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'

def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)

def duration(path):
    p = run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of',
             'default=noprint_wrappers=1:nokey=1', str(path)], capture_output=True, text=True)
    return float(p.stdout.strip())

def card(title, number, image, video, series, fps, seconds):
    img = Image.new('RGB', (1920, 1080), '#101c2e')
    draw = ImageDraw.Draw(img)
    small, large = ImageFont.truetype(FONT, 36), ImageFont.truetype(FONT, 72)
    if series:
        draw.text((960, 350), series, font=small, anchor='mm', fill='#e7b462')
    draw.text((960, 455), f'第 {number} 章', font=small, anchor='mm', fill='#d5e0ed')
    draw.text((960, 560), title, font=large, anchor='mm', fill='white')
    draw.line((600, 650, 1320, 650), fill='#e7b462', width=4)
    img.save(image)
    run(['ffmpeg', '-nostdin', '-v', 'error', '-n', '-loop', '1', '-framerate', str(fps),
         '-i', str(image), '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
         '-t', str(seconds), '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
         '-crf', '18', '-maxrate', '20M', '-bufsize', '40M', '-profile:v', 'high', '-level:v', '4.1',
         '-g', str(fps * 2), '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', str(video)])

def render(item):
    i, spec, dest, cache, check_overlap = item
    dest.mkdir()
    if cache:
        # Give each job its own copy so concurrent synthesis cannot race on a cache file.
        import shutil
        shutil.copytree(cache, dest / 'voice-cache')
    log = dest.parent / f'{dest.name}.log'
    with log.open('x') as stream:
        cmd = ['node', 'render.mjs', str(spec), '--out', str(dest), '--size',
               '1920x1080', '--fps', str(FPS), '--raw-audio']
        if check_overlap:
            cmd.append('--check-label-overlap')
        proc = subprocess.run(cmd, cwd=ROOT,
                              stdout=stream, stderr=subprocess.STDOUT)
    lines = log.read_text(errors='replace').replace('\r', '\n').splitlines()
    bad = [line for line in lines if line.startswith(('[http ', '[page]', 'warning:', 'Error:'))]
    if proc.returncode or bad:
        raise RuntimeError(f'chapter {i} failed or logged a rendering error: {log}')
    video = dest / f'{dest.name}.mp4'
    # concat and normalization require both streams on every chapter.
    info = json.loads(run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type',
                           '-of', 'json', str(video)], capture_output=True, text=True).stdout)
    if not {'video', 'audio'} <= {s['codec_type'] for s in info['streams']}:
        raise ValueError(f'chapter {i} must have both video and audio: {video}')
    print(f'chapter {i} complete', flush=True)
    return video

FPS = 24

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('manifest', type=Path)
    p.add_argument('--out', type=Path, required=True)
    p.add_argument('--workers', type=int, default=3)
    p.add_argument('--voice-cache', type=Path)
    p.add_argument('--check-label-overlap', action='store_true')
    args = p.parse_args()
    if not 1 <= args.workers <= 4:
        p.error('workers must be between 1 and 4')
    manifest = json.loads(args.manifest.read_text())
    chapters = manifest['chapters']
    if not chapters:
        p.error('manifest must contain chapters')
    names = [c['id'] for c in chapters]
    if len(names) != len(set(names)) or any(not n.replace('-', '').replace('_', '').isalnum() for n in names):
        p.error('chapter ids must be unique alphanumeric, hyphen or underscore')
    cache = args.voice_cache.resolve() if args.voice_cache else None
    if cache and not cache.is_dir():
        p.error('voice cache must be an existing directory')
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=False)
    jobs = out / 'jobs'
    jobs.mkdir()
    card_seconds = float(manifest.get('cardSeconds', 2.5))
    cards, items = {}, []
    for i, ch in enumerate(chapters):
        spec = (ROOT / ch['spec']).resolve()
        if not spec.is_file():
            raise FileNotFoundError(spec)
        chapter_spec = json.loads(spec.read_text())
        if chapter_spec.get('bgm'):
            raise ValueError(f'chapter {i}: chapter_pipeline does not mix BGM; mix it after joining')
        if not any(shot.get('lines') for shot in chapter_spec.get('shots', [])):
            raise ValueError(f'chapter {i}: narrated shots are required')
        items.append((i, spec, jobs / ch['id'], cache, args.check_label_overlap))
        if i:
            image, video = jobs / f'card-{i:02}.png', jobs / f'card-{i:02}.mp4'
            card(ch['title'], i, image, video, manifest.get('series', ''), FPS, card_seconds)
            cards[i] = video
    print(f'rendering {len(items)} chapters with {args.workers} workers', flush=True)
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        videos = list(pool.map(render, items))
    cursor, timeline, ordered = 0., [], []
    for i, (ch, video) in enumerate(zip(chapters, videos)):
        timeline.append({'title': ch['title'], 'start': cursor})
        if i:
            ordered.append(cards[i]); cursor += duration(cards[i])
        ordered.append(video); cursor += duration(video)
    concat = out / 'concat.txt'
    concat.write_text(''.join("file '" + str(f).replace("'", "'\\''") + "'\n" for f in ordered))
    print('measuring complete audio', flush=True)
    measure = run(['ffmpeg', '-hide_banner', '-nostats', '-f', 'concat', '-safe', '0', '-i', str(concat),
                   '-vn', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'],
                  capture_output=True, text=True)
    raw = measure.stderr
    values = json.loads(raw[raw.rfind('{'):raw.rfind('}') + 1])
    filt = ('loudnorm=I=-14:TP=-1.5:LRA=11:'
            f"measured_I={values['input_i']}:measured_TP={values['input_tp']}:"
            f"measured_LRA={values['input_lra']}:measured_thresh={values['input_thresh']}:"
            f"offset={values['target_offset']}:linear=true")
    result = out / 'episode.mp4'
    print('joining chapters', flush=True)
    run(['ffmpeg', '-nostdin', '-v', 'error', '-n', '-f', 'concat', '-safe', '0', '-i', str(concat),
         '-map', '0:v:0', '-map', '0:a:0', '-c:v', 'copy', '-af', filt, '-c:a', 'aac', '-b:a', '192k',
         '-ar', '48000', '-ac', '2', '-movflags', '+faststart', str(result)])
    (out / 'chapters.json').write_text(json.dumps(timeline, ensure_ascii=False, indent=2))
    print(f'complete {result} {duration(result):.2f}s', flush=True)

if __name__ == '__main__':
    main()
