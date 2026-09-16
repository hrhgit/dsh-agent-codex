/** Owner-scoped bridge from DSH background shell handles to Codex unified-exec session ids. */

import { Context, Service } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ShellProcess } from '@deepseek-ai/dsh-shell'

declare module '@deepseek-ai/cordis' {
  interface Context {
    codexExecSessions: CodexExecSessions
  }
}

/** A Codex-style polling result, deliberately limited to capabilities exposed by DSH ShellProcess. */
export interface CodexExecPoll {
  readonly output: string
  readonly wallTimeSeconds: number
  readonly exitCode?: number | null
  readonly sessionId?: number
  readonly originalTokenCount?: number
}

interface SessionRecord {
  readonly owner: Agent
  readonly process: ShellProcess
  readonly startedAt: number
}

/** Per-agent state for process polling and cancellation. */
export class CodexExecSessions extends Service {
  private readonly sessions = new Map<number, SessionRecord>()
  private nextId = 0

  constructor(ctx: Context) {
    super(ctx, 'codexExecSessions')
    ctx.effect(() => () => {
      for (const entry of this.sessions.values()) entry.process.kill()
      this.sessions.clear()
    }, 'codex-exec-sessions.dispose()')
  }

  /** Retain a process until its owner polls its terminal result or the plugin disposes. */
  create(owner: Agent, process: ShellProcess): number {
    const id = ++this.nextId
    this.sessions.set(id, { owner, process, startedAt: Date.now() })
    return id
  }

  /** Poll a process after at most `yieldTimeMs`, consuming only newly available output. */
  async poll(owner: Agent, id: number, yieldTimeMs: number): Promise<CodexExecPoll> {
    const record = this.sessions.get(id)
    if (record === undefined) throw new Error(`unknown exec session ${id}`)
    if (record.owner !== owner) throw new Error(`exec session ${id} belongs to another agent`)
    if (record.process.status === 'running') {
      await Promise.race([
        record.process.done,
        new Promise<void>(resolve => setTimeout(resolve, yieldTimeMs)),
      ])
    }
    const read = record.process.readOutput()
    const complete = record.process.status !== 'running'
    const output = read.delta + (complete ? exitMarker(record.process) : '')
    const result: CodexExecPoll = {
      output,
      wallTimeSeconds: Math.max(0, (Date.now() - record.startedAt) / 1000),
      originalTokenCount: Math.ceil(output.length / 4),
      ...complete ? { exitCode: record.process.exitCode } : { sessionId: id },
    }
    if (complete) this.sessions.delete(id)
    return result
  }

  /**
   * DSH ShellProcess intentionally does not expose stdin. Empty input polls,
   * while Ctrl-C maps to the public tree-kill operation; other writes fail
   * explicitly instead of being silently discarded.
   */
  async write(owner: Agent, id: number, chars: string, yieldTimeMs: number): Promise<CodexExecPoll> {
    const record = this.sessions.get(id)
    if (record === undefined) throw new Error(`unknown exec session ${id}`)
    if (record.owner !== owner) throw new Error(`exec session ${id} belongs to another agent`)
    if (chars === '\u0003') record.process.kill()
    else if (chars.length > 0) {
      throw new Error('this DSH shell session supports polling and Ctrl-C only; interactive stdin is unavailable from the mounted shell provider')
    }
    return this.poll(owner, id, yieldTimeMs)
  }
}

function exitMarker(process: ShellProcess): string {
  if (process.signal !== null) return `\n[terminated by ${process.signal}]\n`
  return `\n[exit code: ${String(process.exitCode ?? 1)}]\n`
}
