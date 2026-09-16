/** Codex-named explicit approval request over DSH's session-scoped approval seam. */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ValueSchemaSpec } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-user-approval'

/** Cordis plugin name used by Loader diagnostics. */
export const name = 'codex-request-permissions'
/** The approval UI is optional; no service means no model-visible permission request. */
export const inject = ['tools']

const REQUEST_PERMISSIONS_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    outcome: { type: 'string', required: true, enum: ['allowed-once', 'rejected', 'cancelled', 'unavailable'] },
  },
} as const satisfies ValueSchemaSpec

/** Register only while the host publishes an actual approval service. */
export function apply(ctx: Context): void {
  ctx.inject(['approval'], runtime => {
    runtime.tools.register(defineTool({
      name: 'request_permissions',
      description: 'Ask the host approval policy to approve this explicit request once. It never creates permanent or broader permissions.',
      parameters: {
        reason: { type: 'string', required: true, description: 'Concise explanation of the concrete action that needs approval.' },
      },
      output: {
        schema: REQUEST_PERMISSIONS_OUTPUT_SCHEMA,
        render: (_args, value) => [{ type: 'text', text: `Approval outcome: ${value.outcome}.` }],
      },
      async execute(args, exec) {
        if (exec.agent === undefined) throw new Error('request_permissions requires an owning agent session')
        if (args.reason.trim().length === 0) throw new Error('reason must be a non-empty string')
        return {
          outcome: await runtime.approval.request({
            agent: exec.agent,
            toolName: 'request_permissions',
            callId: exec.callId,
            reason: args.reason,
            signal: exec.signal,
          }),
        }
      },
    }))
  })
}
