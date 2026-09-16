/** Codex-named optional MCP resource-template discovery. */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ValueSchemaSpec } from '@deepseek-ai/dsh-tools'
import type {} from './mcp-resources.js'

/** Cordis plugin name used by Loader diagnostics. */
export const name = 'codex-list-mcp-resource-templates'
/** The MCP resource service is optional, so no tool appears until it is real. */
export const inject = ['tools']

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    resourceTemplates: {
      type: 'array',
      required: true,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          uriTemplate: { type: 'string', required: true },
          name: { type: 'string', required: true },
          title: { type: 'string' },
          description: { type: 'string' },
          mimeType: { type: 'string' },
        },
      },
    },
  },
} as const satisfies ValueSchemaSpec

/** Register template discovery only when an actual MCP resource provider is mounted. */
export function apply(ctx: Context): void {
  ctx.inject(['mcpResources'], runtime => {
    runtime.tools.register(defineTool({
      name: 'list_mcp_resource_templates',
      description: 'List parameterized MCP resource templates currently published by the host.',
      parameters: {},
      output: {
        schema: OUTPUT_SCHEMA,
        render: (_args, value) => [{ type: 'text', text: `${value.resourceTemplates.length} MCP resource template(s).` }],
      },
      async execute(_args, exec) {
        return { resourceTemplates: [...await runtime.mcpResources.listResourceTemplates(exec.signal)] }
      },
    }))
  })
}
