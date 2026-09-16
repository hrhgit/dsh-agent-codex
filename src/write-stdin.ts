/** Codex-named continuation for public DSH shell-process sessions. */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ValueSchemaSpec } from '@deepseek-ai/dsh-tools'
import type { CodexExecPoll } from './exec-sessions.js'

/** Cordis plugin name used by Loader diagnostics. */
export const name = 'codex-write-stdin'
/** The exec session bridge is provided by the exec-command entry. */
export const inject = ['tools', 'codexExecSessions']

interface WriteStdinArgs {
  session_id: number
  chars?: string
  yield_time_ms?: number
  max_output_tokens?: number
}

const WRITE_STDIN_OUTPUT_SCHEMA = {
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

/** Register the static `write_stdin` name. */
export function apply(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'write_stdin',
    description: 'Polls an exec_command session. Empty chars poll output; Ctrl-C stops the process when the mounted DSH shell does not expose interactive stdin.',
    parameters: {
      session_id: { type: 'number', required: true, description: 'Identifier returned by exec_command while the process is still running.' },
      chars: { type: 'string', description: 'Empty to poll; Ctrl-C (\\u0003) stops the current process. Other stdin writes depend on the host shell provider and fail explicitly when unavailable.' },
      yield_time_ms: { type: 'number', description: 'Wait before returning new output. Defaults to 5000 ms.' },
      max_output_tokens: { type: 'number', description: 'Advisory output budget. DSH applies the configured shell output cap.' },
    },
    output: { schema: WRITE_STDIN_OUTPUT_SCHEMA, render: (_args, value) => [{ type: 'text', text: value.output }] },
    async execute(args: WriteStdinArgs, exec) {
      if (!Number.isInteger(args.session_id) || args.session_id < 1) throw new Error('session_id must be a positive integer')
      const owner = requireAgent(exec.agent)
      const yieldTimeMs = args.yield_time_ms ?? (args.chars === undefined || args.chars.length === 0 ? 5000 : 250)
      if (!Number.isFinite(yieldTimeMs) || yieldTimeMs < 0 || yieldTimeMs > 300_000) {
        throw new Error('yield_time_ms must be between 0 and 300000')
      }
      return toOutput(await ctx.codexExecSessions.write(owner, args.session_id, args.chars ?? '', yieldTimeMs))
    },
  }))
}

function requireAgent(agent: Agent | undefined): Agent {
  if (agent === undefined) throw new Error('write_stdin requires an owning agent session')
  return agent
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
