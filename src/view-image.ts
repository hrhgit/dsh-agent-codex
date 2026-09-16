/** Codex-named local-image inspection through DSH attachments. */

import { basename, extname } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { ImageAttachmentRef, ImageMediaType } from '@deepseek-ai/dsh-attachment'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolRunContext, ValueSchemaSpec } from '@deepseek-ai/dsh-tools'
import { resolveOptions } from './fs.js'

/** Cordis plugin name used by Loader diagnostics. */
export const name = 'codex-view-image'
/** Attachments are optional; the tool registers only while one is actually mounted. */
export const inject = ['tools', 'fs']

const IMAGE_MEDIA_TYPES: Readonly<Record<string, ImageMediaType>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

const VIEW_IMAGE_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    path: { type: 'string', required: true },
    image: {
      type: 'object',
      required: true,
      additionalProperties: false,
      properties: {
        attachmentId: { type: 'string', required: true },
        mediaType: { type: 'string', required: true },
        bytes: { type: 'integer', required: true },
        width: { type: 'integer', required: true },
        height: { type: 'integer', required: true },
        name: { type: 'string' },
      },
    },
  },
} as const satisfies ValueSchemaSpec

/** Register only while the host can persist image attachments for the result. */
export function apply(ctx: Context): void {
  ctx.inject(['attachments'], runtime => {
    runtime.tools.register(defineTool({
      name: 'view_image',
      description: 'Read a local PNG, JPEG, WebP, or GIF and return the image for visual inspection. Requires the current model route to accept images.',
      parameters: {
        path: { type: 'string', required: true, description: 'Path to an existing local image file.' },
      },
      output: {
        schema: VIEW_IMAGE_OUTPUT_SCHEMA,
        render: (_args, value) => [
          { type: 'text', text: `Read image ${value.path}.` },
          { type: 'image', attachment: imageRef(value.image) },
        ],
      },
      async execute(args, exec) {
        if (args.path.trim().length === 0) throw new Error('path must be a non-empty string')
        const mediaType = IMAGE_MEDIA_TYPES[extname(args.path).toLowerCase()]
        if (mediaType === undefined) throw new Error('view_image accepts PNG, JPEG, WebP, and GIF files only')
        await assertImageRoute(runtime, exec)
        const target = await runtime.fs.resolve(args.path, resolveOptions(exec))
        const info = await runtime.fs.stat(target, exec.signal)
        if (info === undefined) {
          runtime.emit('fs/observed', target, { kind: 'absent' }, exec)
          throw new Error(`cannot view ${JSON.stringify(target.displayPath)}: file does not exist`)
        }
        if (info.type !== 'file') throw new Error(`cannot view ${JSON.stringify(target.displayPath)}: not a regular file`)
        if (!runtime.attachments.imageLimits.mediaTypes.includes(mediaType)) {
          throw new Error(`${mediaType} images are not accepted by this host attachment service`)
        }
        const maxBytes = Math.min(
          runtime.attachments.imageLimits.maxImageBytes,
          runtime.attachments.imageLimits.maxMessageImageBytes,
        )
        const data = await runtime.fs.readBytes(target, exec.signal, maxBytes)
        const image = await runtime.attachments.saveImage({ data, mediaType, name: basename(target.displayPath) })
        runtime.emit('fs/observed', target, { kind: 'present', version: info.version }, exec)
        return { path: target.displayPath, image }
      },
    }))
  })
}

function imageRef(value: {
  attachmentId: string
  mediaType: string
  bytes: number
  width: number
  height: number
  name?: string
}): ImageAttachmentRef {
  return value as ImageAttachmentRef
}

async function assertImageRoute(ctx: Context, exec: ToolRunContext): Promise<void> {
  const route = exec.agent?.session.requestHeader()?.config
  const provider = route?.provider ?? exec.agent?.options.provider
  const model = route?.model ?? exec.agent?.options.model
  const llm = ctx.get('llm')
  if (provider === undefined || model === undefined || llm === undefined) {
    throw new Error('cannot view an image because the current model route could not be resolved')
  }
  const info = await llm.resolveModelInfo(provider, model, exec.signal)
  if (!info.inputModalities?.includes('image')) {
    throw new Error(`cannot view an image because model ${JSON.stringify(model)} does not declare image input`)
  }
}
