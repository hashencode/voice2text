# ERRORS

## Instructions

- 记录错误现象、根因、修复方式，使用简短中文条目。
- 推荐格式：`- YYYY-MM-DD: [错误] 现象 -> 根因 -> 修复`
- 可跨任务复用的排错策略可加 `#promote`。

## Entries

- 2026-03-27: [命令不可用] `pnpm` 在本仓库环境报 `command not found` -> 项目实际使用 `bun.lock` 与 `bun run` 工作流 -> 执行校验/脚本优先用 `bun run <script>`，避免默认使用 `pnpm`。
- 2026-03-30: [命令不可用] `python` 在当前环境报 `command not found` -> 仅有 `python3` 或未安装 `python` 别名 -> 文件编辑优先使用 `apply_patch`，脚本型命令优先检查 `python3` 可用性后再执行。
- 2026-04-12: [URL 命令失败] `zsh` 直接执行含 `?` 的 GitHub API URL 报 `no matches found` -> `?` 被 shell 按通配模式解析 -> URL 参数统一用单引号包裹（如 `curl '...?...'`）避免展开。
- 2026-04-12: [Shell 兼容] 在 `zsh` 使用 `mapfile` 报 `command not found` -> `mapfile` 为 bash 内建 -> 跨 shell 脚本改用 `while read` 或显式 `bash -lc`。
- 2026-04-12: [jq 过滤报错] 组合条件写成 `.path|startswith(...) and (.path|endswith(...))` 报 `Cannot index string with string "path"` -> `jq` 管道优先级导致右侧 `.path` 作用在错误输入上 -> 条件加括号：`select((.path|startswith(...)) and (.path|endswith(...)))`。
- 2026-04-13: [Android 构建失败] `gradlew app:assembleDebug` 报 `:sherpa:configureCMakeDebug[arm64-v8a]` 与 `CMakeLists.txt does not exist` -> `modules/sherpa/android/build.gradle` 配置了 `externalNativeBuild.cmake.path` 但模块仅使用 `libs/sherpa-onnx.aar`、无 `src/main/cpp` -> 移除该模块的 `externalNativeBuild` 配置后构建恢复。 #promote

- 2026-04-13: [Android 闪退] 调用 `getAudioFileInfo` 时崩溃 `UnsatisfiedLinkError: nativeGetAudioFileInfo` -> Kotlin 暴露了 JNI 方法但 AAR/so 中无对应导出符号 -> `getAudioFileInfo` 改为纯 Android API 实现（`MediaExtractor` + `MediaMetadataRetriever` + WAV 头解析），不再依赖该 JNI 符号。
- 2026-04-14: [Android 构建失败] `expo run:android --port 8083` 报 `Unresolved reference 'R'/'BuildConfig'` 或 `com.voice2text.BuildConfig` 找不到 -> 包名存在历史不一致（`app.json`/Kotlin 为 `com.voice2text.beta`，而 `android/app/build.gradle` 或 autolinking 缓存仍是 `com.voice2text`）-> 先统一 `namespace` 与 `applicationId` 为 `com.voice2text.beta`，再删除 `android/build/generated/autolinking/autolinking.json` 和 `package.json.sha` 强制刷新 autolinking 缓存后重试。
- 2026-04-14: [导入识别闪退] 非标准采样率/容器音频在导入页离线识别时闪退 -> 识别前预处理仅按 `sampleRate===16000` 判断是否转码，导致部分输入未被统一成 `wav(16k/mono/s16)` 就进入 native 识别 -> 在 `integrations/sherpa/recognition-service.ts` 中改为识别前统一转码后再调用 `transcribeWavByDownloadedModelWithTiming`。
- 2026-04-24: [类型检查阻断] `npx tsc --noEmit` 在本次 UI 改动前即报 `components/ui/input-otp.tsx` 的 `setActiveIndex` 未定义（121/130 行） -> 属于仓库现存错误、与当前改动无关 -> 验证改动时先跑“改动文件级 eslint + 错误归因”并在提交前单独修复该文件后再恢复全量 tsc 门禁。
- 2026-04-29: [校验命令环境差异] 本地执行 `npx` 报 `command not found`，且 `eslint` 报 `unrs-resolver` native binding 缺失导致大量 `import/no-unresolved` 假阳性 -> 当前环境不适合用 `npx`/eslint 作为改动验证基线 -> 优先使用 `./node_modules/.bin/<tool>` 与 `prettier --check`，类型门禁以 `tsc` 结果分离“现存错误”和“本次改动影响”。 #promote
