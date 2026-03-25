# ACTIVE

## High Priority Rules

- 对 Expo/React Native 相关实现，优先参考 Expo 官方文档（`llms*.txt` 与目标页面 `index.md`）。
- 新增 UI 组件尽量使用 NativeWind，避免无必要的 inline style。
- 涉及 `Text`/`Button` 统一优先靠拢 `TextX`/`ButtonX`，避免别名导入。
- 保持性能优先，动画方案避免掉帧；蒙层/弹层动画分离时优先简单稳定路径。
- 静态样式优先改成 `className`，仅保留必要的动态 `style`；优先复用 `theme/globals.ts` 变量，但避免“数值虽相同、语义不清”的机械替换。

## Promotion Notes

- 仅保留跨任务稳定复用的规则。
- 每小时整理时允许移除过期规则。
