import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import { ShellExecutor } from '@deepseek-ai/dsh-shell'
import type { ShellExecRequest, ShellExecSpec, ShellProcess, ShellRunResult } from '@deepseek-ai/dsh-shell'
import * as ShellEnv from '@deepseek-ai/dsh-shell-env'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as ExecCommand from '../src/exec-command.ts'

class CompletedShell extends ShellExecutor {
  readonly requests: ShellExecSpec[] = []

  override resolve(request: ShellExecRequest): ShellExecSpec {
    return {
      command: request.command,
      workdir: request.workdir ?? process.cwd(),
      timeoutMs: request.timeoutMs ?? 60_000,
      stdoutMaxBytes: request.stdoutMaxBytes ?? 64_000,
      ...request.signal === undefined ? {} : { signal: request.signal },
      ...request.stdin === undefined ? {} : { stdin: request.stdin },
      ...request.env === undefined ? {} : { env: request.env },
      ...request.dshEnv === undefined ? {} : { dshEnv: request.dshEnv },
      ...request.sandboxPolicy === undefined ? {} : { sandboxPolicy: request.sandboxPolicy },
    }
  }

  override async run(_spec: ShellExecSpec): Promise<ShellRunResult> {
    throw new Error('exec_command uses the persistent start seam')
  }

  override start(spec: ShellExecSpec): ShellProcess {
    this.requests.push(spec)
    return {
      status: 'completed',
      exitCode: 0,
      signal: null,
      done: Promise.resolve(),
      readOutput: () => ({ delta: 'fixture output', lossy: false }),
      kill: () => false,
    }
  }
}

let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
})

describe('exec_command contract', () => {
  it('keeps the Codex name/schema and runs through the public DSH shell session', async () => {
    context = new Context()
    await context.plugin(SystemPrompt, { persona: '' })
    await context.plugin(ToolRuntime)
    await context.plugin(ShellEnv)
    await context.plugin(CompletedShell)
    await context.plugin(ExecCommand)
    const shell = context.shell as CompletedShell

    const result = await context.tools.execute({
      callId: ToolCallId('codex-exec-fixture'),
      name: 'exec_command',
      arguments: {
        cmd: 'echo fixture',
        workdir: '/fixture',
        yield_time_ms: process.platform === 'win32' ? 10_000 : 250,
      },
      agent: { session: { header: { cwd: '/workspace' } } } as never,
      signal: new AbortController().signal,
    })

    expect(result.isError, JSON.stringify(result)).toBe(false)
    expect(shell.requests).toMatchObject([{ command: 'echo fixture', workdir: '/fixture' }])
    expect(result).toMatchObject({ value: { output: expect.stringContaining('fixture output'), exit_code: 0 } })
    const schema = context.tools.schemas().find(item => item.name === 'exec_command')
    expect(Object.keys(schema?.parameters.properties ?? {}).sort()).toEqual([
      'cmd', 'max_output_tokens', 'workdir', 'yield_time_ms',
    ])
  })
})
