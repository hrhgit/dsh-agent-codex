/** Codex-named read-only subagent catalog over DSH's durable child listings. */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ValueSchemaSpec } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-subagent'

/** Cordis plugin name used by Loader diagnostics. */
export const name = 'codex-list-agents'
/** The subagent service is optional, so this row stays mountable without it. */
export const inject = ['tools']

const LIST_AGENTS_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    agents: {
      type: 'array',
      required: true,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', required: true },
          task_name: { type: 'string' },
          status: { type: 'string', required: true, enum: ['running', 'idle', 'unavailable'] },
        },
      },
    },
  },
} as const satisfies ValueSchemaSpec

/** Register `list_agents` only while the host publishes durable child discovery. */
export function apply(ctx: Context): void {
  ctx.inject(['subagents'], runtime => {
    runtime.tools.register(defineTool({
      name: 'list_agents',
      description: 'List this agent\'s durable direct subagents and their current availability.',
      parameters: {},
      output: {
        schema: LIST_AGENTS_OUTPUT_SCHEMA,
        render: (_args, value) => [{ type: 'text', text: `${value.agents.length} subagent(s).` }],
      },
      async execute(_args, exec) {
        if (exec.agent === undefined) throw new Error('list_agents requires an owning agent session')
        const entries = await runtime.subagents.listChildren(exec.agent.id, exec.signal)
        return {
          agents: entries.map(entry => entry.kind === 'diagnostic'
            ? { id: entry.id, status: 'unavailable' as const }
            : {
              id: entry.id,
              ...entry.label === undefined ? {} : { task_name: entry.label },
              status: entry.activity === 'running' ? 'running' as const : 'idle' as const,
            }),
        }
      },
    }))
  })
}
