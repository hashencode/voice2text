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

function syncModelPackages(srcDir, destDir) {
    fs.rmSync(destDir, { recursive: true, force: true });
    fs.mkdirSync(destDir, { recursive: true });

    if (!fs.existsSync(srcDir)) {
        return;
    }

    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
        if (!entry.isFile()) {
            continue;
        }
        if (!/\.(zip|json)$/i.test(entry.name)) {
            continue;
        }
        const src = path.join(srcDir, entry.name);
        const dest = path.join(destDir, entry.name);
        fs.copyFileSync(src, dest);
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
            syncModelPackages(modelSrcDir, modelDestDir);

            return config;
        },
    ]);

    return config;
};
