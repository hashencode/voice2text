# TODO

## Sherpa FFmpeg 迁移后续

- [ ] 迁移 `react-native-sherpa-onnx` 的自动下载 + 版本校验机制（类似 `prebuilt-download.gradle`）到 `modules/sherpa/android`。
- [ ] 新增 FFmpeg 预编译资源版本清单（tag、URL、sha256、ABI 文件列表）并在构建前做完整性校验。
- [ ] 增加 Gradle 任务：本地缺失时自动下载并解压到 `modules/sherpa/android/src/main/{cpp/include/ffmpeg,jniLibs}`，存在则跳过。
- [ ] 增加“版本戳/锁文件”策略，避免团队成员因为本地缓存版本不一致导致编译或运行差异。
- [ ] 在 CI 增加校验步骤：校验预编译资源版本与 checksum，失败时直接阻断构建。
- [ ] 补充迁移文档：下载来源、升级流程、回滚流程、常见坑（符号冲突 / ABI 缺失 / tag 变更）。
