/** Codex-named patch application over the public DSH filesystem seam. */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolRunContext, ValueSchemaSpec } from '@deepseek-ai/dsh-tools'
import { deletePatchedFile, readRegularText, resolvePatchTarget, writePatchedText } from './fs.js'

/** Cordis plugin name used by Loader diagnostics. */
export const name = 'codex-apply-patch'
/** Public service required for the JSON patch transport. */
export const inject = ['tools', 'fs']

type PatchOperation =
  | { readonly kind: 'add'; readonly path: string; readonly content: string }
  | { readonly kind: 'update'; readonly path: string; readonly hunks: readonly PatchHunk[] }
  | { readonly kind: 'delete'; readonly path: string }

interface PatchHunk {
  readonly oldText: string
  readonly newText: string
}

const PATCH_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    files: {
      type: 'array',
      required: true,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', required: true },
          operation: { type: 'string', required: true, enum: ['add', 'update', 'delete'] },
        },
      },
    },
  },
} as const satisfies ValueSchemaSpec

/** Parse the Codex `*** Begin Patch` grammar into public-filesystem operations. */
export function parseCodexPatch(source: string): readonly PatchOperation[] {
  const lines = source.replaceAll('\r\n', '\n').split('\n')
  if (lines[0] !== '*** Begin Patch') throw new Error('patch must start with "*** Begin Patch"')
  const end = lines.lastIndexOf('*** End Patch')
  if (end < 0 || end !== lines.length - 1) throw new Error('patch must end with "*** End Patch"')

  const operations: PatchOperation[] = []
  let index = 1
  while (index < end) {
    const header = lines[index]!
    if (header.startsWith('*** Add File: ')) {
      const path = requiredPath(header.slice('*** Add File: '.length))
      index += 1
      const body: string[] = []
      while (index < end && !lines[index]!.startsWith('*** ')) {
        const line = lines[index++]!
        if (!line.startsWith('+')) throw new Error(`add-file ${path} contains a line without a + prefix`)
        body.push(line.slice(1))
      }
      operations.push({ kind: 'add', path, content: body.join('\n') + (body.length === 0 ? '' : '\n') })
      continue
    }
    if (header.startsWith('*** Update File: ')) {
      const path = requiredPath(header.slice('*** Update File: '.length))
      index += 1
      const hunks: PatchHunk[] = []
      while (index < end && !lines[index]!.startsWith('*** ')) {
        if (!lines[index]!.startsWith('@@')) throw new Error(`update-file ${path} must begin each hunk with @@`)
        index += 1
        const oldLines: string[] = []
        const newLines: string[] = []
        let changed = false
        while (index < end && !lines[index]!.startsWith('@@') && !lines[index]!.startsWith('*** ')) {
          const line = lines[index++]!
          if (line === '\\ No newline at end of file') continue
          const prefix = line[0]
          if (prefix === ' ') {
            oldLines.push(line.slice(1))
            newLines.push(line.slice(1))
          } else if (prefix === '-') {
            oldLines.push(line.slice(1))
            changed = true
          } else if (prefix === '+') {
            newLines.push(line.slice(1))
            changed = true
          } else {
            throw new Error(`update-file ${path} contains an invalid hunk line`)
          }
        }
        if (!changed || oldLines.length === 0) {
          throw new Error(`update-file ${path} needs a non-empty, changing hunk context`)
        }
        hunks.push({ oldText: oldLines.join('\n'), newText: newLines.join('\n') })
      }
      if (hunks.length === 0) throw new Error(`update-file ${path} must contain at least one hunk`)
      operations.push({ kind: 'update', path, hunks })
      continue
    }
    if (header.startsWith('*** Delete File: ')) {
      operations.push({ kind: 'delete', path: requiredPath(header.slice('*** Delete File: '.length)) })
      index += 1
      continue
    }
    throw new Error(`unsupported patch directive: ${header}`)
  }
  if (operations.length === 0) throw new Error('patch must contain at least one file operation')
  return operations
}

/** Apply a parsed patch through DSH reads, observation policy, and atomic mutations. */
export async function applyCodexPatch(
  ctx: Context,
  exec: ToolRunContext,
  operations: readonly PatchOperation[],
): Promise<{ files: { path: string; operation: 'add' | 'update' | 'delete' }[] }> {
  const files: { path: string; operation: 'add' | 'update' | 'delete' }[] = []
  for (const operation of operations) {
    if (operation.kind === 'delete') {
      const { target, info } = await resolvePatchTarget(ctx, exec, operation.path)
      if (info === undefined) throw new Error(`cannot delete ${JSON.stringify(target.displayPath)}: file does not exist`)
      if (info.type !== 'file') throw new Error(`cannot delete ${JSON.stringify(target.displayPath)}: not a regular file`)
      await deletePatchedFile(ctx, exec, target)
      files.push({ path: target.displayPath, operation: 'delete' })
      continue
    }
    if (operation.kind === 'add') {
      const { target, info } = await resolvePatchTarget(ctx, exec, operation.path)
      if (info !== undefined) throw new Error(`cannot add ${JSON.stringify(target.displayPath)}: file already exists`)
      await writePatchedText(ctx, exec, target, operation.content)
      files.push({ path: target.displayPath, operation: 'add' })
      continue
    }
    const { target, text } = await readRegularText(ctx, exec, operation.path)
    let next = text
    for (const hunk of operation.hunks) next = applyHunk(next, hunk, target.displayPath)
    await writePatchedText(ctx, exec, target, next)
    files.push({ path: target.displayPath, operation: 'update' })
  }
  return { files }
}

/** Register `apply_patch` with DSH's explicit `{ patch }` JSON transport. */
export function apply(ctx: Context): void {
  // Older hosts expose the read/write/edit seam but not the versioned regular
  // file deletion operation. Do not register a misleading partial Codex tool:
  // the scoped persona then omits apply_patch from its visible-tool guidance.
  if (typeof ctx.fs.deleteFile !== 'function') return
  ctx.tools.register(defineTool({
    name: 'apply_patch',
    description: 'Apply a Codex patch. Pass JSON { patch: "*** Begin Patch ... *** End Patch" }; this host does not use a freeform transport.',
    parameters: {
      patch: { type: 'string', required: true, description: 'A complete Codex *** Begin Patch patch string.' },
    },
    output: {
      schema: PATCH_OUTPUT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: `Applied Codex patch to ${value.files.length} file(s).` }],
    },
    async execute(args, exec) {
      if (args.patch.trim().length === 0) throw new Error('patch must be a non-empty string')
      return applyCodexPatch(ctx, exec, parseCodexPatch(args.patch))
    },
  }))
}

function requiredPath(path: string): string {
  if (path.trim().length === 0) throw new Error('patch file paths must be non-empty')
  return path
}

function applyHunk(source: string, hunk: PatchHunk, displayPath: string): string {
  let first = source.indexOf(hunk.oldText)
  if (first < 0) throw new Error(`cannot apply patch to ${JSON.stringify(displayPath)}: hunk context was not found`)
  if (source.indexOf(hunk.oldText, first + 1) >= 0) {
    throw new Error(`cannot apply patch to ${JSON.stringify(displayPath)}: hunk context is ambiguous`)
  }
  return source.slice(0, first) + hunk.newText + source.slice(first + hunk.oldText.length)
}
