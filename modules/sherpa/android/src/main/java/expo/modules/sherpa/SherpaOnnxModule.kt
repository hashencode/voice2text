package expo.modules.sherpa

import android.content.res.AssetManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import com.k2fsa.sherpa.onnx.FeatureConfig
import com.k2fsa.sherpa.onnx.OfflineFunAsrNanoModelConfig
import com.k2fsa.sherpa.onnx.OfflineModelConfig
import com.k2fsa.sherpa.onnx.OfflineMoonshineModelConfig
import com.k2fsa.sherpa.onnx.OfflinePunctuation
import com.k2fsa.sherpa.onnx.OfflinePunctuationConfig
import com.k2fsa.sherpa.onnx.OfflinePunctuationModelConfig
import com.k2fsa.sherpa.onnx.OfflineRecognizer
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig
import com.k2fsa.sherpa.onnx.OfflineRecognizerResult
import com.k2fsa.sherpa.onnx.OfflineSpeechDenoiser
import com.k2fsa.sherpa.onnx.OfflineSpeechDenoiserConfig
import com.k2fsa.sherpa.onnx.OfflineSpeechDenoiserGtcrnModelConfig
import com.k2fsa.sherpa.onnx.OfflineSpeechDenoiserModelConfig
import com.k2fsa.sherpa.onnx.OfflineSpeakerDiarization
import com.k2fsa.sherpa.onnx.OfflineSpeakerDiarizationConfig
import com.k2fsa.sherpa.onnx.OfflineSpeakerDiarizationSegment
import com.k2fsa.sherpa.onnx.OfflineSpeakerSegmentationModelConfig
import com.k2fsa.sherpa.onnx.OfflineSpeakerSegmentationPyannoteModelConfig
import com.k2fsa.sherpa.onnx.OfflineStream
import com.k2fsa.sherpa.onnx.OfflineTransducerModelConfig
import com.k2fsa.sherpa.onnx.FastClusteringConfig
import com.k2fsa.sherpa.onnx.SpeakerEmbeddingExtractor
import com.k2fsa.sherpa.onnx.SpeakerEmbeddingExtractorConfig
import com.k2fsa.sherpa.onnx.SpeakerEmbeddingManager
import com.k2fsa.sherpa.onnx.TenVadModelConfig
import com.k2fsa.sherpa.onnx.Vad
import com.k2fsa.sherpa.onnx.VadModelConfig
import com.k2fsa.sherpa.onnx.WaveData
import com.k2fsa.sherpa.onnx.WaveReader
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.BufferedInputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.security.MessageDigest
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.UUID
import java.util.zip.ZipInputStream

class SherpaOnnxModule : Module() {
  private val executor: ExecutorService = Executors.newSingleThreadExecutor()
  private val wavRecordExecutor: ExecutorService = Executors.newSingleThreadExecutor()

  @Volatile
  private var wavRecordingRunning = false

  @Volatile
  private var wavAudioRecord: AudioRecord? = null

  @Volatile
  private var wavOutputFile: File? = null

  @Volatile
  private var wavSampleRate = DEFAULT_SAMPLE_RATE

  @Volatile
  private var wavWrittenBytes: Long = 0

  @Volatile
  private var wavStopLatch: CountDownLatch? = null

  private val wavLock = Any()
  private val offlineCacheLock = Any()

  @Volatile
  private var cachedOfflineRecognizer: OfflineRecognizer? = null

  @Volatile
  private var cachedOfflineRecognizerKey: String? = null

  override fun definition() = ModuleDefinition {
    Name("SherpaOnnx")

    OnDestroy {
      stopWavRecordingInternal()
      clearOfflineRecognizerCache()
      executor.shutdownNow()
      wavRecordExecutor.shutdownNow()
    }

    Function("hello") {
      "Sherpa ready"
    }

    Function("isWavRecording") {
      wavRecordingRunning
    }

    AsyncFunction("startWavRecording") { options: Map<String, Any?>?, promise: Promise ->
      synchronized(wavLock) {
        if (wavRecordingRunning) {
          promise.reject("ERR_WAV_RECORDING_ALREADY_RUNNING", "WAV recording is already running", null)
          return@AsyncFunction
        }

        try {
          val sampleRate = options?.getInt("sampleRate") ?: DEFAULT_SAMPLE_RATE
          val outputPath =
            options?.getString("path")?.removePrefix("file://")
              ?: run {
                val cacheDir =
                  appContext.reactContext?.cacheDir ?: throw IllegalStateException("React context is not available")
                File(cacheDir, "recording-${System.currentTimeMillis()}.wav").absolutePath
              }

          val outFile = File(outputPath)
          outFile.parentFile?.mkdirs()
          if (outFile.exists()) {
            outFile.delete()
          }

          val audioRecord = createAudioRecord(sampleRate)
          FileOutputStream(outFile).use { fos ->
            fos.write(ByteArray(WAV_HEADER_SIZE))
            fos.flush()
          }

          wavRecordingRunning = true
          wavAudioRecord = audioRecord
          wavOutputFile = outFile
          wavSampleRate = sampleRate
          wavWrittenBytes = 0
          wavStopLatch = CountDownLatch(1)

          wavRecordExecutor.execute {
            runWavRecordingLoop(outFile, audioRecord, sampleRate)
          }

          promise.resolve(
            mapOf(
              "path" to outFile.absolutePath,
              "sampleRate" to sampleRate,
            ),
          )
        } catch (e: Exception) {
          wavRecordingRunning = false
          wavAudioRecord?.release()
          wavAudioRecord = null
          wavOutputFile = null
          wavStopLatch = null
          promise.reject("ERR_WAV_RECORDING_START", e.message, e)
        }
      }
    }

    AsyncFunction("stopWavRecording") { promise: Promise ->
      val latch = wavStopLatch
      val outputFile = wavOutputFile
      val sampleRate = wavSampleRate

      stopWavRecordingInternal()

      if (latch != null) {
        latch.await(5, TimeUnit.SECONDS)
      }

      val path = outputFile?.absolutePath
      if (path.isNullOrBlank()) {
        promise.reject("ERR_WAV_RECORDING_STOP", "No WAV recording file found", null)
      } else {
        promise.resolve(
          mapOf(
            "path" to path,
            "sampleRate" to sampleRate,
            "numSamples" to (wavWrittenBytes / 2).toDouble(),
          ),
        )
      }
    }

    AsyncFunction("transcribeWav") { wavPath: String, options: Map<String, Any?>?, promise: Promise ->
      executor.execute {
        try {
          val cleanPath = wavPath.removePrefix("file://")
          val file = File(cleanPath)
          if (!file.exists()) {
            throw IllegalArgumentException("WAV file does not exist: $cleanPath")
          }

          val waveData = WaveReader.Companion.readWave(cleanPath)
          promise.resolve(transcribeWave(waveData, options))
        } catch (e: Exception) {
          promise.reject("ERR_SHERPA_TRANSCRIBE", e.message, e)
        }
      }
    }

    AsyncFunction("transcribeAssetWav") { wavAssetPath: String, options: Map<String, Any?>?, promise: Promise ->
      executor.execute {
        try {
          val assetManager =
            appContext.reactContext?.assets ?: throw IllegalStateException("React context is not available")
          val waveData = WaveReader.Companion.readWave(assetManager, wavAssetPath)
          promise.resolve(transcribeWave(waveData, options))
        } catch (e: Exception) {
          promise.reject("ERR_SHERPA_TRANSCRIBE_ASSET", e.message, e)
        }
      }
    }

    AsyncFunction("getFileSha256") { filePath: String, promise: Promise ->
      executor.execute {
        try {
          val cleanPath = filePath.removePrefix("file://")
          val file = File(cleanPath)
          if (!file.exists() || !file.isFile) {
            throw IllegalArgumentException("File does not exist: $cleanPath")
          }

          val digest = MessageDigest.getInstance("SHA-256")
          FileInputStream(file).use { fis ->
            val buffer = ByteArray(8192)
            var read = fis.read(buffer)
            while (read > 0) {
              digest.update(buffer, 0, read)
              read = fis.read(buffer)
            }
          }
          val sha256 = digest.digest().joinToString("") { "%02x".format(it) }
          promise.resolve(
            mapOf(
              "size" to file.length().toDouble(),
              "sha256" to sha256,
            ),
          )
        } catch (e: Exception) {
          promise.reject("ERR_SHERPA_SHA256", e.message, e)
        }
      }
    }

    AsyncFunction("unzipFile") { zipPath: String, destDir: String, promise: Promise ->
      executor.execute {
        try {
          val cleanZipPath = zipPath.removePrefix("file://")
          val cleanDestDir = destDir.removePrefix("file://")
          val zipFile = File(cleanZipPath)
          if (!zipFile.exists() || !zipFile.isFile) {
            throw IllegalArgumentException("Zip file does not exist: $cleanZipPath")
          }

          val destination = File(cleanDestDir)
          destination.mkdirs()

          val destCanonical = destination.canonicalPath + File.separator

          ZipInputStream(BufferedInputStream(FileInputStream(zipFile))).use { zis ->
            var entry = zis.nextEntry
            while (entry != null) {
              val outFile = File(destination, entry.name)
              val outCanonical = outFile.canonicalPath
              if (!outCanonical.startsWith(destCanonical)) {
                throw IllegalArgumentException("Invalid zip entry path: ${entry.name}")
              }

              if (entry.isDirectory) {
                outFile.mkdirs()
              } else {
                outFile.parentFile?.mkdirs()
                FileOutputStream(outFile).use { fos ->
                  val buffer = ByteArray(8192)
                  var read = zis.read(buffer)
                  while (read > 0) {
                    fos.write(buffer, 0, read)
                    read = zis.read(buffer)
                  }
                }
              }
              zis.closeEntry()
              entry = zis.nextEntry
            }
          }

          promise.resolve(
            mapOf(
              "ok" to true,
              "destDir" to destination.absolutePath,
            ),
          )
        } catch (e: Exception) {
          promise.reject("ERR_SHERPA_UNZIP", e.message, e)
        }
      }
    }

    AsyncFunction("copyAssetFile") { assetPath: String, destPath: String, promise: Promise ->
      executor.execute {
        try {
          val cleanDestPath = destPath.removePrefix("file://")
          val assetManager =
            appContext.reactContext?.assets ?: throw IllegalStateException("React context is not available")

          val outFile = File(cleanDestPath)
          outFile.parentFile?.mkdirs()

          val normalizedAssetPath = assetPath.trim().removePrefix("/")
          val candidateAssetPaths = buildAssetCandidates(normalizedAssetPath)

          var lastError: Exception? = null
          var copied = false

          for (candidate in candidateAssetPaths) {
            try {
              assetManager.open(candidate).use { input ->
                FileOutputStream(outFile).use { output ->
                  val buffer = ByteArray(8192)
                  var read = input.read(buffer)
                  while (read > 0) {
                    output.write(buffer, 0, read)
                    read = input.read(buffer)
                  }
                }
              }
              copied = true
              break
            } catch (e: Exception) {
              lastError = e
            }
          }

          if (!copied) {
            throw IllegalArgumentException(
              "Asset not found for '$assetPath'. Tried: ${candidateAssetPaths.joinToString()}",
              lastError,
            )
          }

          if (!outFile.exists() || outFile.length() <= 0L) {
            throw IllegalStateException("Copied asset is empty: ${outFile.absolutePath}")
          }

          promise.resolve(
            mapOf(
              "ok" to true,
              "destPath" to outFile.absolutePath,
            ),
          )
        } catch (e: Exception) {
          promise.reject("ERR_SHERPA_COPY_ASSET_FILE", e.message, e)
        }
      }
    }
  }

  private fun stopWavRecordingInternal() {
    wavRecordingRunning = false
    try {
      wavAudioRecord?.stop()
    } catch (_: Exception) {
    }
  }

  private fun runWavRecordingLoop(outputFile: File, audioRecord: AudioRecord, sampleRate: Int) {
    var localWrittenBytes = 0L
    try {
      audioRecord.startRecording()
      FileOutputStream(outputFile, true).use { fos ->
        val shortBuffer = ShortArray(DEFAULT_AUDIO_BUFFER_SAMPLES)
        val byteBuffer = ByteArray(DEFAULT_AUDIO_BUFFER_SAMPLES * 2)

        while (wavRecordingRunning) {
          val read = audioRecord.read(shortBuffer, 0, shortBuffer.size, AudioRecord.READ_BLOCKING)
          if (read <= 0) {
            continue
          }

          var offset = 0
          for (i in 0 until read) {
            val sample = shortBuffer[i].toInt()
            byteBuffer[offset] = (sample and 0xFF).toByte()
            byteBuffer[offset + 1] = ((sample shr 8) and 0xFF).toByte()
            offset += 2
          }
          fos.write(byteBuffer, 0, offset)
          localWrittenBytes += offset.toLong()
        }
        fos.flush()
      }
    } finally {
      try {
        audioRecord.stop()
      } catch (_: Exception) {
      }
      audioRecord.release()

      try {
        writeWavHeader(outputFile, localWrittenBytes, sampleRate)
      } catch (_: Exception) {
      }

      wavWrittenBytes = localWrittenBytes
      wavAudioRecord = null
      wavRecordingRunning = false
      wavStopLatch?.countDown()
    }
  }

  private fun writeWavHeader(file: File, pcmDataBytes: Long, sampleRate: Int) {
    val numChannels = 1
    val bitsPerSample = 16
    val byteRate = sampleRate * numChannels * bitsPerSample / 8
    val blockAlign = numChannels * bitsPerSample / 8
    val dataSize = pcmDataBytes.toInt()
    val riffChunkSize = 36 + dataSize

    RandomAccessFile(file, "rw").use { raf ->
      raf.seek(0)
      raf.writeBytes("RIFF")
      raf.write(intToLittleEndianBytes(riffChunkSize))
      raf.writeBytes("WAVE")
      raf.writeBytes("fmt ")
      raf.write(intToLittleEndianBytes(16))
      raf.write(shortToLittleEndianBytes(1))
      raf.write(shortToLittleEndianBytes(numChannels.toShort()))
      raf.write(intToLittleEndianBytes(sampleRate))
      raf.write(intToLittleEndianBytes(byteRate))
      raf.write(shortToLittleEndianBytes(blockAlign.toShort()))
      raf.write(shortToLittleEndianBytes(bitsPerSample.toShort()))
      raf.writeBytes("data")
      raf.write(intToLittleEndianBytes(dataSize))
    }
  }

  private fun intToLittleEndianBytes(value: Int): ByteArray {
    return byteArrayOf(
      (value and 0xFF).toByte(),
      ((value shr 8) and 0xFF).toByte(),
      ((value shr 16) and 0xFF).toByte(),
      ((value shr 24) and 0xFF).toByte(),
    )
  }

  private fun shortToLittleEndianBytes(value: Short): ByteArray {
    val v = value.toInt()
    return byteArrayOf(
      (v and 0xFF).toByte(),
      ((v shr 8) and 0xFF).toByte(),
    )
  }

  private fun resolveOfflineVadSegmentsRoot(): File {
    val context = appContext.reactContext ?: throw IllegalStateException("React context is not available")
    return File(context.filesDir, DEFAULT_OFFLINE_VAD_SEGMENTS_SUBDIR)
  }

  private fun createOfflineVadSessionDir(): File {
    val root = resolveOfflineVadSegmentsRoot()
    if (!root.exists()) {
      root.mkdirs()
    }
    if (!root.exists() || !root.isDirectory) {
      throw IllegalStateException("Unable to create offline VAD root directory: ${root.absolutePath}")
    }

    val sessionDir = File(root, "session-${System.currentTimeMillis()}-${UUID.randomUUID().toString().substring(0, 8)}")
    sessionDir.mkdirs()
    if (!sessionDir.exists() || !sessionDir.isDirectory) {
      throw IllegalStateException("Unable to create offline VAD session directory: ${sessionDir.absolutePath}")
    }
    return sessionDir
  }

  private fun writeFloatSamplesToWav(file: File, samples: FloatArray, sampleRate: Int) {
    file.parentFile?.mkdirs()
    if (file.exists()) {
      file.delete()
    }

    FileOutputStream(file).use { fos ->
      fos.write(ByteArray(WAV_HEADER_SIZE))
      val bytes = ByteArray(samples.size * 2)
      var offset = 0
      for (sample in samples) {
        val clamped = when {
          sample > 1f -> 1f
          sample < -1f -> -1f
          else -> sample
        }
        val pcm = (clamped * 32767f).toInt()
        bytes[offset] = (pcm and 0xFF).toByte()
        bytes[offset + 1] = ((pcm shr 8) and 0xFF).toByte()
        offset += 2
      }
      fos.write(bytes, 0, offset)
      fos.flush()
      fos.fd.sync()
    }
    writeWavHeader(file, samples.size.toLong() * 2L, sampleRate)
  }

  private fun createAudioRecord(sampleRate: Int): AudioRecord {
    val minBufferSize =
      AudioRecord.getMinBufferSize(
        sampleRate,
        AudioFormat.CHANNEL_IN_MONO,
        AudioFormat.ENCODING_PCM_16BIT,
      )
    if (minBufferSize <= 0) {
      throw IllegalStateException("Invalid AudioRecord min buffer size: $minBufferSize")
    }

    val bufferSizeBytes = maxOf(minBufferSize, sampleRate * 2 / 5)
    val record =
      AudioRecord(
        MediaRecorder.AudioSource.MIC,
        sampleRate,
        AudioFormat.CHANNEL_IN_MONO,
        AudioFormat.ENCODING_PCM_16BIT,
        bufferSizeBytes,
      )

    if (record.state != AudioRecord.STATE_INITIALIZED) {
      record.release()
      throw IllegalStateException("Failed to initialize AudioRecord")
    }
    return record
  }

  private fun resolveModelContext(options: Map<String, Any?>?): ModelContext {
    val modelDirAsset = options?.getString("modelDirAsset") ?: DEFAULT_MODEL_DIR_ASSET
    val modelDir = options?.getString("modelDir")
    val useFileModelDir = !modelDir.isNullOrBlank()
    val baseModelDir = if (useFileModelDir) modelDir!!.removePrefix("file://") else modelDirAsset

    val assetManager =
      if (useFileModelDir) {
        null
      } else {
        appContext.reactContext?.assets ?: throw IllegalStateException("React context is not available")
      }

    return ModelContext(useFileModelDir, baseModelDir, assetManager)
  }

  private data class ModelContext(
    val useFileModelDir: Boolean,
    val baseModelDir: String,
    val assetManager: android.content.res.AssetManager?,
  ) {
    fun resolveModelPath(name: String): String {
      val normalized = name.removePrefix("file://").trim()
      if (normalized.isEmpty()) {
        return normalized
      }

      return if (useFileModelDir) {
        val file = File(normalized)
        if (file.isAbsolute) {
          file.absolutePath
        } else {
          File(baseModelDir, normalized).absolutePath
        }
      } else {
        if (normalized.startsWith("sherpa/") || normalized.startsWith("models/")) {
          normalized
        } else {
          if (baseModelDir.endsWith("/")) "$baseModelDir$normalized" else "$baseModelDir/$normalized"
        }
      }
    }
  }

  private fun buildAssetCandidates(assetPath: String): List<String> {
    val normalizedAssetPath = assetPath.trim().removePrefix("/")
    val candidates = linkedSetOf<String>()
    candidates.add(normalizedAssetPath)
    candidates.add(normalizedAssetPath.removePrefix("assets/"))
    if (normalizedAssetPath.startsWith("sherpa/")) {
      candidates.add(normalizedAssetPath.removePrefix("sherpa/"))
    }
    if (normalizedAssetPath.startsWith("sherpa/asr/")) {
      candidates.add(normalizedAssetPath.removePrefix("sherpa/"))
      candidates.add(normalizedAssetPath.removePrefix("sherpa/asr/"))
      candidates.add("asr/${normalizedAssetPath.removePrefix("sherpa/asr/")}")
    }
    return candidates.toList()
  }

  private fun assetExists(assetManager: AssetManager?, assetPath: String): Boolean {
    if (assetManager == null) {
      return false
    }
    for (candidate in buildAssetCandidates(assetPath)) {
      try {
        assetManager.open(candidate).use { _ -> }
        return true
      } catch (_: Exception) {
      }
    }
    return false
  }

  private fun ensureModelPathReadable(modelContext: ModelContext, resolvedPath: String, label: String) {
    if (resolvedPath.isBlank()) {
      throw IllegalArgumentException("Model path is empty: $label")
    }
    if (modelContext.useFileModelDir) {
      val file = File(resolvedPath)
      if (!file.exists() || !file.isFile || file.length() <= 0L) {
        throw IllegalArgumentException("Model file missing or invalid: $label -> $resolvedPath")
      }
      return
    }
    if (!assetExists(modelContext.assetManager, resolvedPath)) {
      throw IllegalArgumentException("Model asset missing: $label -> $resolvedPath")
    }
  }

  private fun ensureAnyModelPathReadable(modelContext: ModelContext, resolvedPaths: List<String>, label: String) {
    val normalized = resolvedPaths.filter { it.isNotBlank() }
    if (normalized.isEmpty()) {
      throw IllegalArgumentException("Model path is empty: $label")
    }
    val issues = mutableListOf<String>()
    for (path in normalized) {
      try {
        ensureModelPathReadable(modelContext, path, label)
        return
      } catch (e: Exception) {
        issues.add("${e.message ?: path}")
      }
    }
    throw IllegalArgumentException("No readable model path for $label: ${issues.joinToString("; ")}")
  }

  private fun resolveVadModelPath(modelContext: ModelContext, vadModel: String?): String {
    if (!vadModel.isNullOrBlank()) {
      return modelContext.resolveModelPath(vadModel)
    }

    if (!modelContext.useFileModelDir) {
      return modelContext.resolveModelPath(DEFAULT_VAD_MODEL_ASSET)
    }

    val context = appContext.reactContext ?: throw IllegalStateException("React context is not available")
    val defaultVadDir = File(context.filesDir, DEFAULT_RUNTIME_VAD_SUBDIR)
    if (!defaultVadDir.exists()) {
      defaultVadDir.mkdirs()
    }
    if (!defaultVadDir.exists() || !defaultVadDir.isDirectory) {
      throw IllegalStateException("Unable to create runtime VAD directory: ${defaultVadDir.absolutePath}")
    }

    val fileName = DEFAULT_VAD_MODEL_ASSET.substringAfterLast("/")
    val destFile = File(defaultVadDir, fileName)
    if (destFile.exists() && destFile.isFile && destFile.length() > 0L) {
      return destFile.absolutePath
    }

    val assetManager = context.assets
    var copied = false
    var lastError: Exception? = null
    for (candidate in buildAssetCandidates(DEFAULT_VAD_MODEL_ASSET)) {
      try {
        assetManager.open(candidate).use { input ->
          FileOutputStream(destFile).use { output ->
            val buffer = ByteArray(8192)
            var read = input.read(buffer)
            while (read > 0) {
              output.write(buffer, 0, read)
              read = input.read(buffer)
            }
            output.flush()
          }
        }
        copied = true
        break
      } catch (e: Exception) {
        lastError = e
      }
    }

    if (!copied) {
      throw IllegalArgumentException("Default VAD asset not found: $DEFAULT_VAD_MODEL_ASSET", lastError)
    }
    if (!destFile.exists() || !destFile.isFile || destFile.length() <= 0L) {
      throw IllegalStateException("Copied default VAD file is invalid: ${destFile.absolutePath}")
    }
    return destFile.absolutePath
  }

  private fun transcribeWave(waveData: WaveData, options: Map<String, Any?>?): Map<String, Any?> {
    val modelContext = resolveModelContext(options)

    val modelType = options?.getString("modelType") ?: "transducer"
    val encoder = options?.getString("encoder") ?: "encoder.onnx"
    val decoder = options?.getString("decoder") ?: "decoder.onnx"
    val joiner = options?.getString("joiner") ?: "joiner.onnx"
    val preprocessor = options?.getString("preprocessor") ?: ""
    val uncachedDecoder = options?.getString("uncachedDecoder") ?: ""
    val cachedDecoder = options?.getString("cachedDecoder") ?: ""
    val mergedDecoder = options?.getString("mergedDecoder") ?: "decoder_model_merged.ort"
    val encoderAdaptor = options?.getString("encoderAdaptor") ?: "encoder_adaptor.onnx"
    val llm = options?.getString("llm") ?: "llm.onnx"
    val embedding = options?.getString("embedding") ?: "embedding.onnx"
    val tokenizer = options?.getString("tokenizer") ?: "Qwen3-0.6B"
    val tokens = options?.getString("tokens")

    val sampleRate = options?.getInt("sampleRate") ?: DEFAULT_SAMPLE_RATE
    val featureDim = options?.getInt("featureDim") ?: DEFAULT_FEATURE_DIM
    val numThreads = options?.getInt("numThreads") ?: DEFAULT_NUM_THREADS
    val provider = options?.getString("provider") ?: "cpu"
    val debug = options?.getBoolean("debug") ?: false
    val denoiseModel = options?.getString("denoiseModel")
    val enableDenoise = options?.getBoolean("enableDenoise") ?: !denoiseModel.isNullOrBlank()
    val punctuationModel = options?.getString("punctuationModel")
    val enablePunctuation = options?.getBoolean("enablePunctuation") ?: !punctuationModel.isNullOrBlank()
    val decodingMethod = options?.getString("decodingMethod") ?: "greedy_search"
    val maxActivePaths = options?.getInt("maxActivePaths") ?: 4
    val blankPenalty = options?.getFloat("blankPenalty") ?: 0f
    val vadModel = options?.getString("vadModel")
    val enableVad = options?.getBoolean("enableVad") ?: !vadModel.isNullOrBlank()
    val enableSpeakerDiarization = options?.getBoolean("enableSpeakerDiarization") ?: false

    var resolvedTokensPath = ""
    var resolvedEncoderPath = ""
    var resolvedDecoderPath = ""
    var resolvedJoinerPath = ""
    var resolvedMoonshinePreprocessorPath = ""
    var resolvedMoonshineEncoderPath = ""
    var resolvedMoonshineUncachedDecoderPath = ""
    var resolvedMoonshineCachedDecoderPath = ""
    var resolvedMoonshineMergedDecoderPath = ""
    var resolvedEncoderAdaptorPath = ""
    var resolvedLlmPath = ""
    var resolvedEmbeddingPath = ""
    var resolvedTokenizerDirPath = ""

    val modelConfig = OfflineModelConfig().apply {
      resolvedTokensPath =
        if (!tokens.isNullOrBlank()) {
          modelContext.resolveModelPath(tokens)
        } else if (modelType == "funasr_nano") {
          ""
        } else {
          modelContext.resolveModelPath("tokens.txt")
        }
      this.tokens = resolvedTokensPath
      this.numThreads = numThreads
      this.provider = provider
      this.debug = debug
      this.modelType = modelType
    }

    when (modelType) {
      "transducer" -> {
        resolvedEncoderPath = modelContext.resolveModelPath(encoder)
        resolvedDecoderPath = modelContext.resolveModelPath(decoder)
        resolvedJoinerPath = modelContext.resolveModelPath(joiner)
        modelConfig.transducer =
          OfflineTransducerModelConfig(
            resolvedEncoderPath,
            resolvedDecoderPath,
            resolvedJoinerPath,
          )
      }
      "moonshine" -> {
        resolvedMoonshinePreprocessorPath = if (preprocessor.isNotBlank()) modelContext.resolveModelPath(preprocessor) else ""
        resolvedMoonshineEncoderPath = modelContext.resolveModelPath(encoder)
        resolvedMoonshineUncachedDecoderPath = if (uncachedDecoder.isNotBlank()) modelContext.resolveModelPath(uncachedDecoder) else ""
        resolvedMoonshineCachedDecoderPath = if (cachedDecoder.isNotBlank()) modelContext.resolveModelPath(cachedDecoder) else ""
        resolvedMoonshineMergedDecoderPath = modelContext.resolveModelPath(mergedDecoder)
        modelConfig.moonshine = OfflineMoonshineModelConfig().apply {
          this.preprocessor = resolvedMoonshinePreprocessorPath
          this.encoder = resolvedMoonshineEncoderPath
          this.uncachedDecoder = resolvedMoonshineUncachedDecoderPath
          this.cachedDecoder = resolvedMoonshineCachedDecoderPath
          this.mergedDecoder = resolvedMoonshineMergedDecoderPath
        }
        modelConfig.modelType = "moonshine"
      }
      "funasr_nano" -> {
        val tokenizerDir =
          if (tokenizer.endsWith(".json")) {
            File(tokenizer).parent ?: tokenizer
          } else {
            tokenizer
          }
        resolvedEncoderAdaptorPath = modelContext.resolveModelPath(encoderAdaptor)
        resolvedLlmPath = modelContext.resolveModelPath(llm)
        resolvedEmbeddingPath = modelContext.resolveModelPath(embedding)
        resolvedTokenizerDirPath = modelContext.resolveModelPath(tokenizerDir)
        modelConfig.funasrNano = OfflineFunAsrNanoModelConfig().apply {
          this.encoderAdaptor = resolvedEncoderAdaptorPath
          this.llm = resolvedLlmPath
          this.embedding = resolvedEmbeddingPath
          this.tokenizer = resolvedTokenizerDirPath
        }
        modelConfig.modelType = "funasr_nano"
      }
      else -> {
        throw IllegalArgumentException("Unsupported modelType: $modelType")
      }
    }

    when (modelType) {
      "transducer" -> {
        ensureModelPathReadable(modelContext, resolvedTokensPath, "tokens")
        ensureModelPathReadable(modelContext, resolvedEncoderPath, "encoder")
        ensureModelPathReadable(modelContext, resolvedDecoderPath, "decoder")
        ensureModelPathReadable(modelContext, resolvedJoinerPath, "joiner")
      }
      "moonshine" -> {
        ensureModelPathReadable(modelContext, resolvedTokensPath, "tokens")
        ensureModelPathReadable(modelContext, resolvedMoonshineEncoderPath, "encoder")
        if (
          resolvedMoonshineMergedDecoderPath.isBlank() &&
          resolvedMoonshineUncachedDecoderPath.isBlank() &&
          resolvedMoonshineCachedDecoderPath.isBlank()
        ) {
          throw IllegalArgumentException("Moonshine decoder path is empty")
        }
        ensureAnyModelPathReadable(
          modelContext,
          listOf(
            resolvedMoonshineMergedDecoderPath,
            resolvedMoonshineUncachedDecoderPath,
            resolvedMoonshineCachedDecoderPath,
          ),
          "moonshineDecoder",
        )
      }
      "funasr_nano" -> {
        ensureModelPathReadable(modelContext, resolvedEncoderAdaptorPath, "encoderAdaptor")
        ensureModelPathReadable(modelContext, resolvedLlmPath, "llm")
        ensureModelPathReadable(modelContext, resolvedEmbeddingPath, "embedding")
        ensureModelPathReadable(modelContext, "$resolvedTokenizerDirPath/tokenizer.json", "tokenizer")
      }
    }

    val recognizerConfig = OfflineRecognizerConfig().apply {
      this.featConfig = FeatureConfig(sampleRate, featureDim, 0f)
      this.modelConfig = modelConfig
      this.decodingMethod = decodingMethod
      this.maxActivePaths = maxActivePaths
      this.blankPenalty = blankPenalty
    }

    var recognizer: OfflineRecognizer? = null
    var denoiser: OfflineSpeechDenoiser? = null
    var punctuation: OfflinePunctuation? = null
    var vad: Vad? = null
    var speakerDiarization: OfflineSpeakerDiarization? = null
    var stream: OfflineStream? = null
    var resultMap = mutableMapOf<String, Any?>()
    try {
      val recognizerKey =
        buildOfflineRecognizerCacheKey(
          modelContext = modelContext,
          modelType = modelType,
          sampleRate = sampleRate,
          featureDim = featureDim,
          numThreads = numThreads,
          provider = provider,
          debug = debug,
          decodingMethod = decodingMethod,
          maxActivePaths = maxActivePaths,
          blankPenalty = blankPenalty,
          tokensPath = resolvedTokensPath,
          encoderPath = resolvedEncoderPath,
          decoderPath = resolvedDecoderPath,
          joinerPath = resolvedJoinerPath,
          moonshinePreprocessorPath = resolvedMoonshinePreprocessorPath,
          moonshineEncoderPath = resolvedMoonshineEncoderPath,
          moonshineUncachedDecoderPath = resolvedMoonshineUncachedDecoderPath,
          moonshineCachedDecoderPath = resolvedMoonshineCachedDecoderPath,
          moonshineMergedDecoderPath = resolvedMoonshineMergedDecoderPath,
          encoderAdaptorPath = resolvedEncoderAdaptorPath,
          llmPath = resolvedLlmPath,
          embeddingPath = resolvedEmbeddingPath,
          tokenizerDirPath = resolvedTokenizerDirPath,
        )
      recognizer = acquireOfflineRecognizer(recognizerKey, modelContext.assetManager, recognizerConfig)

      if (enableSpeakerDiarization) {
        speakerDiarization = createOfflineSpeakerDiarization(modelContext, options, numThreads, provider, debug)
      }
      if (enablePunctuation && !punctuationModel.isNullOrBlank()) {
        punctuation = createOfflinePunctuation(modelContext, punctuationModel, numThreads, provider, debug)
      }
      if (enableVad) {
        try {
          val vadModelPath = resolveVadModelPath(modelContext, vadModel)
          val normalizedVadPath = vadModelPath.lowercase()
          val useTenVad = normalizedVadPath.contains("ten-vad")
          if (!useTenVad) {
            println("[sherpa] Unsupported offline VAD model file: $vadModelPath. Fallback without VAD.")
          } else {
            val vadThreshold = options?.getFloat("vadThreshold") ?: 0.25f
            val vadMinSilenceDuration = options?.getFloat("vadMinSilenceDuration") ?: 0.5f
            val vadMinSpeechDuration = options?.getFloat("vadMinSpeechDuration") ?: 0.5f
            val vadWindowSize = options?.getInt("vadWindowSize") ?: 256
            val vadMaxSpeechDuration = options?.getFloat("vadMaxSpeechDuration") ?: 6.0f
            val vadModelConfig = VadModelConfig().apply {
              this.sampleRate = sampleRate
              this.numThreads = numThreads
              this.provider = provider
              this.debug = debug
              this.tenVadModelConfig = TenVadModelConfig().apply {
                this.model = vadModelPath
                this.threshold = vadThreshold
                this.minSilenceDuration = vadMinSilenceDuration
                this.minSpeechDuration = vadMinSpeechDuration
                this.windowSize = vadWindowSize
                this.maxSpeechDuration = vadMaxSpeechDuration
              }
            }
            vad = Vad(modelContext.assetManager, vadModelConfig)
          }
        } catch (e: Exception) {
          println("[sherpa] Offline VAD initialization failed. fallback without VAD: ${e.message}")
          vad = null
        }
      }

      val effectiveWaveData =
        if (enableDenoise && !denoiseModel.isNullOrBlank()) {
          denoiser = createOfflineSpeechDenoiser(modelContext, denoiseModel, numThreads, provider, debug)
          val denoised = denoiser.run(waveData.samples, waveData.sampleRate)
          WaveData(denoised.samples, denoised.sampleRate)
        } else {
          waveData
        }

      stream = recognizer.createStream()

      if (vad != null) {
        val vadSegments = mutableListOf<Map<String, Any?>>()
        val sampleRateForVad = effectiveWaveData.sampleRate
        var segmentIndex = 0
        val offlineVadSessionDir =
          try {
            createOfflineVadSessionDir()
          } catch (_: Exception) {
            null
          }
        val decodeSegmentWithVad: (FloatArray) -> Unit = { segmentSamples ->
          segmentIndex += 1
          val segmentFile = offlineVadSessionDir?.let { File(it, "seg-${segmentIndex.toString().padStart(6, '0')}.wav") }
          try {
            if (segmentFile != null) {
              writeFloatSamplesToWav(segmentFile, segmentSamples, sampleRateForVad)
            }
          } catch (_: Exception) {
          }
          vadSegments.add(
            mapOf(
              "index" to segmentIndex,
              "path" to (segmentFile?.absolutePath ?: ""),
              "text" to "",
              "numSamples" to segmentSamples.size,
              "durationMs" to ((segmentSamples.size.toDouble() / sampleRateForVad.toDouble()) * 1000.0),
            ),
          )
        }

        val allSamples = effectiveWaveData.samples
        var chunkStart = 0
        while (chunkStart < allSamples.size) {
          val chunkEnd = minOf(chunkStart + DEFAULT_AUDIO_BUFFER_SAMPLES, allSamples.size)
          val chunk = allSamples.copyOfRange(chunkStart, chunkEnd)
          vad.acceptWaveform(chunk)
          while (!vad.empty()) {
            val segment = vad.front()
            vad.pop()
            decodeSegmentWithVad(segment.samples)
          }
          chunkStart = chunkEnd
        }
        vad.flush()
        while (!vad.empty()) {
          val segment = vad.front()
          vad.pop()
          decodeSegmentWithVad(segment.samples)
        }

        stream.acceptWaveform(effectiveWaveData.samples, effectiveWaveData.sampleRate)
        recognizer.decode(stream)
        val result = recognizer.getResult(stream)
        resultMap = result.toMap(effectiveWaveData).toMutableMap()
        if (speakerDiarization != null && result.text.isNotBlank()) {
          val speakerSegments = speakerDiarization.process(effectiveWaveData.samples)
          val speakerText = formatOfflineResultBySpeaker(recognizer, effectiveWaveData, speakerSegments)
          if (speakerText.isNotBlank()) {
            resultMap["text"] = speakerText
          }
        }
        val rawText = resultMap["text"] as? String
        if (!rawText.isNullOrBlank()) {
          resultMap["text"] = applyPunctuation(punctuation, rawText)
        }
        resultMap["vadSegments"] = vadSegments
      } else {
        stream.acceptWaveform(effectiveWaveData.samples, effectiveWaveData.sampleRate)

        recognizer.decode(stream)

        val result = recognizer.getResult(stream)

        resultMap = result.toMap(effectiveWaveData).toMutableMap()
        if (speakerDiarization != null && result.text.isNotBlank()) {
          val speakerSegments = speakerDiarization.process(effectiveWaveData.samples)

          val speakerText = formatOfflineResultBySpeaker(recognizer, effectiveWaveData, speakerSegments)
          if (speakerText.isNotBlank()) {
            resultMap["text"] = speakerText
          }
        }
        val rawText = resultMap["text"] as? String
        if (!rawText.isNullOrBlank()) {
          resultMap["text"] = applyPunctuation(punctuation, rawText)
        }
      }
    } finally {
      stream?.release()
      denoiser?.release()
      punctuation?.release()
      vad?.release()
      speakerDiarization?.release()
    }

    return resultMap
  }

  private fun acquireOfflineRecognizer(
    key: String,
    assetManager: android.content.res.AssetManager?,
    config: OfflineRecognizerConfig,
  ): OfflineRecognizer {
    synchronized(offlineCacheLock) {
      val cached = cachedOfflineRecognizer
      if (cached != null && cachedOfflineRecognizerKey == key) {
        return cached
      }

      cachedOfflineRecognizer?.release()
      cachedOfflineRecognizer = null
      cachedOfflineRecognizerKey = null

      val created = OfflineRecognizer(assetManager, config)
      cachedOfflineRecognizer = created
      cachedOfflineRecognizerKey = key
      return created
    }
  }

  private fun clearOfflineRecognizerCache() {
    synchronized(offlineCacheLock) {
      cachedOfflineRecognizer?.release()
      cachedOfflineRecognizer = null
      cachedOfflineRecognizerKey = null
    }
  }

  private fun buildOfflineRecognizerCacheKey(
    modelContext: ModelContext,
    modelType: String,
    sampleRate: Int,
    featureDim: Int,
    numThreads: Int,
    provider: String,
    debug: Boolean,
    decodingMethod: String,
    maxActivePaths: Int,
    blankPenalty: Float,
    tokensPath: String,
    encoderPath: String,
    decoderPath: String,
    joinerPath: String,
    moonshinePreprocessorPath: String,
    moonshineEncoderPath: String,
    moonshineUncachedDecoderPath: String,
    moonshineCachedDecoderPath: String,
    moonshineMergedDecoderPath: String,
    encoderAdaptorPath: String,
    llmPath: String,
    embeddingPath: String,
    tokenizerDirPath: String,
  ): String {
    return listOf(
      "ctxMode=${modelContext.useFileModelDir}",
      "ctxBase=${modelContext.baseModelDir}",
      "type=$modelType",
      "sampleRate=$sampleRate",
      "featureDim=$featureDim",
      "numThreads=$numThreads",
      "provider=$provider",
      "debug=$debug",
      "decodingMethod=$decodingMethod",
      "maxActivePaths=$maxActivePaths",
      "blankPenalty=$blankPenalty",
      "tokens=$tokensPath",
      "encoder=$encoderPath",
      "decoder=$decoderPath",
      "joiner=$joinerPath",
      "moonshinePreprocessor=$moonshinePreprocessorPath",
      "moonshineEncoder=$moonshineEncoderPath",
      "moonshineUncachedDecoder=$moonshineUncachedDecoderPath",
      "moonshineCachedDecoder=$moonshineCachedDecoderPath",
      "moonshineMergedDecoder=$moonshineMergedDecoderPath",
      "encoderAdaptor=$encoderAdaptorPath",
      "llm=$llmPath",
      "embedding=$embeddingPath",
      "tokenizerDir=$tokenizerDirPath",
    ).joinToString("|")
  }

  private fun createOfflineSpeechDenoiser(
    modelContext: ModelContext,
    denoiseModel: String,
    numThreads: Int,
    provider: String,
    debug: Boolean,
  ): OfflineSpeechDenoiser {
    val config =
      OfflineSpeechDenoiserConfig(
        OfflineSpeechDenoiserModelConfig(
          OfflineSpeechDenoiserGtcrnModelConfig(modelContext.resolveModelPath(denoiseModel)),
          numThreads,
          debug,
          provider,
        ),
      )
    return OfflineSpeechDenoiser(modelContext.assetManager, config)
  }

  private fun createOfflinePunctuation(
    modelContext: ModelContext,
    punctuationModel: String,
    numThreads: Int,
    provider: String,
    debug: Boolean,
  ): OfflinePunctuation {
    val config =
      OfflinePunctuationConfig(
        OfflinePunctuationModelConfig(
          modelContext.resolveModelPath(punctuationModel),
          numThreads,
          debug,
          provider,
        ),
      )
    return OfflinePunctuation(modelContext.assetManager, config)
  }

  private fun applyPunctuation(punctuation: OfflinePunctuation?, text: String): String {
    if (punctuation == null || text.isBlank()) {
      return text
    }
    return try {
      punctuation.addPunctuation(text)
    } catch (_: Exception) {
      text
    }
  }

  private fun createOfflineSpeakerDiarization(
    modelContext: ModelContext,
    options: Map<String, Any?>?,
    numThreads: Int,
    provider: String,
    debug: Boolean,
  ): OfflineSpeakerDiarization {
    val segmentationModel =
      options?.getString("speakerSegmentationModel")
        ?: DEFAULT_SPEAKER_SEGMENTATION_MODEL_ASSET
    val embeddingModel =
      options?.getString("speakerEmbeddingModel")
        ?: DEFAULT_SPEAKER_EMBEDDING_MODEL_ASSET
    val minDurationOn = options?.getFloat("speakerMinDurationOn") ?: 0.3f
    val minDurationOff = options?.getFloat("speakerMinDurationOff") ?: 0.3f
    val numClusters = options?.getInt("speakerNumClusters") ?: -1
    val clusteringThreshold = options?.getFloat("speakerClusteringThreshold") ?: 0.5f

    val config =
      OfflineSpeakerDiarizationConfig(
        OfflineSpeakerSegmentationModelConfig(
          OfflineSpeakerSegmentationPyannoteModelConfig(modelContext.resolveModelPath(segmentationModel)),
          numThreads,
          debug,
          provider,
        ),
        SpeakerEmbeddingExtractorConfig(
          modelContext.resolveModelPath(embeddingModel),
          numThreads,
          debug,
          provider,
        ),
        FastClusteringConfig(numClusters, clusteringThreshold),
        minDurationOn,
        minDurationOff,
      )

    return OfflineSpeakerDiarization(modelContext.assetManager, config)
  }

  private data class SpeakerChunk(
    val speaker: String,
    val text: String,
  )

  private fun formatOfflineResultBySpeaker(
    recognizer: OfflineRecognizer,
    waveData: WaveData,
    segments: Array<OfflineSpeakerDiarizationSegment>,
  ): String {
    if (segments.isEmpty()) {
      return ""
    }

    val sortedSegments = segments.sortedBy { it.start }
    val chunks = mutableListOf<SpeakerChunk>()
    val sampleRate = waveData.sampleRate
    for (segment in sortedSegments) {
      val startIndex = (segment.start * sampleRate).toInt().coerceAtLeast(0)
      val endIndex = (segment.end * sampleRate).toInt().coerceAtMost(waveData.samples.size)
      if (endIndex <= startIndex) {
        continue
      }
      val subSamples = waveData.samples.copyOfRange(startIndex, endIndex)
      if (subSamples.isEmpty()) {
        continue
      }

      var subStream: OfflineStream? = null
      try {
        subStream = recognizer.createStream()
        subStream.acceptWaveform(subSamples, sampleRate)
        recognizer.decode(subStream)
        val text = recognizer.getResult(subStream).text.trim()
        if (text.isBlank()) {
          continue
        }
        val speakerName = speakerLabel(segment.speaker)
        if (chunks.isNotEmpty() && chunks.last().speaker == speakerName) {
          val merged = mergePieceText(chunks.last().text, text)
          chunks[chunks.lastIndex] = SpeakerChunk(speakerName, merged)
        } else {
          chunks.add(SpeakerChunk(speakerName, text))
        }
      } finally {
        subStream?.release()
      }
    }

    return formatSpeakerChunks(chunks)
  }

  private fun formatSpeakerChunks(chunks: List<SpeakerChunk>): String {
    if (chunks.isEmpty()) {
      return ""
    }
    return chunks
      .filter { it.text.isNotBlank() }
      .joinToString("\n") { "${it.speaker}: ${it.text}" }
  }

  private fun speakerLabel(speaker: Int): String {
    if (speaker in 0..25) {
      val suffix = ('A'.code + speaker).toChar()
      return "speaker$suffix"
    }
    return "speaker${speaker + 1}"
  }

  private fun mergePieceText(left: String, right: String): String {
    if (left.isBlank()) return right
    if (right.isBlank()) return left
    val leftLast = left.last()
    val rightFirst = right.first()
    val needsSpace = leftLast.isLetterOrDigit() && rightFirst.isLetterOrDigit()
    return if (needsSpace) "$left $right" else "$left$right"
  }

  private fun OfflineRecognizerResult.toMap(waveData: WaveData): Map<String, Any?> {
    return mapOf(
      "text" to text,
      "tokens" to tokens.toList(),
      "timestamps" to timestamps.map { it.toDouble() },
      "durations" to durations.map { it.toDouble() },
      "lang" to lang,
      "emotion" to emotion,
      "event" to event,
      "sampleRate" to waveData.sampleRate,
      "numSamples" to waveData.samples.size,
    )
  }

  private fun Map<String, Any?>.getString(key: String): String? {
    return this[key] as? String
  }

  private fun Map<String, Any?>.getBoolean(key: String): Boolean? {
    return this[key] as? Boolean
  }

  private fun Map<String, Any?>.getInt(key: String): Int? {
    val value = this[key]
    return when (value) {
      is Int -> value
      is Double -> value.toInt()
      is Float -> value.toInt()
      else -> null
    }
  }

  private fun Map<String, Any?>.getFloat(key: String): Float? {
    val value = this[key]
    return when (value) {
      is Float -> value
      is Double -> value.toFloat()
      is Int -> value.toFloat()
      else -> null
    }
  }

  companion object {
    private const val DEFAULT_MODEL_DIR_ASSET = "sherpa/asr/zh"
    private const val DEFAULT_SAMPLE_RATE = 16000
    private const val DEFAULT_FEATURE_DIM = 80
    private const val DEFAULT_NUM_THREADS = 2
    private const val DEFAULT_AUDIO_BUFFER_SAMPLES = 512
    private const val WAV_HEADER_SIZE = 44
    private const val DEFAULT_VAD_MODEL_ASSET = "sherpa/onnx/ten-vad.onnx"
    private const val DEFAULT_RUNTIME_VAD_SUBDIR = "sherpa/vad"
    private const val DEFAULT_OFFLINE_VAD_SEGMENTS_SUBDIR = "sherpa/offline-vad-segments"
    private const val DEFAULT_SPEAKER_SEGMENTATION_MODEL_ASSET = "sherpa/onnx/speaker-diarization.onnx"
    private const val DEFAULT_SPEAKER_EMBEDDING_MODEL_ASSET = "sherpa/onnx/speaker-recognition.onnx"
  }
}
