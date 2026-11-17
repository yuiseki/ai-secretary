"""Extract camera position and construct a map-linked photographic overlay."""
from pathlib import Path
from PIL import Image


def exif_coordinates(path):
    with Image.open(Path(path)) as image:
        gps = image.getexif().get_ifd(34853)
    if not gps or not all(k in gps for k in (1, 2, 3, 4)):
        raise ValueError(f'No EXIF GPS position in {path}')

    def degrees(value, ref):
        x = float(value[0]) + float(value[1]) / 60 + float(value[2]) / 3600
        return -x if ref in ('S', 'W') else x

    lat, lon = degrees(gps[2], gps[1]), degrees(gps[4], gps[3])
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError(f'Invalid EXIF GPS position in {path}')
    return [lon, lat]


def linked_photo(src, caption, position, *, credit, subject=None, bridge=None):
    overlay = {'type': 'photo_marker', 'src': src, 'caption': caption, 'credit': credit,
               'screen': [70, 80], 'width': 760, 'height': 650,
               'at': list(position), 'targetLabel': '', 'show': [0, 1]}
    if subject:
        overlay.update(cameraAt=list(subject['at']), cameraLabel=subject['name'],
                       cameraLabelAnchor='start', cameraLabelOffset=[20, 45])
    if bridge:
        overlay.update(bridgeAt=list(bridge['at']), bridgeLabel=bridge['name'])
    return overlay
