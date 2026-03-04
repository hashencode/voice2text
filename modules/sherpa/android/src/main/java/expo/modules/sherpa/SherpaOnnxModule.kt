package expo.modules.sherpa

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import com.k2fsa.sherpa.onnx.FeatureConfig
import com.k2fsa.sherpa.onnx.OfflineModelConfig
import com.k2fsa.sherpa.onnx.OfflineParaformerModelConfig
import com.k2fsa.sherpa.onnx.OfflineRecognizer
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig
import com.k2fsa.sherpa.onnx.OfflineRecognizerResult
import com.k2fsa.sherpa.onnx.OfflineStream
import com.k2fsa.sherpa.onnx.OfflineTransducerModelConfig
import com.k2fsa.sherpa.onnx.OfflineZipformerCtcModelConfig
import com.k2fsa.sherpa.onnx.OnlineModelConfig
import com.k2fsa.sherpa.onnx.OnlineParaformerModelConfig
import com.k2fsa.sherpa.onnx.OnlineRecognizer
import com.k2fsa.sherpa.onnx.OnlineRecognizerConfig
import com.k2fsa.sherpa.onnx.OnlineRecognizerResult
import com.k2fsa.sherpa.onnx.OnlineStream
import com.k2fsa.sherpa.onnx.OnlineTransducerModelConfig
import com.k2fsa.sherpa.onnx.OnlineZipformer2CtcModelConfig
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
import java.util.zip.ZipInputStream

class SherpaOnnxModule : Module() {
  private val executor: ExecutorService = Executors.newSingleThreadExecutor()
  private val realtimeExecutor: ExecutorService = Executors.newSingleThreadExecutor()
  private val wavRecordExecutor: ExecutorService = Executors.newSingleThreadExecutor()

  @Volatile
  private var realtimeRunning = false

  @Volatile
  private var realtimeAudioRecord: AudioRecord? = null

  @Volatile
  private var realtimeRecognizer: OnlineRecognizer? = null

  @Volatile
  private var realtimeStream: OnlineStream? = null

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

  private val realtimeLock = Any()
  private val wavLock = Any()

  override fun definition() = ModuleDefinition {
    Name("SherpaOnnx")
    Events(REALTIME_EVENT_NAME, REALTIME_STATE_EVENT_NAME)

    OnDestroy {
      stopRealtimeInternal()
      stopWavRecordingInternal()
      executor.shutdownNow()
      realtimeExecutor.shutdownNow()
      wavRecordExecutor.shutdownNow()
    }

    Function("hello") {
      "Sherpa ready"
    }

    Function("isRealtimeTranscribing") {
      realtimeRunning
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

    AsyncFunction("startRealtimeTranscription") { options: Map<String, Any?>?, promise: Promise ->
      synchronized(realtimeLock) {
        if (realtimeRunning) {
          promise.reject("ERR_SHERPA_REALTIME_ALREADY_RUNNING", "Realtime transcription is already running", null)
          return@AsyncFunction
        }
        realtimeRunning = true
      }

      val effectiveOptions = options ?: emptyMap()
      realtimeExecutor.execute {
        runRealtimeTranscription(effectiveOptions)
      }
      promise.resolve(mapOf("started" to true))
    }

    AsyncFunction("stopRealtimeTranscription") { promise: Promise ->
      val wasRunning = realtimeRunning
      stopRealtimeInternal()
      promise.resolve(
        mapOf(
          "stopped" to wasRunning,
        ),
      )
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
          val result = transcribeWave(waveData, options)
          promise.resolve(result)
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
          val result = transcribeWave(waveData, options)
          promise.resolve(result)
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

          assetManager.open(assetPath).use { input ->
            FileOutputStream(outFile).use { output ->
              val buffer = ByteArray(8192)
              var read = input.read(buffer)
              while (read > 0) {
                output.write(buffer, 0, read)
                read = input.read(buffer)
              }
            }
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

  private fun runRealtimeTranscription(options: Map<String, Any?>) {
    var recognizer: OnlineRecognizer? = null
    var stream: OnlineStream? = null
    var audioRecord: AudioRecord? = null
    var lastText = ""

    try {
      sendRealtimeState("starting")

      val modelContext = resolveModelContext(options)
      val modelType = options.getString("modelType") ?: "transducer"
      val sampleRate = options.getInt("sampleRate") ?: DEFAULT_SAMPLE_RATE
      val featureDim = options.getInt("featureDim") ?: DEFAULT_FEATURE_DIM
      val numThreads = options.getInt("numThreads") ?: DEFAULT_NUM_THREADS
      val provider = options.getString("provider") ?: "cpu"
      val debug = options.getBoolean("debug") ?: false
      val decodingMethod = options.getString("decodingMethod") ?: "greedy_search"
      val maxActivePaths = options.getInt("maxActivePaths") ?: 4
      val blankPenalty = options.getFloat("blankPenalty") ?: 0f
      val emitIntervalMs = options.getInt("emitIntervalMs") ?: DEFAULT_EMIT_INTERVAL_MS
      val enableEndpoint = options.getBoolean("enableEndpoint") ?: false

      val modelConfig = OnlineModelConfig().apply {
        val tokens = options.getString("tokens")
        this.tokens =
          if (!tokens.isNullOrBlank()) {
            modelContext.resolveModelPath(tokens)
          } else if (modelType == "paraformer") {
            ""
          } else {
            modelContext.resolveModelPath("tokens.txt")
          }
        this.numThreads = numThreads
        this.provider = provider
        this.debug = debug
        when (modelType) {
          "transducer", "zipformer", "zipformer2" -> {
            this.modelType = "transducer"
            this.transducer = OnlineTransducerModelConfig(
              modelContext.resolveModelPath(options.getString("encoder") ?: "encoder.onnx"),
              modelContext.resolveModelPath(options.getString("decoder") ?: "decoder.onnx"),
              modelContext.resolveModelPath(options.getString("joiner") ?: "joiner.onnx"),
            )
          }
          "paraformer" -> {
            val paraformerEncoder = options.getString("encoder")
            val paraformerDecoder = options.getString("decoder")
            if (paraformerEncoder.isNullOrBlank() || paraformerDecoder.isNullOrBlank()) {
              throw IllegalArgumentException("Realtime paraformer requires encoder and decoder model files")
            }
            this.modelType = "paraformer"
            this.paraformer = OnlineParaformerModelConfig(
              modelContext.resolveModelPath(paraformerEncoder),
              modelContext.resolveModelPath(paraformerDecoder),
            )
          }
          "zipformer2_ctc", "zipformer_ctc", "ctc" -> {
            this.modelType = "zipformer2_ctc"
            this.zipformer2Ctc = OnlineZipformer2CtcModelConfig(
              modelContext.resolveModelPath(options.getString("model") ?: "model.onnx"),
            )
          }
          else -> {
            throw IllegalArgumentException("Unsupported realtime modelType: $modelType")
          }
        }
      }

      val recognizerConfig = OnlineRecognizerConfig().apply {
        this.featConfig = FeatureConfig(sampleRate, featureDim, 0f)
        this.modelConfig = modelConfig
        this.decodingMethod = decodingMethod
        this.maxActivePaths = maxActivePaths
        this.blankPenalty = blankPenalty
        this.enableEndpoint = enableEndpoint
      }

      recognizer = OnlineRecognizer(modelContext.assetManager, recognizerConfig)
      stream = recognizer.createStream()

      audioRecord = createAudioRecord(sampleRate)

      realtimeRecognizer = recognizer
      realtimeStream = stream
      realtimeAudioRecord = audioRecord

      audioRecord.startRecording()
      sendRealtimeState("running")

      val shortBuffer = ShortArray(DEFAULT_AUDIO_BUFFER_SAMPLES)
      var lastEmitTime = 0L

      while (realtimeRunning) {
        val read = audioRecord.read(shortBuffer, 0, shortBuffer.size, AudioRecord.READ_BLOCKING)
        if (read <= 0) {
          continue
        }

        val samples = FloatArray(read)
        for (i in 0 until read) {
          samples[i] = shortBuffer[i] / 32768.0f
        }

        stream.acceptWaveform(samples, sampleRate)

        while (recognizer.isReady(stream)) {
          recognizer.decode(stream)
        }

        val now = System.currentTimeMillis()
        if (now - lastEmitTime >= emitIntervalMs.toLong()) {
          val partial = recognizer.getResult(stream)
          if (partial.text != lastText) {
            lastText = partial.text
            sendRealtimeResult(partial, false, false, sampleRate)
          }
          lastEmitTime = now
        }

        if (enableEndpoint && recognizer.isEndpoint(stream)) {
          val endpointResult = recognizer.getResult(stream)
          if (endpointResult.text.isNotBlank()) {
            lastText = ""
            sendRealtimeResult(endpointResult, true, true, sampleRate)
          }
          recognizer.reset(stream)
        }
      }

      stream.inputFinished()
      while (recognizer.isReady(stream)) {
        recognizer.decode(stream)
      }

      val finalResult = recognizer.getResult(stream)
      if (finalResult.text.isNotBlank()) {
        sendRealtimeResult(finalResult, true, false, sampleRate)
      }
      sendRealtimeState("stopped")
    } catch (e: Exception) {
      sendRealtimeState("error", e.message ?: "unknown")
      sendEvent(
        REALTIME_EVENT_NAME,
        mapOf(
          "type" to "error",
          "message" to (e.message ?: "unknown"),
        ),
      )
    } finally {
      try {
        audioRecord?.stop()
      } catch (_: Exception) {
      }
      audioRecord?.release()
      stream?.release()
      recognizer?.release()

      realtimeAudioRecord = null
      realtimeStream = null
      realtimeRecognizer = null
      realtimeRunning = false
    }
  }

  private fun stopRealtimeInternal() {
    realtimeRunning = false
    try {
      realtimeAudioRecord?.stop()
    } catch (_: Exception) {
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

  private fun sendRealtimeResult(
    result: OnlineRecognizerResult,
    isFinal: Boolean,
    isEndpoint: Boolean,
    sampleRate: Int,
  ) {
    sendEvent(
      REALTIME_EVENT_NAME,
      mapOf(
        "type" to if (isFinal) "final" else "partial",
        "text" to result.text,
        "tokens" to result.tokens.toList(),
        "timestamps" to result.timestamps.map { it.toDouble() },
        "isFinal" to isFinal,
        "isEndpoint" to isEndpoint,
        "sampleRate" to sampleRate,
      ),
    )
  }

  private fun sendRealtimeState(state: String, error: String? = null) {
    sendEvent(
      REALTIME_STATE_EVENT_NAME,
      mapOf(
        "state" to state,
        "error" to error,
      ),
    )
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
      return if (useFileModelDir) {
        File(baseModelDir, name).absolutePath
      } else {
        if (baseModelDir.endsWith("/")) "$baseModelDir$name" else "$baseModelDir/$name"
      }
    }
  }

  private fun transcribeWave(waveData: WaveData, options: Map<String, Any?>?): Map<String, Any?> {
    val modelContext = resolveModelContext(options)
    val modelType = options?.getString("modelType") ?: "transducer"
    val encoder = options?.getString("encoder") ?: "encoder.onnx"
    val decoder = options?.getString("decoder") ?: "decoder.onnx"
    val joiner = options?.getString("joiner") ?: "joiner.onnx"
    val model = options?.getString("model") ?: "model.onnx"
    val tokens = options?.getString("tokens")

    val sampleRate = options?.getInt("sampleRate") ?: DEFAULT_SAMPLE_RATE
    val featureDim = options?.getInt("featureDim") ?: DEFAULT_FEATURE_DIM
    val numThreads = options?.getInt("numThreads") ?: DEFAULT_NUM_THREADS
    val provider = options?.getString("provider") ?: "cpu"
    val debug = options?.getBoolean("debug") ?: false
    val decodingMethod = options?.getString("decodingMethod") ?: "greedy_search"
    val maxActivePaths = options?.getInt("maxActivePaths") ?: 4
    val blankPenalty = options?.getFloat("blankPenalty") ?: 0f

    val modelConfig = OfflineModelConfig().apply {
      this.tokens =
        if (!tokens.isNullOrBlank()) {
          modelContext.resolveModelPath(tokens)
        } else if (modelType == "paraformer") {
          ""
        } else {
          modelContext.resolveModelPath("tokens.txt")
        }
      this.numThreads = numThreads
      this.provider = provider
      this.debug = debug
      this.modelType = modelType
    }

    when (modelType) {
      "transducer", "zipformer", "zipformer2" -> {
        modelConfig.transducer =
          OfflineTransducerModelConfig(
            modelContext.resolveModelPath(encoder),
            modelContext.resolveModelPath(decoder),
            modelContext.resolveModelPath(joiner),
          )
      }
      "zipformer2_ctc", "zipformer_ctc", "ctc" -> {
        modelConfig.zipformerCtc = OfflineZipformerCtcModelConfig().apply {
          this.model = modelContext.resolveModelPath(model)
        }
        modelConfig.modelType = "zipformer2_ctc"
      }
      "paraformer" -> {
        modelConfig.paraformer = OfflineParaformerModelConfig().apply {
          this.model = modelContext.resolveModelPath(model)
        }
        modelConfig.modelType = "paraformer"
      }
      else -> {
        throw IllegalArgumentException("Unsupported modelType: $modelType")
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
    var stream: OfflineStream? = null
    try {
      recognizer = OfflineRecognizer(modelContext.assetManager, recognizerConfig)
      stream = recognizer.createStream()
      stream.acceptWaveform(waveData.samples, waveData.sampleRate)
      recognizer.decode(stream)
      val result = recognizer.getResult(stream)
      return result.toMap(waveData)
    } finally {
      stream?.release()
      recognizer?.release()
    }
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
    private const val REALTIME_EVENT_NAME = "onRealtimeTranscription"
    private const val REALTIME_STATE_EVENT_NAME = "onRealtimeState"
    private const val DEFAULT_MODEL_DIR_ASSET = "sherpa/models/zipformer-ctc-zh-int8-2025-07-03"
    private const val DEFAULT_SAMPLE_RATE = 16000
    private const val DEFAULT_FEATURE_DIM = 80
    private const val DEFAULT_NUM_THREADS = 2
    private const val DEFAULT_AUDIO_BUFFER_SAMPLES = 2048
    private const val DEFAULT_EMIT_INTERVAL_MS = 150
    private const val WAV_HEADER_SIZE = 44
  }
}
