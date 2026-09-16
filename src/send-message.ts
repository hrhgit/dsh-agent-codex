/** Codex-named follow-up delivery to a DSH continuable subagent. */

import type { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ValueSchemaSpec } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-subagent'

/** Cordis plugin name used by Loader diagnostics. */
export const name = 'codex-send-message'
/** The subagent service is optional, so this row stays mountable without it. */
export const inject = ['tools']

const SEND_MESSAGE_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: { message_id: { type: 'string', required: true } },
} as const satisfies ValueSchemaSpec

/** Register `send_message` only while the host publishes continuable delivery. */
export function apply(ctx: Context): void {
  ctx.inject(['subagents'], runtime => {
    runtime.tools.register(defineTool({
      name: 'send_message',
      description: 'Send a follow-up to an existing direct subagent conversation.',
      parameters: {
        target: { type: 'string', required: true, description: 'Subagent id returned by spawn_agent.' },
        message: { type: 'string', required: true, description: 'Follow-up message to queue as the subagent\'s next turn.' },
      },
      output: {
        schema: SEND_MESSAGE_OUTPUT_SCHEMA,
        render: (_args, value) => [{ type: 'text', text: `Queued message ${value.message_id}.` }],
      },
      async execute(args, exec) {
        if (exec.agent === undefined) throw new Error('send_message requires an owning agent session')
        if (args.target.trim().length === 0 || args.message.trim().length === 0) {
          throw new Error('target and message must be non-empty strings')
        }
        const messageId = await runtime.subagents.followup(
          exec.agent,
          SessionId(args.target),
          [{ type: 'text', text: args.message }],
          {
            source: { kind: 'coordinator', form: 'relay', senderSessionId: exec.agent.id },
            signal: exec.signal,
          },
        )
        return { message_id: messageId }
      },
    }))
  })
}
