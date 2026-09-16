/** Version-locked static tool catalog derived from the Codex CLI normal coding plan. */

/** Immutable upstream source lock used by contract tests and package notices. */
export const CODEX_SOURCE_LOCK = Object.freeze({
  repository: 'https://github.com/openai/codex',
  commit: '136f75e7b7fca7d327fe0f23368ed5482804ea5f',
  license: 'Apache-2.0',
})

/** One model-visible static Codex capability and its DSH entry path. */
export interface CodexToolCatalogEntry {
  readonly id: string
  readonly toolName: string
  readonly entry: string
  readonly source: string
  readonly availability: 'core' | 'optional-host-service'
}

/**
 * The CLI normal-coding tool surface that DSH intentionally migrates. Desktop
 * App/connector and model-hosted tools are excluded because DSH must expose
 * only services the running host actually supplies.
 */
export const CODEX_TOOL_CATALOG: readonly CodexToolCatalogEntry[] = Object.freeze([
  { id: 'exec-command', toolName: 'exec_command', entry: './exec-command', source: 'handlers/shell_spec.rs', availability: 'core' },
  { id: 'write-stdin', toolName: 'write_stdin', entry: './write-stdin', source: 'handlers/shell_spec.rs', availability: 'core' },
  { id: 'apply-patch', toolName: 'apply_patch', entry: './apply-patch', source: 'handlers/apply_patch_spec.rs', availability: 'core' },
  { id: 'view-image', toolName: 'view_image', entry: './view-image', source: 'handlers/view_image_spec.rs', availability: 'optional-host-service' },
  { id: 'update-plan', toolName: 'update_plan', entry: './update-plan', source: 'handlers/plan_spec.rs', availability: 'core' },
  { id: 'request-user-input', toolName: 'request_user_input', entry: './request-user-input', source: 'handlers/request_user_input_spec.rs', availability: 'optional-host-service' },
  { id: 'request-permissions', toolName: 'request_permissions', entry: './request-permissions', source: 'handlers/shell_spec.rs', availability: 'optional-host-service' },
  { id: 'spawn-agent', toolName: 'spawn_agent', entry: './spawn-agent', source: 'handlers/multi_agents_spec.rs', availability: 'optional-host-service' },
  { id: 'list-agents', toolName: 'list_agents', entry: './list-agents', source: 'handlers/multi_agents_spec.rs', availability: 'optional-host-service' },
  { id: 'send-message', toolName: 'send_message', entry: './send-message', source: 'handlers/multi_agents_spec.rs', availability: 'optional-host-service' },
  { id: 'interrupt-agent', toolName: 'interrupt_agent', entry: './interrupt-agent', source: 'handlers/multi_agents_spec.rs', availability: 'optional-host-service' },
  { id: 'list-mcp-resources', toolName: 'list_mcp_resources', entry: './list-mcp-resources', source: 'handlers/mcp_resource_spec.rs', availability: 'optional-host-service' },
  { id: 'list-mcp-resource-templates', toolName: 'list_mcp_resource_templates', entry: './list-mcp-resource-templates', source: 'handlers/mcp_resource_spec.rs', availability: 'optional-host-service' },
  { id: 'read-mcp-resource', toolName: 'read_mcp_resource', entry: './read-mcp-resource', source: 'handlers/mcp_resource_spec.rs', availability: 'optional-host-service' },
])

/** Fail package startup/tests loudly if a catalog edit duplicates the model-visible contract. */
export function assertCodexToolCatalog(entries: readonly CodexToolCatalogEntry[] = CODEX_TOOL_CATALOG): void {
  const ids = new Set<string>()
  const names = new Set<string>()
  for (const entry of entries) {
    if (entry.id.length === 0 || entry.toolName.length === 0 || entry.entry.length === 0) {
      throw new Error('Codex tool catalog entries require id, toolName, and entry')
    }
    if (ids.has(entry.id)) throw new Error(`duplicate Codex tool catalog id: ${entry.id}`)
    if (names.has(entry.toolName)) throw new Error(`duplicate Codex model tool name: ${entry.toolName}`)
    ids.add(entry.id)
    names.add(entry.toolName)
  }
}
