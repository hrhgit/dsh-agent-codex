import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { CODEX_SOURCE_LOCK, CODEX_TOOL_CATALOG, assertCodexToolCatalog } from '../src/catalog.ts'
import { renderCodexPrompt } from '../src/prompt.ts'

describe('version-locked Codex catalog', () => {
  it('pins the reviewed Codex source and has one entry per model-visible name', () => {
    expect(CODEX_SOURCE_LOCK).toEqual({
      repository: 'https://github.com/openai/codex',
      commit: '136f75e7b7fca7d327fe0f23368ed5482804ea5f',
      license: 'Apache-2.0',
    })
    expect(() => assertCodexToolCatalog()).not.toThrow()
    expect(CODEX_TOOL_CATALOG.map(entry => entry.toolName)).toEqual(expect.arrayContaining([
      'exec_command', 'write_stdin', 'apply_patch', 'view_image', 'update_plan',
      'request_user_input', 'request_permissions', 'spawn_agent', 'list_agents',
      'send_message', 'interrupt_agent', 'list_mcp_resources',
      'list_mcp_resource_templates', 'read_mcp_resource',
    ]))
  })

  it('compiles prompt guidance from the actual visible tools only', () => {
    const prompt = renderCodexPrompt(['exec_command', 'apply_patch', 'update_plan'])

    expect(prompt).toContain('Use exec_command')
    expect(prompt).toContain('JSON object with a patch string')
    expect(prompt).toContain('Keep multi-step work in update_plan')
    expect(prompt).not.toContain('Use write_stdin')
    expect(prompt).not.toContain('MCP resource discovery is available')
    expect(prompt).not.toContain('Use view_image')
  })

  it('keeps every catalog entry reachable through an exported plugin subpath', async () => {
    const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
      exports: Record<string, unknown>
    }
    for (const entry of CODEX_TOOL_CATALOG) {
      expect(manifest.exports[entry.entry], entry.toolName).toBeDefined()
    }
  })
})
