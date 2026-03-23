todo: 我观察到 录音的时候，使用的是 SherpaOnnx.startWavRecording()，我想知道我如果app崩溃闪退、停电关机、app直接被用户退出、被系统级的电话占用麦克风等情况下，录制的音频数据能够完整的保存下来吗？

### ASR Models

语音识别模型

| Type | Name | Source |
| --- | --- | --- |
| `en` | `moonshine-v2-en` | [Link](https://k2-fsa.github.io/sherpa/onnx/moonshine/models-v2.html#sherpa-onnx-moonshine-base-en-quantized-2026-02-27-english) |
| `universal` | `funasr-nano-int8` | [Hugging Face](https://huggingface.co/csukuangfj/sherpa-onnx-funasr-nano-int8-2025-12-30) |
| `zh` | `moonshine-v2-zh` | [Link](https://k2-fsa.github.io/sherpa/onnx/moonshine/models-v2.html#sherpa-onnx-moonshine-base-zh-quantized-2026-02-27-chinese) |



### Punctuation Models

标点符号模型

| Type | Name | Source |
| --- | --- | --- |
| `punctuation.onnx` | `sherpa-onnx-punct-ct-transformer-zh-en-vocab272727-2024-04-12-int8` | [Docs](https://k2-fsa.github.io/sherpa/onnx/punctuation/pretrained_models.html#sherpa-onnx-punct-ct-transformer-zh-en-vocab272727-2024-04-12-int8) |



### Speaker Embedding Models

说话人向量模型

| Type                       | Name                                                | Source |
|----------------------------|-----------------------------------------------------| --- |
| `speaker-recognition.onnx` | `3dspeaker_speech_campplus_sv_zh-en_16k-common.onnx` | [Release](https://github.com/k2-fsa/sherpa-onnx/releases/tag/speaker-recongition-models) |



### Speaker Diarization Models

说话人分离模型

| Type                       | Name | Source |
|----------------------------| --- | --- |
| `speaker-diarization.onnx` | `sherpa-onnx-pyannote-segmentation-3-0` | [Docs](https://k2-fsa.github.io/sherpa/onnx/speaker-diarization/models.html#sherpa-onnx-pyannote-segmentation-3-0) |

### Speach-enhancement

语音增强模型

| Type                       | Name | Source |
|----------------------------| --- | --- |
| `gtcrn-simple.onnx` | `gtcrn-simple.onnx` | [Docs](https://k2-fsa.github.io/sherpa/onnx/speech-enhancement/models.html#download-the-model) |

## gstack（已接入本项目）

`gstack` 已安装到仓库内：`.agents/skills/gstack`，并已执行 `./setup --host codex`。

在 Codex 中会自动发现这些 skill（前缀为 `gstack-`），例如：
- `gstack-office-hours`
- `gstack-plan-ceo-review`
- `gstack-plan-eng-review`
- `gstack-review`
- `gstack-qa`
- `gstack-ship`
- `gstack-browse`

### 推荐使用流程

1. 需求澄清：`gstack-office-hours`
2. 产品范围评审：`gstack-plan-ceo-review`
3. 技术方案评审：`gstack-plan-eng-review`
4. 实现功能后做代码审查：`gstack-review`
5. 回归测试与冒烟：`gstack-qa`（或仅报告 `gstack-qa-only`）
6. 准备发版：`gstack-ship`

### 常用维护命令

如果你更新了 gstack 或技能异常，进入目录重新构建：

```bash
cd .agents/skills/gstack
./setup --host codex
```

## Expo Skills（已接入本项目）

已通过 `npx skills add expo/skills --yes` 安装以下 9 个 Expo 官方 skills：

- `building-native-ui`
- `expo-api-routes`
- `expo-cicd-workflows`
- `expo-deployment`
- `expo-dev-client`
- `expo-tailwind-setup`
- `native-data-fetching`
- `upgrading-expo`
- `use-dom`

### 在 Codex 中怎么用

直接在对话中明确点名 skill 即可，例如：

- `使用 expo-dev-client skill，帮我配置并排查 Dev Client 真机调试问题`
- `使用 building-native-ui skill，帮我实现一个新的原生风格组件`
- `使用 native-data-fetching skill，重构当前数据请求和缓存策略`
- `使用 expo-cicd-workflows skill，给我生成 EAS 的 CI 配置`
- `使用 expo-deployment skill，准备 iOS/Android 发版步骤`

如果你要升级到最新 gstack：

```bash
cd .agents/skills/gstack
git pull
./setup --host codex
```
