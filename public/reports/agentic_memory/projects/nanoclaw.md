# NanoClaw

## Quick facts
- Memory model is hierarchical `CLAUDE.md` files with container isolation per group.
- Uses Claude runtime memory features via env flags rather than custom vector index.

## Storage model
- Global memory: `groups/global/CLAUDE.md` (readable by all groups, writable from main flow).
- Group memory: `groups/{group}/CLAUDE.md`.
- Session continuity: per-group `.claude` directories + session IDs in sqlite.

## Write path
- Agent writes markdown memory files inside mounted group filesystem.
- Main context can update global memory; non-main groups are isolated and usually get global as read-only mount.

## Read path
- Container runner sets cwd to group directory; Claude SDK with additional CLAUDE.md directory loading enabled.
- Claude reads local and parent `CLAUDE.md` automatically as runtime memory context.

## Retrieval algorithm
- Delegated to Claude Code runtime memory system (opaque to this repo).
- This repo itself does not implement custom semantic retrieval/ranking pipeline for markdown memory.

## Notable ideas
- Security-driven memory isolation: each group in separate container with separate `.claude` session dir and IPC namespace.
- Hierarchical memory (global + group) gives controlled sharing.

## 留意点
- Core recall behavior depends on external Claude runtime internals (version-dependent, less transparent).
- Cross-group/global write policy must be carefully enforced to prevent accidental contamination.
