const { withAppBuildGradle, withProjectBuildGradle, withDangerousMod } = require('@expo/config-plugins');

const fs = require('fs');
const path = require('path');

module.exports = function withSherpaOnnx(config) {
    // 添加 flatDir
    config = withProjectBuildGradle(config, config => {
        if (!config.modResults.contents.includes('flatDir')) {
            config.modResults.contents += `
            allprojects {
              repositories {
                flatDir {
                  dirs "\${project(':app').projectDir}/libs"
                }
              }
            }
            `;
        }
        return config;
    });

    // 添加 dependency
    config = withAppBuildGradle(config, config => {
        if (!config.modResults.contents.includes('sherpa-onnx')) {
            config.modResults.contents = config.modResults.contents.replace(
                'dependencies {',
                `
                            dependencies {
                              implementation(name: "sherpa-onnx", ext: "aar")
                            `,
            );
        }
        return config;
    });

    // copy aar
    config = withDangerousMod(config, [
        'android',
        async config => {
            const src = path.join(config.modRequest.projectRoot, 'assets/sherpa/sherpa-onnx.aar');
            const destDir = path.join(config.modRequest.projectRoot, 'android/app/libs');
            const dest = path.join(destDir, 'sherpa-onnx.aar');

            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }

            fs.copyFileSync(src, dest);

            return config;
        },
    ]);

    return config;
};
