
codex:
	codex --dangerously-bypass-approvals-and-sandbox

gemini:
	gemini --approval-mode yolo

claude:
	claude --dangerously-skip-permissions

heartbeat-codex:
	codex exec "heartbeat" --dangerously-bypass-approvals-and-sandbox

heartbeat-gemini:
	gemini --approval-mode yolo -p "heartbeat"

heartbeat-claude:
	claude --dangerously-skip-permissions -p "heartbeat"