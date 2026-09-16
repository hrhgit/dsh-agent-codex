# Source lock

## OpenAI Codex CLI

- Repository: `E:/_workSpace/_Agents/_agent/codex`
- Commit: `136f75e7b7fca7d327fe0f23368ed5482804ea5f`
- License: Apache-2.0
- Contract sources:
  - `codex-rs/core/src/tools/spec_plan.rs`
  - `codex-rs/core/src/tools/handlers/shell_spec.rs`
  - `codex-rs/core/src/tools/handlers/apply_patch_spec.rs`
  - `codex-rs/core/src/tools/handlers/view_image_spec.rs`
  - `codex-rs/core/src/tools/handlers/request_user_input_spec.rs`
  - `codex-rs/core/src/tools/handlers/mcp_resource_spec.rs`
  - `codex-rs/models-manager/prompt.md`

The DSH implementation preserves the named static contract where the host has a matching public capability. It does not copy Codex desktop App or connector tools, and it describes DSH's JSON `{ patch }` transport for `apply_patch` rather than the upstream freeform transport.
