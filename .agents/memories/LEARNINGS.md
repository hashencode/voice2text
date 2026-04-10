# LEARNINGS

## Instructions

- 记录可复用结论，使用简短中文条目。
- 推荐格式：`- YYYY-MM-DD: 结论（场景）`
- 如需候选提升到 `ACTIVE.md`，在行尾加 `#promote`。

## Entries

- 2026-03-31: 用户明确要求前端样式优先使用 NativeWind（`className`），仅在动态颜色/运行时值等必要场景使用 `style`；后续生成代码默认遵守该约束。
- 2026-03-25: UI 重构时静态样式尽量用 `className`，动态值才留在 `style`；复用 `theme/globals.ts` 时按语义选值，不做仅凭数字一致的替换。 #promote
- 2026-03-29: 阴影效果优先用 `className` 的 `shadow`（及其变体）实现，减少 `shadow*`/`elevation` 样式样板代码。
- 2026-03-31: 本项目记忆闭环相关任务统一使用 `compound-engineering` 命名，技能触发与规则描述保持一致。
- 2026-04-07：Android 原生层若用 `File(modelPath)` 直接校验 Expo 下载返回的 `file://` URI，会误判文件不存在。应先将 URI 解析为真实路径（如 `Uri.parse(path).path`）再 `exists/isFile/length` 校验，并把解析后的路径传入 JNI。
- 2026-04-09: 用户要求后续避免使用 `runOnJS`（视为弃用阶段）；键盘相关显隐逻辑优先采用不依赖 `runOnJS` 的实现。
- 2026-04-09: 用户明确当前处于开发阶段：默认尽量减少兜底/降级代码、优先暴露问题；若兜底/降级合理，先记录 TODO（含触发条件）再决定实现。 #promote
- 2026-04-09: 用户要求“止血/兜底类逻辑”必须先征得同意再实现，禁止未沟通先落地这类策略。 #promote
- 2026-04-10: sherpa AAR 升级必须做“同编译链成对替换 + APK 符号验收”（`libsherpa-onnx-jni.so` 与 `libonnxruntime.so` 版本需一致），否则会在加载期出现 `OrtGetApiBase` 符号崩溃。 #promote
