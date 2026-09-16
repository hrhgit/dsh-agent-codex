/** Codex-named concise human-question tool over DSH's user-question seam. */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ValueSchemaSpec } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-user-questions'

/** Cordis plugin name used by Loader diagnostics. */
export const name = 'codex-request-user-input'
/** The actual question service is optional, so an absent UI hides the tool. */
export const inject = ['tools']

const REQUEST_USER_INPUT_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    answers: { type: 'object', additionalProperties: true, required: true },
  },
} as const satisfies ValueSchemaSpec

/** Register only while a real DSH user-question answerer service is mounted. */
export function apply(ctx: Context): void {
  ctx.inject(['userQuestions'], runtime => {
    runtime.tools.register(defineTool({
      name: 'request_user_input',
      description: 'Ask one to three concise multiple-choice questions when a user-owned decision or material ambiguity blocks progress.',
      parameters: {
        questions: {
          type: 'array',
          required: true,
          description: 'One to three questions. Each provides two or three mutually exclusive choices.',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              id: { type: 'string', required: true, description: 'Stable answer key.' },
              header: { type: 'string', required: true, description: 'Short visible heading.' },
              question: { type: 'string', required: true, description: 'The user-facing question.' },
              options: {
                type: 'array',
                required: true,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    label: { type: 'string', required: true },
                    description: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
      output: {
        schema: REQUEST_USER_INPUT_OUTPUT_SCHEMA,
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value.answers) }],
      },
      async execute(args, exec) {
        if (exec.agent === undefined) throw new Error('request_user_input requires an owning agent session')
        validateQuestions(args.questions)
        const answer = await runtime.userQuestions.ask({
          agent: exec.agent,
          signal: exec.signal,
          questions: args.questions.map(question => ({
            id: question.id,
            header: question.header,
            question: question.question,
            options: question.options.map(option => ({
              label: option.label,
              ...option.description === undefined ? {} : { description: option.description },
            })),
          })),
        })
        return {
          answers: Object.fromEntries(answer.answers.map(item => [item.id, {
            selected: item.selected,
            ...item.custom === undefined ? {} : { custom: item.custom },
          }])),
        }
      },
    }))
  })
}

function validateQuestions(questions: { id: string; header: string; question: string; options: { label: string }[] }[]): void {
  if (questions.length < 1 || questions.length > 3) throw new Error('request_user_input requires one to three questions')
  const ids = new Set<string>()
  for (const item of questions) {
    if (item.id.trim().length === 0 || item.header.trim().length === 0 || item.question.trim().length === 0) {
      throw new Error('question id, header, and question must be non-empty')
    }
    if (ids.has(item.id)) throw new Error(`duplicate question id ${JSON.stringify(item.id)}`)
    ids.add(item.id)
    if (item.options.length < 2 || item.options.length > 3) {
      throw new Error(`question ${JSON.stringify(item.id)} requires two or three options`)
    }
    if (item.options.some(option => option.label.trim().length === 0)) {
      throw new Error(`question ${JSON.stringify(item.id)} has an empty option label`)
    }
  }
}
