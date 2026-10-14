#!/bin/sh
# SessionStart hook: hand the amem identity and owner profile to agy.
# Called by absolute path because the asdf shim for amem only resolves
# under a directory that has a .tool-versions.
set -eu
cat >/dev/null
amem="$HOME/.cargo/bin/amem"
text=$( { "$amem" agent; "$amem" owner; } 2>/dev/null ) || text=""
python3 -c '
import json, sys
text = sys.argv[1]
steps = [{"systemMessage": {"systemMessage": text}}] if text else []
print(json.dumps({"injectSteps": steps}))
' "$text"
