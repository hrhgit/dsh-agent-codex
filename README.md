# @ruihuahe/dsh-agent-codex

[中文](README.zh-CN.md) | English

`@ruihuahe/dsh-agent-codex` supplies the version-locked static Codex coding-tool contract used by the DeepSeek Harness **Codex mode** preset. Installing this package alone changes no global runtime state: the preset mounts individual exports in one agent scope, so Agent Manager can inspect and toggle each declared row after a user copies the system preset.

## Source and license attribution

The catalog is derived from OpenAI Codex revision `136f75e7b7fca7d327fe0f23368ed5482804ea5f`, under Apache-2.0. Exact source paths and the DSH compilation boundary are in [SOURCES.md](SOURCES.md); the required attribution is in [NOTICE](NOTICE). This package's own code is MIT-licensed.

## Contract

The static catalog includes `exec_command`, `write_stdin`, `apply_patch`, `view_image`, `update_plan`, `request_user_input`, `request_permissions`, the four subagent controls, and the three MCP resource operations. Each name has an independent export and preset `agentTool` row.

The model sees only tools that the running DSH host truly registers:

- `view_image` needs attachments and an image-capable model route.
- human questions, approval, subagents, and MCP resources appear only when the corresponding public service is mounted.
- MCP resource tools require a host `mcpResources` service; ordinary MCP callable tools alone do not fabricate resource support.

`apply_patch` keeps the Codex patch grammar and add/update/delete effects, but DSH transports it as JSON `{ "patch": "..." }`, not a freeform call. It is registered only on a host that exposes the versioned public single-file deletion seam, so every directive remains inside the same observed-state and sandbox policy as ordinary filesystem tools.

`write_stdin` follows the public `ShellProcess` contract. It can poll output with empty input and sends Ctrl-C as a process-tree kill; the current host seam does not expose arbitrary interactive stdin writes, which therefore fail explicitly.

## Configuration

The `spawn-agent` export accepts a host-owned `provider` configuration, defaulting to `spawn`:

```yaml
- id: spawn-agent
  name: '@ruihuahe/dsh-agent-codex/spawn-agent'
  config:
    provider: spawn
```

LLM provider and model selection remain owned by DeepSeek Harness Model Center; this package does not configure either.

## Development

```sh
pnpm run typecheck
pnpm test
pnpm run build
pnpm run pack:check
```
