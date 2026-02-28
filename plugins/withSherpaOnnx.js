const { withAppBuildGradle, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function ensureDependency(buildGradle) {
    if (buildGradle.includes('implementation(files("libs/sherpa-onnx.aar"))')) {
        return buildGradle;
    }

    return buildGradle.replace(
        /dependencies\s*\{/,
        `dependencies {
    implementation(files("libs/sherpa-onnx.aar"))`,
    );
}

function copyDirRecursive(srcDir, destDir) {
    if (!fs.existsSync(srcDir)) {
        return;
    }
    fs.mkdirSync(destDir, { recursive: true });

    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
        const src = path.join(srcDir, entry.name);
        const dest = path.join(destDir, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(src, dest);
        } else if (entry.isFile()) {
            fs.copyFileSync(src, dest);
        }
    }
}

module.exports = function withSherpaOnnx(config) {
    config = withAppBuildGradle(config, config => {
        config.modResults.contents = ensureDependency(config.modResults.contents);
        return config;
    });

    config = withDangerousMod(config, [
        'android',
        async config => {
            const projectRoot = config.modRequest.projectRoot;

            const aarSrc = path.join(projectRoot, 'assets/sherpa/sherpa-onnx.aar');
            const aarDestDir = path.join(projectRoot, 'android/app/libs');
            const aarDest = path.join(aarDestDir, 'sherpa-onnx.aar');

            if (!fs.existsSync(aarSrc)) {
                throw new Error(`Missing sherpa-onnx.aar at: ${aarSrc}`);
            }
            fs.mkdirSync(aarDestDir, { recursive: true });
            fs.copyFileSync(aarSrc, aarDest);

            const modelSrcDir = path.join(projectRoot, 'assets/sherpa/models');
            const modelDestDir = path.join(projectRoot, 'android/app/src/main/assets/sherpa/models');
            copyDirRecursive(modelSrcDir, modelDestDir);

            return config;
        },
    ]);

    return config;
};
