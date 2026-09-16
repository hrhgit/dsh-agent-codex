/** Codex-named cancellation request for a DSH subagent turn. */

import type { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ValueSchemaSpec } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-subagent'

/** Cordis plugin name used by Loader diagnostics. */
export const name = 'codex-interrupt-agent'
/** The subagent service is optional, so this row stays mountable without it. */
export const inject = ['tools']

const INTERRUPT_AGENT_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: { accepted: { type: 'boolean', required: true } },
} as const satisfies ValueSchemaSpec

/** Register `interrupt_agent` only while the host publishes continuation control. */
export function apply(ctx: Context): void {
  ctx.inject(['subagents'], runtime => {
    runtime.tools.register(defineTool({
      name: 'interrupt_agent',
      description: 'Request cancellation of a subagent\'s current turn. The durable conversation remains available for follow-ups.',
      parameters: {
        target: { type: 'string', required: true, description: 'Subagent id to interrupt.' },
      },
      output: {
        schema: INTERRUPT_AGENT_OUTPUT_SCHEMA,
        render: (_args, value) => [{ type: 'text', text: value.accepted ? 'Interrupt requested.' : 'Interrupt was not accepted.' }],
      },
      async execute(args, exec) {
        if (exec.agent === undefined) throw new Error('interrupt_agent requires an owning agent session')
        if (args.target.trim().length === 0) throw new Error('target must be a non-empty string')
        runtime.subagents.interrupt(SessionId(args.target), { kind: 'ancestor', agent: exec.agent })
        return { accepted: true }
      },
    }))
  })
}
