---
name: world-situation-monitor
description: Launch or reuse four installed Chromium PWA shortcuts (monitor-the-situation, marinetraffic-com, glint-trade, flightradar24-com) and arrange them in a fixed 2x2 desktop layout. Use when the user asks to open, restore, or re-tile the world situation monitoring dashboards.
---

# World Situation Monitor

## Overview

This skill restores a fixed four-panel monitoring wall using installed Chromium app shortcuts. This layout is the "世界情勢モード". It reuses existing app windows when present, launches missing ones via their `.desktop` shortcuts, then places them in a stable 2x2 layout.

## When To Use

Use this skill when the user asks to:

- open the world situation monitor
- switch to 世界情勢モード
- restore the four monitoring dashboards
- tile `monitor the situation`, `marinetraffic`, `glint trade`, and `flightradar24`
- fix the layout of those four installed Chromium apps

## Workflow

Run the bundled script:

```bash
bash .codex/skills/world-situation-monitor/scripts/arrange_world_situation_monitor.sh
```

What the script does:

- Detects the active X11 screen size from `DISPLAY=:0` by default
- Finds existing windows by `WM_CLASS` (`crx_<app-id>.Chromium`)
- Launches missing apps from the installed `.desktop` shortcuts in `~/.local/share/applications`
- Places the windows into the fixed slots below

## Fixed Layout

- Left top: `monitor-the-situation`
- Left bottom: `marinetraffic-com`
- Right top: `glint-trade`
- Right bottom: `flightradar24-com`

The script uses these installed shortcuts:

- [chrome-fpjghcebmepbfdchhgkapbjfaibonnee-Default.desktop](/home/yuiseki/.local/share/applications/chrome-fpjghcebmepbfdchhgkapbjfaibonnee-Default.desktop)
- [chrome-eiggboehmioopkkmepiijdhicjfokacg-Default.desktop](/home/yuiseki/.local/share/applications/chrome-eiggboehmioopkkmepiijdhicjfokacg-Default.desktop)
- [chrome-lidakfpkjaoncppkjikdmmephmoangjc-Default.desktop](/home/yuiseki/.local/share/applications/chrome-lidakfpkjaoncppkjikdmmephmoangjc-Default.desktop)
- [chrome-bdchbohmgmandnkikanoblpemggpldff-Default.desktop](/home/yuiseki/.local/share/applications/chrome-bdchbohmgmandnkikanoblpemggpldff-Default.desktop)

## Validation

After running, verify with:

```bash
DISPLAY=:0 wmctrl -lx
DISPLAY=:0 wmctrl -lpG
```

Use `--dry-run` if you only want to inspect what would happen:

```bash
bash .codex/skills/world-situation-monitor/scripts/arrange_world_situation_monitor.sh --dry-run
```

Final visibility and overlap still need manual confirmation.
