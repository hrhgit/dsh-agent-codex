/** Optional public contract a DSH MCP resource provider may publish for Codex compatibility tools. */

import type { Context } from '@deepseek-ai/cordis'

/** One discoverable MCP resource. */
export interface McpResource {
  readonly uri: string
  readonly name: string
  readonly title?: string
  readonly description?: string
  readonly mimeType?: string
}

/** One discoverable parameterized MCP resource template. */
export interface McpResourceTemplate {
  readonly uriTemplate: string
  readonly name: string
  readonly title?: string
  readonly description?: string
  readonly mimeType?: string
}

/** One text or binary resource item returned by an MCP provider. */
export interface McpResourceContent {
  readonly uri: string
  readonly mimeType?: string
  readonly text?: string
  readonly blob?: string
}

/**
 * Optional host seam for MCP resources. `dsh-mcp-client` currently owns
 * model-callable MCP tools; a host that also exposes resources can provide
 * this service and makes the three Codex resource tools appear automatically.
 */
export interface McpResourceService {
  listResources(signal?: AbortSignal): Promise<readonly McpResource[]>
  listResourceTemplates(signal?: AbortSignal): Promise<readonly McpResourceTemplate[]>
  readResource(uri: string, signal?: AbortSignal): Promise<readonly McpResourceContent[]>
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    mcpResources: McpResourceService
  }
}
