# voice2text

基于 Expo + React Native 的语音转文字项目，内置离线 ASR、标点恢复、说话人识别与说话人分离能力。

## 技术栈

- Expo / React Native / TypeScript
- NativeWind
- sherpa-onnx

## 模型清单

### ASR Models（语音识别）

| Type | Name | Source |
| --- | --- | --- |
| `en` | `moonshine-v2-en` | [Link](https://k2-fsa.github.io/sherpa/onnx/moonshine/models-v2.html#sherpa-onnx-moonshine-base-en-quantized-2026-02-27-english) |
| `universal` | `funasr-nano-int8` | [Hugging Face](https://huggingface.co/csukuangfj/sherpa-onnx-funasr-nano-int8-2025-12-30) |
| `zh` | `moonshine-v2-zh` | [Link](https://k2-fsa.github.io/sherpa/onnx/moonshine/models-v2.html#sherpa-onnx-moonshine-base-zh-quantized-2026-02-27-chinese) |

### Punctuation Models（标点恢复）

| Type | Name | Source |
| --- | --- | --- |
| `punctuation.onnx` | `sherpa-onnx-punct-ct-transformer-zh-en-vocab272727-2024-04-12-int8` | [Docs](https://k2-fsa.github.io/sherpa/onnx/punctuation/pretrained_models.html#sherpa-onnx-punct-ct-transformer-zh-en-vocab272727-2024-04-12-int8) |

### Speaker Embedding Models（说话人向量）

| Type | Name | Source |
| --- | --- | --- |
| `speaker-recognition.onnx` | `3dspeaker_speech_campplus_sv_zh-en_16k-common.onnx` | [Release](https://github.com/k2-fsa/sherpa-onnx/releases/tag/speaker-recongition-models) |

### Speaker Diarization Models（说话人分离）

| Type | Name | Source |
| --- | --- | --- |
| `speaker-diarization.onnx` | `sherpa-onnx-pyannote-segmentation-3-0` | [Docs](https://k2-fsa.github.io/sherpa/onnx/speaker-diarization/models.html#sherpa-onnx-pyannote-segmentation-3-0) |

### Speech Enhancement（语音增强）

| Type | Name | Source |
| --- | --- | --- |
| `gtcrn-simple.onnx` | `gtcrn-simple.onnx` | [Docs](https://k2-fsa.github.io/sherpa/onnx/speech-enhancement/models.html#download-the-model) |



## gstack（已接入本项目）

`gstack` 已安装到仓库内：`.agents/skills/gstack`，并已执行 `./setup --host codex`。

### 常用流程（推荐）

1. 需求澄清：`gstack-office-hours`
2. 产品范围评审：`gstack-plan-ceo-review`
3. 技术方案评审：`gstack-plan-eng-review`
4. 代码审查：`gstack-review`
5. 回归测试：`gstack-qa`（仅报告可用 `gstack-qa-only`）
6. 发版准备：`gstack-ship`

### gstack Skills 与使用场景

#### 常用

- `gstack-office-hours`：需求不清晰、要先判断值不值得做时。
- `gstack-plan-ceo-review`：想放大或收敛产品范围、做产品层决策时。
- `gstack-plan-eng-review`：准备开工前做技术方案审查与边界校验时。
- `gstack-review`：提交前做 diff 级代码审查时。
- `gstack-qa`：要“测试并修复”一轮核心流程时。
- `gstack-qa-only`：只要测试报告，不改代码时。
- `gstack-ship`：准备打包变更、提 PR、进入发版流程时。

#### 不常用但实用

- `gstack-investigate`：线上/本地出现诡异 bug，需要根因分析时。
- `gstack-codex`：需要第二意见、挑战当前实现方案时。
- `gstack-cso`：发布前做安全审计、威胁建模时。
- `gstack-design-consultation`：项目缺设计系统，想先建立视觉规范时。
- `gstack-design-review`：页面“能用但不够好看”，做视觉一致性修正时。
- `gstack-plan-design-review`：开发前先审 UI/UX 方案是否完整时。
- `gstack-autoplan`：希望一次性跑完整个评审链（CEO/设计/工程）时。
- `gstack-benchmark`：关注性能回归、加载速度、资源体积变化时。
- `gstack-canary`：上线后短周期盯生产可用性和错误漂移时。
- `gstack-land-and-deploy`：PR 已就绪，需合并并验证部署健康时。
- `gstack-setup-deploy`：首次接入部署平台，配置 deploy 检查命令时。
- `gstack-document-release`：功能已落地后，同步 README/架构/变更文档时。
- `gstack-careful`：执行高风险命令前增加安全确认时。
- `gstack-freeze`：只允许改某个目录，避免误改其他模块时。
- `gstack-unfreeze`：解除目录写入限制，恢复全仓改动能力时。
- `gstack-guard`：既要危险命令保护，又要目录级改动限制时。
- `gstack-browse`：需要真实浏览器链路做 QA、截图和交互验证时。
- `gstack-setup-browser-cookies`：测试登录态页面前导入本机浏览器 Cookie 时。
- `gstack-retro`：周会/迭代复盘，回顾产出与质量趋势时。
- `gstack-upgrade`：gstack 版本过旧或技能异常，执行升级与同步时。

### 常用维护命令

如果 gstack 更新后技能异常，可在项目内重建：

```bash
cd .agents/skills/gstack
./setup --host codex
```

升级 gstack：

```bash
cd .agents/skills/gstack
git pull
./setup --host codex
```



## Expo Skills（已接入本项目）

已通过 `npx skills add expo/skills --yes` 安装 9 个 Expo 官方 skills：

- `building-native-ui`：实现原生风格页面、组件和导航体验时。
- `expo-api-routes`：在 Expo Router 中新增或改造服务端 API 路由时。
- `expo-cicd-workflows`：配置 EAS CI/CD 工作流和自动化构建时。
- `expo-deployment`：准备 iOS/Android/Web 发布流程时。
- `expo-dev-client`：配置 Dev Client、真机联调、调试原生依赖时。
- `expo-tailwind-setup`：搭建或修复 Expo + Tailwind/NativeWind 样式体系时。
- `native-data-fetching`：实现网络请求、缓存、错误处理和离线策略时。
- `upgrading-expo`：升级 Expo SDK 并修复依赖兼容问题时。
- `use-dom`：将 Web 代码逐步接入 Expo DOM 跨端复用时。

在 Codex 中可直接点名技能，例如：

- `使用 expo-dev-client skill，帮我配置并排查 Dev Client 真机调试问题`
- `使用 building-native-ui skill，帮我实现一个新的原生风格组件`
- `使用 native-data-fetching skill，重构当前数据请求和缓存策略`
- `使用 expo-cicd-workflows skill，给我生成 EAS 的 CI 配置`
- `使用 expo-deployment skill，准备 iOS/Android 发版步骤`



## self-improving-for-codex（手动模式）

本项目使用项目内 memory：

- `.agents/memories/PROFILE.md`
- `.agents/memories/ACTIVE.md`
- `.agents/memories/LEARNINGS.md`
- `.agents/memories/ERRORS.md`
- `.agents/memories/FEATURE_REQUESTS.md`

使用方式：

1. 开始任务前先查看 `PROFILE.md` 和 `ACTIVE.md`。
2. 将可复用信息写入对应 memory 文件。
3. 在 `LEARNINGS.md` 或 `ERRORS.md` 条目末尾添加 `#promote` 可作为候选提升到 `ACTIVE.md`。
4. 手动整理：

```bash
npm run memory:review
```

或：

```bash
node scripts/memory-review.mjs
```

约束：

- 默认使用中文记录 memory。
- 当前为手动触发，不自动调度。
- memory 整理不会自动修改 `AGENTS.md`。
