"""Reusable camera and image effects for geographic video shot specifications."""
from copy import deepcopy


def camera_views(camera, effect, *, river_dx=0.0014, zoom_step=0.45):
    """Return start/end cameras without changing the caller's camera."""
    start, end = deepcopy(camera), deepcopy(camera)
    if effect == 'hold':
        start['pitch'] = end['pitch'] = 28
    elif effect == 'track_river':
        start['pitch'] = end['pitch'] = 28
        lon, lat = camera['center']
        start['center'], end['center'] = [lon - river_dx, lat], [lon + river_dx, lat]
        end['bearing'] = start['bearing']
    elif effect == 'reveal_context':
        start['pitch'], end['pitch'] = 45, 25
        end['zoom'] = max(10.8, start['zoom'] - 0.6)
    elif effect == 'approach':
        start['pitch'], end['pitch'] = 32, 45
        end['zoom'] = start['zoom'] + zoom_step
    elif effect == 'quiet':
        start['pitch'] = end['pitch'] = 25
        end['bearing'] = start['bearing']
    else:
        raise ValueError(f'unknown camera effect: {effect}')
    return start, end


def photo_motion(index):
    """Return a deterministic pan or zoom direction for a still photograph."""
    return ('in', 'out', 'up', 'down')[index % 4]


def landmark(name, coordinate):
    """Create a map-anchored landmark label."""
    return {'type': 'label', 'at': list(coordinate), 'text': name, 'style': 'tag', 'show': [0, 1]}


def geographic_transition(start, end, *, start_zoom=8.1, wide_zoom=6.1,
                          end_zoom=13.5, pitch=10, hold=(0.26, 0.64), midpoint=None):
    """Pull back, hold a regional view, and approach a destination.

    Coordinates and key times are independent of narration duration; the
    renderer interpolates them across the shot using Mercator latitude.
    """
    midpoint = midpoint or [(a + b) / 2 for a, b in zip(start, end)]
    def key(t, center, zoom, angle):
        return {'t': t, 'center': list(center), 'zoom': zoom,
                'pitch': angle, 'bearing': 0}
    return [key(0, start, start_zoom, 15), key(hold[0], midpoint, wide_zoom, pitch),
            key(hold[1], midpoint, wide_zoom, pitch), key(1, end, end_zoom, 25)]
