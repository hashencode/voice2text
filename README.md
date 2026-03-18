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
