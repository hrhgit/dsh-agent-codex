/** Codex-named continuable subagent delegation over DSH's public subagent seam. */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ValueSchemaSpec } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-subagent'

/** Cordis plugin name used by Loader diagnostics. */
export const name = 'codex-spawn-agent'
/** The subagent service is optional, so this row stays mountable without it. */
export const inject = ['tools']

/** Host-owned provider selection; it is not a model/provider route choice. */
export interface Config {
  provider?: string
}

/** Validate the host's subagent provider name. */
export const Config: z<Config> = z.object({
  provider: z.string().default('spawn'),
})

const SPAWN_AGENT_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    agent_id: { type: 'string', required: true },
    provider: { type: 'string', required: true },
  },
} as const satisfies ValueSchemaSpec

/** Register only while a real DSH subagent service is available. */
export function apply(ctx: Context, config: Config = {}): void {
  const provider = config.provider ?? 'spawn'
  ctx.inject(['subagents'], runtime => {
    runtime.tools.register(defineTool({
      name: 'spawn_agent',
      description: 'Create a bounded, independent continuable subagent task through the configured DSH provider.',
      parameters: {
        task_name: { type: 'string', required: true, description: 'Short task label for the delegated work.' },
        message: { type: 'string', required: true, description: 'Self-contained task instructions for the subagent.' },
      },
      output: {
        schema: SPAWN_AGENT_OUTPUT_SCHEMA,
        render: (_args, value) => [{ type: 'text', text: `Started subagent ${value.agent_id} through ${value.provider}.` }],
      },
      async execute(args, exec) {
        if (exec.agent === undefined) throw new Error('spawn_agent requires an owning agent session')
        if (args.task_name.trim().length === 0 || args.message.trim().length === 0) {
          throw new Error('task_name and message must be non-empty strings')
        }
        if (runtime.subagents.getProvider(provider) === undefined) {
          throw new Error(`configured subagent provider ${JSON.stringify(provider)} is unavailable`)
        }
        const started = await runtime.subagents.startContinuable({
          provider,
          label: args.task_name,
          request: {
            parent: exec.agent,
            prompt: [{ type: 'text', text: args.message }],
          },
          signal: exec.signal,
        })
        return { agent_id: started.childId, provider }
      },
    }))
  })
}
