import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { FileSystem } from '@deepseek-ai/dsh-fs'
import type { FsDirEntry, FsEditOutcome, FsEditRequest, FsInfo, FsPathInfo, FsTarget, FsWriteIntent, FsWriteOutcome } from '@deepseek-ai/dsh-fs'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as ViewImage from '../src/view-image.ts'
import * as RequestInput from '../src/request-user-input.ts'
import * as RequestPermissions from '../src/request-permissions.ts'
import * as SpawnAgent from '../src/spawn-agent.ts'
import * as ListAgents from '../src/list-agents.ts'
import * as SendMessage from '../src/send-message.ts'
import * as InterruptAgent from '../src/interrupt-agent.ts'
import * as ListResources from '../src/list-mcp-resources.ts'
import * as ListTemplates from '../src/list-mcp-resource-templates.ts'
import * as ReadResource from '../src/read-mcp-resource.ts'
import type {} from '../src/mcp-resources.ts'

class EmptyFileSystem extends FileSystem {
  override async resolve(path: string): Promise<FsTarget> { return { targetKey: path as never, displayPath: path } }
  override processPath(target: FsTarget): string { return target.displayPath }
  override fileUrl(target: FsTarget): string { return `file:///${target.displayPath}` }
  override contains(_parent: FsTarget, _child: FsTarget): boolean { return false }
  override async stat(_target: FsTarget): Promise<FsInfo | undefined> { return undefined }
  override async lstat(_path: string): Promise<FsPathInfo | undefined> { return undefined }
  override async readText(_target: FsTarget): Promise<string> { throw new Error('unused') }
  override async streamText(_target: FsTarget): Promise<AsyncIterable<string>> { return (async function* () {})() }
  override async readBytes(_target: FsTarget, _signal: AbortSignal | undefined, _maxBytes: number): Promise<Uint8Array> { return new Uint8Array() }
  override async listDir(_target: FsTarget): Promise<FsDirEntry[]> { return [] }
  override async writeText(_target: FsTarget, _content: string, _expected?: FsWriteIntent): Promise<FsWriteOutcome> { throw new Error('unused') }
  override async editText(_target: FsTarget, _edit: FsEditRequest): Promise<FsEditOutcome> { throw new Error('unused') }
}

let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
})

describe('optional host capabilities', () => {
  it('does not expose optional Codex tools merely because their package rows mounted', async () => {
    context = new Context()
    await context.plugin(SystemPrompt, { persona: '' })
    await context.plugin(ToolRuntime)
    await context.plugin(EmptyFileSystem)
    for (const entry of [ViewImage, RequestInput, RequestPermissions, SpawnAgent, ListAgents, SendMessage, InterruptAgent, ListResources, ListTemplates, ReadResource]) {
      await context.plugin(entry)
    }

    expect(context.tools.schemas()).toEqual([])
  })

  it('exposes MCP resource tools only after a real resource service is provided', async () => {
    context = new Context()
    await context.plugin(SystemPrompt, { persona: '' })
    await context.plugin(ToolRuntime)
    context.provide('mcpResources', {
      listResources: async () => [],
      listResourceTemplates: async () => [],
      readResource: async () => [],
    })
    await context.plugin(ListResources)
    await context.plugin(ListTemplates)
    await context.plugin(ReadResource)

    expect(context.tools.schemas().map(schema => schema.name).sort()).toEqual([
      'list_mcp_resource_templates', 'list_mcp_resources', 'read_mcp_resource',
    ])
  })
})
