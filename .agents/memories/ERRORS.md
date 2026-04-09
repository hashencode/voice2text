# ERRORS

## Instructions

- 记录错误现象、根因、修复方式，使用简短中文条目。
- 推荐格式：`- YYYY-MM-DD: [错误] 现象 -> 根因 -> 修复`
- 可跨任务复用的排错策略可加 `#promote`。

## Entries

- 2026-04-08: [zsh 路径匹配失败] 读取 `app/(tabs)/test.tsx` 时出现 `no matches found` -> zsh 将括号当作 glob 模式 -> 对含 `()` 的路径使用单引号包裹（或转义括号）再执行 `sed/nl/cat`。
- 2026-03-25: [TypeScript 全量检查失败] `npx tsc --noEmit` 在当前仓库存在多处历史类型错误（如 `theme/globals` 的 `HEIGHT` 导出缺失、若干 `Timeout` 类型不匹配）-> 非本次改动引入 -> 变更验证优先用目标文件 `eslint` 或局部检查，避免把全量 `tsc` 作为单次改动阻塞项。 #promote
- 2026-03-27: [命令不可用] `pnpm` 在本仓库环境报 `command not found` -> 项目实际使用 `bun.lock` 与 `bun run` 工作流 -> 执行校验/脚本优先用 `bun run <script>`，避免默认使用 `pnpm`。
- 2026-03-29: [命令不可用] `rg` 在当前环境报 `command not found` -> 终端未安装 ripgrep -> 文件检索降级使用 `find` + `grep`，避免依赖 `rg`。
- 2026-03-30: [命令不可用] `python` 在当前环境报 `command not found` -> 仅有 `python3` 或未安装 `python` 别名 -> 文件编辑优先使用 `apply_patch`，脚本型命令优先检查 `python3` 可用性后再执行。
- 2026-03-31: [bun 参数差异] `bun remove -d <pkg>` 报 `Invalid Argument '-d'` -> bun 的 remove 命令不支持 npm 风格 `-d` 参数 -> 直接使用 `bun remove <pkg>`，由 bun 根据 `package.json` 自动处理依赖类别。
- 2026-03-31: [并行命令竞态] 并行执行 `bun remove` 与删除 `postinstall` 目标脚本时触发 `MODULE_NOT_FOUND` -> `bun remove` 会触发项目 postinstall，依赖脚本必须先保留 -> 有依赖顺序的命令禁止并行，先改 `package.json` 再执行卸载。

- 2026-04-08: 升级 sherpa-onnx AAR 到 v1.12.35 后，`OfflineSpeechDenoiserModelConfig` 构造签名从 `(gtcrn, numThreads, debug, provider)` 变为 `(gtcrn, dpdfnet, numThreads, debug, provider)`；若未补 `OfflineSpeechDenoiserDpdfNetModelConfig()` 会在 `:sherpa:compileDebugKotlin` 报参数类型错位。
- 2026-04-09: [Android 闪退] 自动 provider 逻辑把 `qnn` 放在首位直接尝试，部分机型/模型组合在 native 初始化阶段触发 `Pure virtual function called` + `SIGABRT`，JS 无法捕获 -> 根因是“先试再回退”对 qnn 不安全 -> 改为原生先给可用 provider 列表，自动链路仅按可用列表尝试，并对 `qwen3_asr` 默认跳过 qnn 自动尝试（显式指定除外）。
- 2026-04-09: [Android 启动识别即崩] `dlopen failed: cannot locate symbol "OrtGetApiBase"`（from `libsherpa-onnx-jni.so`）-> 根因是 `sherpa-onnx.aar` 依赖 ORT 符号版本 `VERS_1.23.2`，但项目引入了 `onnxruntime-android-qnn:1.24.3`（导出 `VERS_1.24.3`）-> 将 ORT 版本回退并对齐到 `1.23.2`。
