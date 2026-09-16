/**
 * Compile-time declaration for the version-locked DSH filesystem delete seam.
 *
 * The plugin is developed against the host source lock while its published
 * peer range still accepts the previous alpha package. This declaration keeps
 * that narrow forward-compatible surface explicit until the host release ships
 * the same types. It has no runtime effect.
 */

import type { FsTarget, FsVersion } from '@deepseek-ai/dsh-fs'
import type { SandboxExecutionPolicy } from '@deepseek-ai/dsh-sandbox'

type CodexFsDeleteIntent = {
  readonly kind: 'deleteIfVersion'
  readonly version: FsVersion
}

declare module '@deepseek-ai/dsh-fs' {
  interface FileSystem {
    deleteFile(
      target: FsTarget,
      expected?: CodexFsDeleteIntent,
      signal?: AbortSignal,
      sandboxPolicy?: SandboxExecutionPolicy,
    ): Promise<{ readonly operation: 'delete' }>
  }
}

declare module '@deepseek-ai/cordis' {
  interface Events {
    'fs/delete-intent'(
      target: FsTarget,
      actor: object | undefined,
      next: () => CodexFsDeleteIntent | undefined | Promise<CodexFsDeleteIntent | undefined>,
    ): Promise<CodexFsDeleteIntent | undefined>
  }
}

export {}
