---
name: local-weather-monitor
description: Launch or reuse three installed Chromium PWA shortcuts (yahoo-tenki, tenki-jp, tokyo-amesh) and arrange them in a fixed local weather dashboard layout. Use when the user asks to open, restore, or re-tile the local weather monitoring PWAs.
---

# Local Weather Monitor

## Overview

This skill restores a fixed three-panel local weather dashboard using installed Chromium app shortcuts. It reuses existing app windows when present, launches missing ones via their `.desktop` shortcuts, then places them in a stable layout.

## When To Use

Use this skill when the user asks to:

- open the local weather monitor
- restore the local weather dashboards
- tile `yahoo-tenki`, `tenki-jp`, and `tokyo-amesh`
- fix the layout of those installed Chromium weather apps

## Workflow

Run the bundled script:

```bash
bash .codex/skills/local-weather-monitor/scripts/arrange_local_weather_monitor.sh
```

What the script does:

- Detects the active X11 screen size from `DISPLAY=:0` by default
- Finds existing windows by `WM_CLASS` (`crx_<app-id>.Chromium`)
- Launches missing apps from the installed `.desktop` shortcuts in `~/.local/share/applications`
- Places the windows into the fixed slots below

## Fixed Layout

- Left top: `yahoo-tenki`
- Left bottom: `tokyo-amesh`
- Right top: `tenki-jp`

The right bottom quadrant is left unchanged.

The script uses these installed shortcuts:

- [chrome-dfdpcjchnodkmgodjjpnmipjiemeejel-Default.desktop](/home/yuiseki/.local/share/applications/chrome-dfdpcjchnodkmgodjjpnmipjiemeejel-Default.desktop)
- [chrome-lilfkepjfccihfhknkglhgbjcjejppjo-Default.desktop](/home/yuiseki/.local/share/applications/chrome-lilfkepjfccihfhknkglhgbjcjejppjo-Default.desktop)
- [chrome-blmpnkacpmoiiccofdmbahogbbdeblgp-Default.desktop](/home/yuiseki/.local/share/applications/chrome-blmpnkacpmoiiccofdmbahogbbdeblgp-Default.desktop)

## Validation

After running, verify with:

```bash
DISPLAY=:0 wmctrl -lx
DISPLAY=:0 wmctrl -lpG
```

Use `--dry-run` if you only want to inspect what would happen:

```bash
bash .codex/skills/local-weather-monitor/scripts/arrange_local_weather_monitor.sh --dry-run
```

Final visibility and overlap still need manual confirmation.
