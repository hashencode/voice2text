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
