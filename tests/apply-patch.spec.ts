import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { FileSystem, FsTargetKey, FsVersion } from '@deepseek-ai/dsh-fs'
import type { FsDirEntry, FsEditOutcome, FsEditRequest, FsInfo, FsPathInfo, FsTarget, FsWriteIntent, FsWriteOutcome } from '@deepseek-ai/dsh-fs'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as ApplyPatch from '../src/apply-patch.ts'

class MemoryFileSystem extends FileSystem {
  readonly files = new Map<string, string>()
  private revision = 0

  override async resolve(path: string, opts?: { cwd?: string }): Promise<FsTarget> {
    const displayPath = opts?.cwd === undefined ? path : resolve(opts.cwd, path)
    return { targetKey: FsTargetKey(displayPath), displayPath }
  }

  override processPath(target: FsTarget): string { return target.displayPath }
  override fileUrl(target: FsTarget): string { return `file:///${target.displayPath}` }
  override contains(parent: FsTarget, child: FsTarget): boolean { return child.displayPath.startsWith(parent.displayPath) }
  override async stat(target: FsTarget): Promise<FsInfo | undefined> {
    const content = this.files.get(target.displayPath)
    return content === undefined ? undefined : { type: 'file', size: content.length, version: FsVersion(String(this.revision)) }
  }
  override async lstat(path: string): Promise<FsPathInfo | undefined> {
    return this.files.has(path) ? { type: 'file', version: FsVersion(String(this.revision)) } : undefined
  }
  override async readText(target: FsTarget): Promise<string> {
    const text = this.files.get(target.displayPath)
    if (text === undefined) throw new Error('not found')
    return text
  }
  override async streamText(target: FsTarget): Promise<AsyncIterable<string>> {
    const text = await this.readText(target)
    return (async function* () { yield text })()
  }
  override async readBytes(target: FsTarget): Promise<Uint8Array> { return new TextEncoder().encode(await this.readText(target)) }
  override async listDir(_target: FsTarget): Promise<FsDirEntry[]> { return [] }
  override async writeText(target: FsTarget, content: string, _expected?: FsWriteIntent): Promise<FsWriteOutcome> {
    const before = this.files.get(target.displayPath) ?? null
    this.files.set(target.displayPath, content)
    this.revision += 1
    return { operation: before === null ? 'create' : 'update', before, after: content, version: FsVersion(String(this.revision)) }
  }
  override async deleteFile(
    target: FsTarget,
    _expected?: { kind: 'deleteIfVersion'; version: FsVersion },
  ): Promise<{ operation: 'delete' }> {
    if (!this.files.delete(target.displayPath)) throw new Error('not found')
    this.revision += 1
    return { operation: 'delete' }
  }
  override async editText(_target: FsTarget, _edit: FsEditRequest): Promise<FsEditOutcome> { throw new Error('unused') }
}

let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
})

describe('apply_patch JSON transport', () => {
  it('parses and applies update/add operations through the public filesystem effect', async () => {
    context = new Context()
    const fs = new MemoryFileSystem(context)
    await context.plugin(SystemPrompt, { persona: '' })
    await context.plugin(ToolRuntime)
    await context.plugin(ApplyPatch)
    fs.files.set('source.txt', 'alpha\nbeta\n')

    const result = await context.tools.execute({
      callId: ToolCallId('patch-fixture'),
      name: 'apply_patch',
      arguments: {
        patch: [
          '*** Begin Patch',
          '*** Update File: source.txt',
          '@@',
          ' alpha',
          '-beta',
          '+gamma',
          '*** Add File: added.txt',
          '+delta',
          '*** End Patch',
        ].join('\n'),
      },
      signal: new AbortController().signal,
    })

    expect(result.isError).toBe(false)
    expect(fs.files.get('source.txt')).toBe('alpha\ngamma\n')
    expect(fs.files.get('added.txt')).toBe('delta\n')
  })

  it('deletes a regular file through the public guarded filesystem effect', async () => {
    context = new Context()
    const fs = new MemoryFileSystem(context)
    await context.plugin(SystemPrompt, { persona: '' })
    await context.plugin(ToolRuntime)
    await context.plugin(ApplyPatch)
    fs.files.set('stale.txt', 'remove me\n')

    const result = await context.tools.execute({
      callId: ToolCallId('patch-delete-fixture'),
      name: 'apply_patch',
      arguments: { patch: ['*** Begin Patch', '*** Delete File: stale.txt', '*** End Patch'].join('\n') },
      signal: new AbortController().signal,
    })

    expect(result.isError).toBe(false)
    expect(fs.files.has('stale.txt')).toBe(false)
    const schema = context.tools.schemas().find(item => item.name === 'apply_patch')
    expect(schema?.parameters.properties).toMatchObject({
      patch: { type: 'string' },
    })
  })
})
