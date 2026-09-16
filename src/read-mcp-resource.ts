/** Codex-named optional MCP resource reader. */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ValueSchemaSpec } from '@deepseek-ai/dsh-tools'
import type {} from './mcp-resources.js'

/** Cordis plugin name used by Loader diagnostics. */
export const name = 'codex-read-mcp-resource'
/** The MCP resource service is optional, so no tool appears until it is real. */
export const inject = ['tools']

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    contents: {
      type: 'array',
      required: true,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          uri: { type: 'string', required: true },
          mimeType: { type: 'string' },
          text: { type: 'string' },
          blob: { type: 'string' },
        },
      },
    },
  },
} as const satisfies ValueSchemaSpec

/** Register resource reading only when an actual MCP resource provider is mounted. */
export function apply(ctx: Context): void {
  ctx.inject(['mcpResources'], runtime => {
    runtime.tools.register(defineTool({
      name: 'read_mcp_resource',
      description: 'Read a resource URI returned by list_mcp_resources or a host-published template.',
      parameters: {
        uri: { type: 'string', required: true, description: 'MCP resource URI to read.' },
      },
      output: {
        schema: OUTPUT_SCHEMA,
        render: (_args, value) => [{ type: 'text', text: `${value.contents.length} MCP resource content item(s).` }],
      },
      async execute(args, exec) {
        if (args.uri.trim().length === 0) throw new Error('uri must be a non-empty string')
        return { contents: [...await runtime.mcpResources.readResource(args.uri, exec.signal)] }
      },
    }))
  })
}
