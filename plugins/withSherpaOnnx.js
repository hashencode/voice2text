const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function syncModelPackages(srcDir, destDir) {
    fs.rmSync(destDir, { recursive: true, force: true });
    fs.mkdirSync(destDir, { recursive: true });

    if (!fs.existsSync(srcDir)) {
        return;
    }

    const ALLOWED_EXTENSIONS = /\.(zip|json|onnx|txt)$/i;

    function copyRecursively(currentSrc, currentDest) {
        fs.mkdirSync(currentDest, { recursive: true });
        for (const entry of fs.readdirSync(currentSrc, { withFileTypes: true })) {
            const srcPath = path.join(currentSrc, entry.name);
            const destPath = path.join(currentDest, entry.name);
            if (entry.isDirectory()) {
                copyRecursively(srcPath, destPath);
                continue;
            }
            if (!entry.isFile()) {
                continue;
            }
            if (!ALLOWED_EXTENSIONS.test(entry.name)) {
                continue;
            }
            fs.copyFileSync(srcPath, destPath);
        }
    }

    copyRecursively(srcDir, destDir);
}

module.exports = function withSherpaOnnx(config) {
    config = withDangerousMod(config, [
        'android',
        async config => {
            const projectRoot = config.modRequest.projectRoot;

            const modelSrcDir = path.join(projectRoot, 'assets/sherpa/models');
            const modelDestDir = path.join(projectRoot, 'android/app/src/main/assets/sherpa/models');
            syncModelPackages(modelSrcDir, modelDestDir);

            const vadSrcDir = path.join(projectRoot, 'assets/sherpa/vad');
            const vadDestDir = path.join(projectRoot, 'android/app/src/main/assets/sherpa/vad');
            syncModelPackages(vadSrcDir, vadDestDir);

            return config;
        },
    ]);

    return config;
};
