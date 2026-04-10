# ERRORS

## Instructions

- 记录错误现象、根因、修复方式，使用简短中文条目。
- 推荐格式：`- YYYY-MM-DD: [错误] 现象 -> 根因 -> 修复`
- 可跨任务复用的排错策略可加 `#promote`。

## Entries

- 2026-03-27: [命令不可用] `pnpm` 在本仓库环境报 `command not found` -> 项目实际使用 `bun.lock` 与 `bun run` 工作流 -> 执行校验/脚本优先用 `bun run <script>`，避免默认使用 `pnpm`。
- 2026-03-30: [命令不可用] `python` 在当前环境报 `command not found` -> 仅有 `python3` 或未安装 `python` 别名 -> 文件编辑优先使用 `apply_patch`，脚本型命令优先检查 `python3` 可用性后再执行。
