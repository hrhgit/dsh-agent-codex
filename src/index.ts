/** Bundle entry. The package installs no global runtime row; Codex presets mount individual exports. */

export { CODEX_SOURCE_LOCK, CODEX_TOOL_CATALOG, assertCodexToolCatalog } from './catalog.js'
export { renderCodexPrompt } from './prompt.js'

/** Cordis plugin name used only when a deployment intentionally mounts the root entry. */
export const name = 'dsh-agent-codex'
/** Root installation is inert; model tools are always opt-in preset rows. */
export const inject: string[] = []
/** Keep bundle installation free of process-wide runtime side effects. */
export function apply(): void {}
