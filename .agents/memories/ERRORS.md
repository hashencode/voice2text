# ERRORS

## Instructions

- 记录错误现象、根因、修复方式，使用简短中文条目。
- 推荐格式：`- YYYY-MM-DD: [错误] 现象 -> 根因 -> 修复`
- 可跨任务复用的排错策略可加 `#promote`。

## Entries

- 2026-03-25: [TypeScript 全量检查失败] `npx tsc --noEmit` 在当前仓库存在多处历史类型错误（如 `theme/globals` 的 `HEIGHT` 导出缺失、若干 `Timeout` 类型不匹配）-> 非本次改动引入 -> 变更验证优先用目标文件 `eslint` 或局部检查，避免把全量 `tsc` 作为单次改动阻塞项。 #promote
- 2026-03-27: [命令不可用] `pnpm` 在本仓库环境报 `command not found` -> 项目实际使用 `bun.lock` 与 `bun run` 工作流 -> 执行校验/脚本优先用 `bun run <script>`，避免默认使用 `pnpm`。
- 2026-03-29: [命令不可用] `rg` 在当前环境报 `command not found` -> 终端未安装 ripgrep -> 文件检索降级使用 `find` + `grep`，避免依赖 `rg`。
- 2026-03-30: [命令不可用] `python` 在当前环境报 `command not found` -> 仅有 `python3` 或未安装 `python` 别名 -> 文件编辑优先使用 `apply_patch`，脚本型命令优先检查 `python3` 可用性后再执行。
- 2026-03-31: [bun 参数差异] `bun remove -d <pkg>` 报 `Invalid Argument '-d'` -> bun 的 remove 命令不支持 npm 风格 `-d` 参数 -> 直接使用 `bun remove <pkg>`，由 bun 根据 `package.json` 自动处理依赖类别。
- 2026-03-31: [并行命令竞态] 并行执行 `bun remove` 与删除 `postinstall` 目标脚本时触发 `MODULE_NOT_FOUND` -> `bun remove` 会触发项目 postinstall，依赖脚本必须先保留 -> 有依赖顺序的命令禁止并行，先改 `package.json` 再执行卸载。
