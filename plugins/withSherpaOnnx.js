const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function syncModelPackages(srcDir, destDir) {
    fs.rmSync(destDir, { recursive: true, force: true });
    fs.mkdirSync(destDir, { recursive: true });

    if (!fs.existsSync(srcDir)) {
        return;
    }

    const ALLOWED_EXTENSIONS = /\.(zip|json|onnx|txt|wav)$/i;

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

            const modelSrcDir = path.join(projectRoot, 'assets/sherpa/asr');
            const modelDestDir = path.join(projectRoot, 'android/app/src/main/assets/sherpa/asr');
            syncModelPackages(modelSrcDir, modelDestDir);

            const vadSrcDir = path.join(projectRoot, 'assets/sherpa/vad');
            const vadDestDir = path.join(projectRoot, 'android/app/src/main/assets/sherpa/vad');
            syncModelPackages(vadSrcDir, vadDestDir);

            const segmentationSrcDir = path.join(projectRoot, 'assets/sherpa/segmentation');
            const segmentationDestDir = path.join(projectRoot, 'android/app/src/main/assets/sherpa/segmentation');
            syncModelPackages(segmentationSrcDir, segmentationDestDir);

            const speakerEmbeddingSrcDir = path.join(projectRoot, 'assets/sherpa/speaker-embedding');
            const speakerEmbeddingDestDir = path.join(projectRoot, 'android/app/src/main/assets/sherpa/speaker-embedding');
            syncModelPackages(speakerEmbeddingSrcDir, speakerEmbeddingDestDir);

            const wavSrcDir = path.join(projectRoot, 'assets/wav');
            const wavDestDir = path.join(projectRoot, 'android/app/src/main/assets/wav');
            syncModelPackages(wavSrcDir, wavDestDir);

            return config;
        },
    ]);

    return config;
};
