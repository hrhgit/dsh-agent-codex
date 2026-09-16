/** Small public-DSH filesystem helpers shared by Codex compatibility tools. */

import type { Context } from '@deepseek-ai/cordis'
import type { FsInfo, FsTarget, FsWriteOutcome } from '@deepseek-ai/dsh-fs'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'

/** The versioned host seam returns this stable result after a file removal. */
export interface CodexDeleteOutcome {
  readonly operation: 'delete'
}

/** Resolve paths against the owning agent's workspace when it has one. */
export function resolveOptions(exec: ToolRunContext): { cwd?: string; signal: AbortSignal } {
  return {
    ...exec.agent?.session.header.cwd === undefined ? {} : { cwd: exec.agent.session.header.cwd },
    signal: exec.signal,
  }
}

/** Resolve and require a regular text file, recording the authoritative read observation. */
export async function readRegularText(
  ctx: Context,
  exec: ToolRunContext,
  path: string,
): Promise<{ target: FsTarget; info: FsInfo; text: string }> {
  const target = await ctx.fs.resolve(path, resolveOptions(exec))
  const info = await ctx.fs.stat(target, exec.signal)
  if (info === undefined) {
    ctx.emit('fs/observed', target, { kind: 'absent' }, exec)
    throw new Error(`cannot read ${JSON.stringify(target.displayPath)}: file does not exist`)
  }
  if (info.type !== 'file') throw new Error(`cannot read ${JSON.stringify(target.displayPath)}: not a regular file`)
  const text = await ctx.fs.readText(target, exec.signal)
  ctx.emit('fs/observed', target, { kind: 'present', version: info.version }, exec)
  return { target, info, text }
}

/** Resolve a path and record whether it exists before a create-or-replace patch write. */
export async function resolvePatchTarget(
  ctx: Context,
  exec: ToolRunContext,
  path: string,
): Promise<{ target: FsTarget; info: FsInfo | undefined }> {
  const target = await ctx.fs.resolve(path, resolveOptions(exec))
  const info = await ctx.fs.stat(target, exec.signal)
  ctx.emit('fs/observed', target, info === undefined ? { kind: 'absent' } : { kind: 'present', version: info.version }, exec)
  return { target, info }
}

/** Write through the host's intent policy and publish the resulting observation. */
export async function writePatchedText(
  ctx: Context,
  exec: ToolRunContext,
  target: FsTarget,
  content: string,
): Promise<FsWriteOutcome> {
  const intent = await ctx.waterfall('fs/write-intent', target, exec, () => undefined)
  const outcome = await ctx.fs.writeText(target, content, intent, exec.signal)
  ctx.emit('fs/observed', target, { kind: 'present', version: outcome.version }, exec)
  return outcome
}

/** Delete a previously observed regular file through the host's guarded public seam. */
export async function deletePatchedFile(
  ctx: Context,
  exec: ToolRunContext,
  target: FsTarget,
): Promise<CodexDeleteOutcome> {
  const intent = await ctx.waterfall('fs/delete-intent', target, exec, () => undefined)
  const outcome = await ctx.fs.deleteFile(target, intent, exec.signal)
  ctx.emit('fs/observed', target, { kind: 'absent' }, exec)
  return outcome
}
