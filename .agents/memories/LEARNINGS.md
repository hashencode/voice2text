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
- 2026-04-02: 键盘遮挡适配优先使用 `windowHeight - endCoordinates.screenY` 计算可见键盘高度，并保留 `endCoordinates.height` 回退（Android 各厂商 ROM 差异场景更稳）。 #promote

- 2026-04-07：Expo Android 真机构建若在 qwen/llama.cpp 的 armeabi-v7a 目标报 `vld1q_f16/vld1_f16 undeclared`，根因是 ARMv7 不支持该半精度 NEON intrinsic。修复：在 `modules/qwen/android/build.gradle` 的 `defaultConfig.ndk` 显式限制 `abiFilters "arm64-v8a"`，并使用 `-PreactNativeArchitectures=arm64-v8a` 构建。

- 2026-04-07：Android 原生层若用 `File(modelPath)` 直接校验 Expo 下载返回的 `file://` URI，会误判文件不存在。应先将 URI 解析为真实路径（如 `Uri.parse(path).path`）再 `exists/isFile/length` 校验，并把解析后的路径传入 JNI。
- 2026-04-09: 用户要求后续避免使用 `runOnJS`（视为弃用阶段）；键盘相关显隐逻辑优先采用不依赖 `runOnJS` 的实现。
