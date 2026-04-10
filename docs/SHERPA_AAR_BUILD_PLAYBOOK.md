# Sherpa AAR 生成与替换实战手册（voice2text）

> 适用仓库：`/Users/studio/Documents/GitHub/voice2text`  
> 关联源码仓库：`/Users/studio/Documents/GitHub/voice2text-desktop/sherpa-onnx`

## 1. 本次踩坑总结（必须先看）

1. 只替换 `libsherpa-onnx-jni.so` 会触发符号版本崩溃。  
现象：`dlopen failed: cannot locate symbol "OrtGetApiBase"`。  
根因：JNI 是按 ORT `1.24.3` 编译（需要 `OrtGetApiBase@VERS_1.24.3`），但 AAR 里 `libonnxruntime.so` 还是 `1.23.2`。

2. `Moonshine` 中文路径曾触发 JNI 字符串崩溃。  
现象：`JNI DETECTED ERROR ... input is not valid Modified UTF-: illegal continuation byte`。  
根因：JNI 直接 `NewStringUTF` 处理未清洗字节串。

3. `ten-vad` 与 `24000 Hz` 不兼容会导致进程直接死亡。  
日志关键行：`Expected sample rate 16000. Given: 24000`。  
根因：native 侧检查触发，非 JS 可捕获异常。

## 2. 正确总原则（后续都按这个来）

1. `libsherpa-onnx-jni.so` 与 `libonnxruntime.so` 必须来自同一编译链、同一版本。  
2. 优先重打完整 AAR，不要长期使用“只往旧 AAR 注入单个 so”的方式。  
3. 每次替换后都要做二进制验收（`nm -D` 看符号版本是否一致）。  
4. 安装到真机前，必须检查最终 APK 内 `lib/arm64-v8a/*.so`，不是只看 AAR。  
5. Moonshine + ten-vad 场景，采样率不是 16k 时要禁用 ten-vad 或先重采样。

## 3. 本次已落地的关键代码修改

### 3.1 sherpa-onnx JNI：字符串安全化

文件：
- `/Users/studio/Documents/GitHub/voice2text-desktop/sherpa-onnx/sherpa-onnx/jni/offline-recognizer.cc`
- `/Users/studio/Documents/GitHub/voice2text-desktop/sherpa-onnx/sherpa-onnx/jni/online-recognizer.cc`

做法：
1. 新增 `NewJStringFromUtf8Lossy`（先 `RemoveInvalidUtf8Sequences`，再 `NewStringUTF`）。
2. `getResult` 中 `text/tokens/lang/emotion/event` 改为走该 helper。

### 3.2 RN Android 模块：ten-vad 与 24k 防崩

文件：
- `/Users/studio/Documents/GitHub/voice2text/modules/sherpa/android/src/main/java/expo/modules/sherpa/SherpaOnnxModule.kt`

关键位置：
- `createRealtimeVad(...)`：`ten-vad` 且 `sampleRate != 16000` 时直接返回 `null`。
- 离线识别 VAD 初始化分支：同条件下 `Skip offline VAD`。
- streaming 识别 VAD 初始化分支：同条件下 `Skip streaming VAD`。

## 4. 推荐操作流程（可直接照抄）

### Step A：在 sherpa-onnx 仓库编译 arm64 产物

```bash
cd /Users/studio/Documents/GitHub/voice2text-desktop/sherpa-onnx
./build-android-arm64-v8a.sh
```

产物（本次用到）：
- `build-android-arm64-v8a/install/lib/libsherpa-onnx-jni.so`
- `build-android-arm64-v8a/install/lib/libonnxruntime.so`

### Step B：替换 voice2text 的 AAR（至少 arm64 成对替换）

目标 AAR：
- `/Users/studio/Documents/GitHub/voice2text/modules/sherpa/android/libs/sherpa-onnx.aar`

要求：
1. 先备份原 AAR。
2. 同时替换 `jni/arm64-v8a/libsherpa-onnx-jni.so` 和 `jni/arm64-v8a/libonnxruntime.so`。
3. 重新打包 AAR。

### Step C：重建 app 并安装

```bash
cd /Users/studio/Documents/GitHub/voice2text/android
./gradlew :app:clean :app:assembleDebug -x lint -x test

cd /Users/studio/Documents/GitHub/voice2text
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## 5. 二进制验收清单（非常重要）

### 5.1 检查 APK 中符号版本（必须看 APK，不只看 AAR）

```bash
cd /Users/studio/Documents/GitHub/voice2text
rm -rf /tmp/v2t-apk-check && mkdir -p /tmp/v2t-apk-check
unzip -q android/app/build/outputs/apk/debug/app-debug.apk -d /tmp/v2t-apk-check

nm -D /tmp/v2t-apk-check/lib/arm64-v8a/libonnxruntime.so | rg OrtGetApiBase
nm -D /tmp/v2t-apk-check/lib/arm64-v8a/libsherpa-onnx-jni.so | rg OrtGetApiBase
```

判定标准：
1. `libonnxruntime.so` 导出版本 == JNI 依赖版本。  
2. 例如：一个是 `@@VERS_1.24.3`，另一个应是 `@VERS_1.24.3`。

### 5.2 运行时日志关注点

1. 不应再出现 `cannot locate symbol "OrtGetApiBase"`。  
2. Moonshine 中文识别不应再出现 `Modified UTF-` JNI abort。  
3. 出现 `ten-vad only supports 16000 Hz` 时应“跳过 VAD继续识别”，不应闪退。

## 6. 常见问题与对应处理

1. `wget` 缺失导致构建脚本失败。  
临时方案：用 `curl` 包装一个 shim `wget` 放入 PATH。

2. `cmake` 不在 PATH。  
将 Android SDK CMake 目录加入 PATH（例如 `.../sdk/cmake/3.22.1/bin`）。

3. 替换后仍像旧包。  
执行 `:app:clean` 后重建，并确认 `adb install -r` 使用的是刚生成的 APK。

## 7. 回滚方案

1. 每次替换 AAR 前都保留时间戳备份（例如 `sherpa-onnx.aar.bak.*`）。  
2. 出现回归时先恢复上一版 AAR，再重建 APK 验证。  
3. 回滚后仍崩则说明问题不在 AAR，需回看业务层配置（如 VAD 采样率、模型文件完整性）。

## 8. 下次升级建议

1. 如果准备长期维护，建议把“重打 AAR + 二进制验收”做成脚本。  
2. 如果要支持 `ten-vad + 24k`，应增加重采样链路（24k -> 16k）后再喂 VAD。  
3. 每次升级 sherpa-onnx 后先做以下最小回归：
   - moonshine-zh 纯识别
   - moonshine-zh + VAD
   - 非中文模型对照
