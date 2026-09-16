/** Codex-named plan replacement backed by DSH's durable todo event vocabulary. */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ValueSchemaSpec } from '@deepseek-ai/dsh-tools'

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    'todo/write': { todos: { content: string; status: 'pending' | 'in_progress' | 'completed' }[] }
  }
}

/** Cordis plugin name used by Loader diagnostics. */
export const name = 'codex-update-plan'
/** The durable plan belongs to the calling agent's session. */
export const inject = ['tools']

const STATUS = ['pending', 'in_progress', 'completed'] as const

const UPDATE_PLAN_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    plan: {
      type: 'array',
      required: true,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          step: { type: 'string', required: true },
          status: { type: 'string', required: true, enum: STATUS },
        },
      },
    },
    explanation: { type: 'string' },
  },
} as const satisfies ValueSchemaSpec

/** Register the Codex plan shape while preserving DSH's whole-list persistence rule. */
export function apply(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'update_plan',
    description: 'Replace the current multi-step plan. Keep at most one step in progress; use the whole plan on every call.',
    parameters: {
      explanation: { type: 'string', description: 'Optional short explanation of the plan update.' },
      plan: {
        type: 'array',
        required: true,
        description: 'The complete replacement plan.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            step: { type: 'string', required: true, description: 'A short concrete work item.' },
            status: { type: 'string', required: true, enum: STATUS, description: 'pending, in_progress, or completed.' },
          },
        },
      },
    },
    output: {
      schema: UPDATE_PLAN_OUTPUT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: `Updated plan with ${value.plan.length} step(s).` }],
    },
    async execute(args, exec) {
      if (exec.agent === undefined) throw new Error('update_plan requires an owning agent session')
      const plan = normalize(args.plan)
      exec.agent.session.append('todo/write', {
        todos: plan.map(item => ({ content: item.step, status: item.status })),
      })
      return {
        plan,
        ...args.explanation === undefined ? {} : { explanation: args.explanation },
      }
    },
  }))
}

function normalize(plan: { step: string; status: string }[]): { step: string; status: typeof STATUS[number] }[] {
  if (plan.length === 0) throw new Error('plan must contain at least one step')
  const seen = new Set<string>()
  let active = 0
  const normalized = plan.map((item) => {
    const step = item.step.trim()
    if (step.length === 0) throw new Error('plan steps must be non-empty')
    if (seen.has(step)) throw new Error(`plan repeats step ${JSON.stringify(step)}`)
    seen.add(step)
    if (!STATUS.includes(item.status as typeof STATUS[number])) throw new Error(`invalid plan status ${JSON.stringify(item.status)}`)
    if (item.status === 'in_progress') active += 1
    return { step, status: item.status as typeof STATUS[number] }
  })
  if (active > 1) throw new Error('at most one plan step can be in_progress')
  return normalized
}
