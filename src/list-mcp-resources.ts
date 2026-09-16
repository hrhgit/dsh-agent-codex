/** Codex-named optional MCP resource discovery. */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ValueSchemaSpec } from '@deepseek-ai/dsh-tools'
import type {} from './mcp-resources.js'

/** Cordis plugin name used by Loader diagnostics. */
export const name = 'codex-list-mcp-resources'
/** The MCP resource service is optional, so no tool appears until it is real. */
export const inject = ['tools']

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    resources: {
      type: 'array',
      required: true,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          uri: { type: 'string', required: true },
          name: { type: 'string', required: true },
          title: { type: 'string' },
          description: { type: 'string' },
          mimeType: { type: 'string' },
        },
      },
    },
  },
} as const satisfies ValueSchemaSpec

/** Register resource discovery only when an actual MCP resource provider is mounted. */
export function apply(ctx: Context): void {
  ctx.inject(['mcpResources'], runtime => {
    runtime.tools.register(defineTool({
      name: 'list_mcp_resources',
      description: 'List MCP resources currently published by the host.',
      parameters: {},
      output: {
        schema: OUTPUT_SCHEMA,
        render: (_args, value) => [{ type: 'text', text: `${value.resources.length} MCP resource(s).` }],
      },
      async execute(_args, exec) {
        return { resources: [...await runtime.mcpResources.listResources(exec.signal)] }
      },
    }))
  })
}
