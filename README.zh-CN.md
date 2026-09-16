# @hrhgit/dsh-agent-codex

中文 | [English](README.md)

`@hrhgit/dsh-agent-codex` 为 DeepSeek Harness 的 **Codex 模式**提供版本锁定的静态 Codex 编码工具契约。单独安装本包不会产生全局运行时副作用：预设在一个智能体作用域内逐项挂载导出，因此用户先复制系统预设后，Agent Manager 可以查看并独立启停每个已声明工具行。

## 来源与许可

工具目录来自 OpenAI Codex 的 `136f75e7b7fca7d327fe0f23368ed5482804ea5f` 修订，原始许可为 Apache-2.0。精确来源路径和 DSH 编译边界见 [SOURCES.md](SOURCES.md)，所需归属说明见 [NOTICE](NOTICE)。本包自身代码采用 MIT 许可。

## 工具契约

静态目录包含 `exec_command`、`write_stdin`、`apply_patch`、`view_image`、`update_plan`、`request_user_input`、`request_permissions`、四个子智能体控制工具和三个 MCP 资源工具。每个工具名都有独立导出和独立的 preset `agentTool` 行。

模型只会看到运行中 DSH 宿主真实注册的工具：

- `view_image` 需要附件服务和支持图片输入的当前模型路由；
- 人工提问、审批、子智能体和 MCP 资源仅在相应公开服务已挂载时出现；
- MCP 资源工具需要宿主提供 `mcpResources` 服务；仅有普通可调用 MCP 工具不会伪造资源能力。

`apply_patch` 保持 Codex 补丁语法以及新增/更新/删除文件的效果；但 DSH 使用 JSON `{ "patch": "..." }` 传输，而不是 freeform 调用。它只会在宿主公开版本化单文件删除接口时注册，因此每种指令都处于普通文件系统工具相同的观察状态与 Sandbox 策略内。

`write_stdin` 遵循公开的 `ShellProcess` 契约：空输入可轮询输出，Ctrl-C 会终止进程树。当前宿主接口没有任意交互式 stdin 写入能力，其他输入会明确报错。

## 配置

`spawn-agent` 导出接受宿主拥有的 `provider` 配置，默认值为 `spawn`：

```yaml
- id: spawn-agent
  name: '@hrhgit/dsh-agent-codex/spawn-agent'
  config:
    provider: spawn
```

LLM 提供方与模型选择仍由 DeepSeek Harness 的模型中心负责，本包不配置它们。

## 开发

```sh
pnpm run typecheck
pnpm test
pnpm run build
pnpm run pack:check
```
