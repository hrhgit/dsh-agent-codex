/** Codex-named command execution over the public DSH shell seam. */

import { isAbsolute, resolve as resolvePath } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ValueSchemaSpec } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-shell-env'
import { CodexExecSessions, type CodexExecPoll } from './exec-sessions.js'

/** Cordis plugin name used by Loader diagnostics. */
export const name = 'codex-exec-command'
/** Public DSH services that own command execution and tool registration. */
export const inject = ['tools', 'shell', 'shellEnv']

interface ExecCommandArgs {
  cmd: string
  workdir?: string
  yield_time_ms?: number
  max_output_tokens?: number
}

const DEFAULT_YIELD_MS = 10_000
const MIN_YIELD_MS = process.platform === 'win32' ? 10_000 : 250
const MAX_YIELD_MS = 30_000

const EXEC_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    output: { type: 'string', required: true },
    wall_time_seconds: { type: 'number', required: true },
    original_token_count: { type: 'number', required: true },
    exit_code: { oneOf: [{ type: 'integer' }, { type: 'null' }] },
    session_id: { type: 'integer' },
  },
} as const satisfies ValueSchemaSpec

/** Register the static `exec_command` name without exposing DSH's native shell tool id. */
export function apply(ctx: Context): void {
  ctx.plugin(CodexExecSessions)
  ctx.tools.register(defineTool({
    name: 'exec_command',
    description: 'Runs a command through the current DSH shell and returns output or a session id for later polling.',
    parameters: {
      cmd: { type: 'string', required: true, description: 'Shell command to execute.' },
      workdir: { type: 'string', description: 'Working directory for the command. Defaults to the session workspace.' },
      yield_time_ms: { type: 'number', description: `Wait before yielding output. Defaults to ${DEFAULT_YIELD_MS} ms; effective range is ${MIN_YIELD_MS}-${MAX_YIELD_MS} ms.` },
      max_output_tokens: { type: 'number', description: 'Advisory output budget. DSH applies the configured shell output cap.' },
    },
    output: { schema: EXEC_OUTPUT_SCHEMA, render: (_args, value) => [{ type: 'text', text: value.output }] },
    async execute(args: ExecCommandArgs, exec) {
      if (args.cmd.trim().length === 0) throw new Error('cmd must be a non-empty string')
      const yieldTimeMs = resolveYield(args.yield_time_ms)
      const owner = requireAgent(exec.agent)
      const sessions = ctx.get('codexExecSessions')
      if (sessions === undefined) throw new Error('exec_command session tracking is unavailable')
      const process = ctx.shell.start(ctx.shell.resolve({
        command: args.cmd,
        workdir: resolveWorkdir(args.workdir, owner),
        dshEnv: ctx.shellEnv.collect(exec),
      }))
      const id = sessions.create(owner, process)
      return toOutput(await sessions.poll(owner, id, yieldTimeMs))
    },
  }))
}

function resolveYield(value: number | undefined): number {
  const resolved = value ?? DEFAULT_YIELD_MS
  if (!Number.isFinite(resolved) || resolved < MIN_YIELD_MS || resolved > MAX_YIELD_MS) {
    throw new Error(`yield_time_ms must be between ${MIN_YIELD_MS} and ${MAX_YIELD_MS}`)
  }
  return resolved
}

function requireAgent(agent: Agent | undefined): Agent {
  if (agent === undefined) throw new Error('exec_command requires an owning agent session')
  return agent
}

function resolveWorkdir(workdir: string | undefined, owner: Agent): string | undefined {
  const cwd = owner.session.header.cwd
  if (workdir === undefined) return cwd
  return cwd !== undefined && !isAbsolute(workdir) ? resolvePath(cwd, workdir) : workdir
}

function toOutput(poll: CodexExecPoll) {
  return {
    output: poll.output,
    wall_time_seconds: poll.wallTimeSeconds,
    original_token_count: poll.originalTokenCount ?? 0,
    ...poll.exitCode !== undefined ? { exit_code: poll.exitCode } : {},
    ...poll.sessionId !== undefined ? { session_id: poll.sessionId } : {},
  }
}
