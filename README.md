# voice2text

基于 Expo + React Native 的语音转文字项目，内置离线 ASR、标点恢复、说话人识别与说话人分离能力。

当前默认 ASR 模型：`moonshine-zh`（`moonshine-v2`）。

## 目录地图

- `app/`: 路由入口层，仅放页面组装与导航。
- `features/`: 业务模块层，按功能拆分 UI + hooks + 领域逻辑。
- `components/ui/`: 通用 UI 基元组件。
- `components/layout/`: 页面级共享布局壳。
- `data/`: 持久化访问（SQLite/MMKV）与仓储服务。
- `modules/`: Expo/Native 模块绑定（如 sherpa）。
- `hooks/`: 跨 feature 复用的全局 hooks。
- `theme/`: 主题 token 与 provider。
- `scripts/`: 本地脚本与工程辅助工具。
- `assets/`: 静态资源与离线模型文件。

## 开发测试（模型准确率）

项目已提供可复用脚本模块：`scripts/recognition-accuracy.ts`。

可在开发代码中直接调用 `runRecognitionAccuracy`，用于：
- 识别前置检查（权限、模型安装、版本）
- 执行识别
- 基于 LCS 计算命中率（准确率）

示例：

```ts
import { runRecognitionAccuracy } from '~/scripts/recognition-accuracy';

const result = await runRecognitionAccuracy({
  filePath: wavPath,
  referenceText,
  // modelId: 'paraformer-zh', // 可选
});

console.log('hitRate:', (result.hitRate * 100).toFixed(2) + '%');
```

说明：该模块依赖 Expo Native 能力，应在 App 运行时调用，不是纯 Node CLI 脚本。



## 技术栈

- Expo / React Native / TypeScript
- NativeWind
- sherpa-onnx



## 模型清单

### ASR Models（语音识别）

| Type | Name | Source |
| --- | --- | --- |
| `moonshine-zh` | `moonshine-v2-zh` | Bundled in project (`assets/sherpa/asr/moonshine-zh`) |
| `paraformer-zh` | `paraformer-zh-int8` | [Release](https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models) |



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



# SKILLS

## Gstack

#### 常用命令

- `/office-hours`：需求不清晰、要先判断值不值得做时。
- `/plan-ceo-review`：想放大或收敛产品范围、做产品层决策时。
- `/plan-eng-review`：准备开工前做技术方案审查与边界校验时。
- `/review`：提交前做 diff 级代码审查时。
- `/qa`：要“测试并修复”一轮核心流程时。
- `/qa-only`：只要测试报告，不改代码时。
- `/ship`：准备打包变更、提 PR、进入发版流程时。

#### 不常用命令

- `/investigate`：线上/本地出现诡异 bug，需要根因分析时。
- `/codex`：需要第二意见、挑战当前实现方案时。
- `/cso`：发布前做安全审计、威胁建模时。
- `/design-consultation`：项目缺设计系统，想先建立视觉规范时。
- `/design-review`：页面“能用但不够好看”，做视觉一致性修正时。
- `/plan-design-review`：开发前先审 UI/UX 方案是否完整时。
- `/autoplan`：希望一次性跑完整个评审链（CEO/设计/工程）时。
- `/benchmark`：关注性能回归、加载速度、资源体积变化时。
- `/canary`：上线后短周期盯生产可用性和错误漂移时。
- `/land-and-deploy`：PR 已就绪，需合并并验证部署健康时。
- `/setup-deploy`：首次接入部署平台，配置 deploy 检查命令时。
- `/document-release`：功能已落地后，同步 README/架构/变更文档时。
- `/careful`：执行高风险命令前增加安全确认时。
- `/freeze`：只允许改某个目录，避免误改其他模块时。
- `/unfreeze`：解除目录写入限制，恢复全仓改动能力时。
- `/guard`：既要危险命令保护，又要目录级改动限制时。
- `/browse`：需要真实浏览器链路做 QA、截图和交互验证时。
- `/setup-browser-cookies`：测试登录态页面前导入本机浏览器 Cookie 时。
- `/retro`：周会/迭代复盘，回顾产出与质量趋势时。
- `/gstack-upgrade`：gstack 版本过旧或技能异常，执行升级与同步时。



## compound-engineering 

#### 常用命令

- `/ce-review`：实现后做系统化审查，发现风险与回归点时。
- `/ce-compound`：沉淀本次可复用经验，更新后续可复用知识时。

#### 不常用命令

- `/ce-brainstorm`：需求还模糊，先做问题澄清和方向探索时。
- `/ce-plan`：需求已基本清晰，需要产出可执行技术方案时。
- `/ce-work`：按计划执行实现、拆解任务并推进落地时。

- `/ce-ideate`：希望主动挖掘高价值改进点、做机会发现时。
- `/ce-compound-refresh`：历史沉淀文档/经验过期，需批量刷新与去重时。
