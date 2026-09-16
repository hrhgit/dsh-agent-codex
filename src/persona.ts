/** Dynamic Codex compatibility persona that never mentions a tool the host did not register. */

import type { Context } from '@deepseek-ai/cordis'
import { PERSONA_SECTION } from '@deepseek-ai/dsh-system-prompt'
import { renderCodexPrompt } from './prompt.js'

/** Cordis plugin name used by Loader diagnostics. */
export const name = 'codex-persona'
/** The persona reads the scoped prompt and tool registries. */
export const inject = ['systemPrompt', 'tools']

/** Install the scoped persona, evaluating tool visibility for each assembled request. */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.systemPrompt.section({
    name: PERSONA_SECTION,
    order: ctx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA'),
    text: () => renderCodexPrompt(ctx.tools.schemas().map(schema => schema.name)),
  }), 'codex-persona.section()')
}
