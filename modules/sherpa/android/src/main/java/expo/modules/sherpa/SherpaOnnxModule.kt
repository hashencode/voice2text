package expo.modules.sherpa

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import com.k2fsa.sherpa.onnx.FeatureConfig
import com.k2fsa.sherpa.onnx.OfflineModelConfig
import com.k2fsa.sherpa.onnx.OfflineParaformerModelConfig
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
import com.k2fsa.sherpa.onnx.OfflineWhisperModelConfig
import com.k2fsa.sherpa.onnx.OfflineZipformerCtcModelConfig
import com.k2fsa.sherpa.onnx.OnlineModelConfig
import com.k2fsa.sherpa.onnx.OnlineParaformerModelConfig
import com.k2fsa.sherpa.onnx.OnlineRecognizer
import com.k2fsa.sherpa.onnx.OnlineRecognizerConfig
import com.k2fsa.sherpa.onnx.OnlineRecognizerResult
import com.k2fsa.sherpa.onnx.OnlineStream
import com.k2fsa.sherpa.onnx.OnlineTransducerModelConfig
import com.k2fsa.sherpa.onnx.OnlineZipformer2CtcModelConfig
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
  private val offlineCacheLock = Any()

  @Volatile
  private var cachedOfflineRecognizer: OfflineRecognizer? = null

  @Volatile
  private var cachedOfflineRecognizerKey: String? = null

  override fun definition() = ModuleDefinition {
    Name("SherpaOnnx")
    Events(REALTIME_EVENT_NAME, REALTIME_STATE_EVENT_NAME)

    OnDestroy {
      stopRealtimeInternal()
      stopWavRecordingInternal()
      clearOfflineRecognizerCache()
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
          val candidateAssetPaths = linkedSetOf<String>()
          candidateAssetPaths.add(normalizedAssetPath)
          candidateAssetPaths.add(normalizedAssetPath.removePrefix("assets/"))
          if (normalizedAssetPath.startsWith("sherpa/")) {
            candidateAssetPaths.add(normalizedAssetPath.removePrefix("sherpa/"))
          }
          if (normalizedAssetPath.startsWith("sherpa/asr/")) {
            candidateAssetPaths.add(normalizedAssetPath.removePrefix("sherpa/"))
            candidateAssetPaths.add(normalizedAssetPath.removePrefix("sherpa/asr/"))
            candidateAssetPaths.add("asr/${normalizedAssetPath.removePrefix("sherpa/asr/")}")
          }

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

  private fun runRealtimeTranscription(options: Map<String, Any?>) {
    var recognizer: OnlineRecognizer? = null
    var stream: OnlineStream? = null
    var denoiser: OfflineSpeechDenoiser? = null
    var punctuation: OfflinePunctuation? = null
    var vad: Vad? = null
    var speakerDiarization: OfflineSpeakerDiarization? = null
    var speakerExtractor: SpeakerEmbeddingExtractor? = null
    var speakerManager: SpeakerEmbeddingManager? = null
    var audioRecord: AudioRecord? = null
    var lastText = ""
    var vadActive = false
    var vadInfo = "disabled"
    var denoiseInfo = "disabled"
    var punctuationInfo = "disabled"
    var nextSpeakerIndex = 0

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
      val denoiseModel = options.getString("denoiseModel")
      val enableDenoise = options.getBoolean("enableDenoise") ?: !denoiseModel.isNullOrBlank()
      val punctuationModel = options.getString("punctuationModel")
      val enablePunctuation = options.getBoolean("enablePunctuation") ?: !punctuationModel.isNullOrBlank()
      val vadModel = options.getString("vadModel")
      val enableVad = options.getBoolean("enableVad") ?: !vadModel.isNullOrBlank()
      val enableSpeakerDiarization = options.getBoolean("enableSpeakerDiarization") ?: false
      val speakerSimilarityThreshold = options.getFloat("speakerSimilarityThreshold") ?: 0.85f

      val modelConfig = OnlineModelConfig().apply {
        val tokens = options.getString("tokens")
        this.tokens =
          if (!tokens.isNullOrBlank()) {
            modelContext.resolveModelPath(tokens)
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
            this.modelType = "paraformer"
            this.paraformer = OnlineParaformerModelConfig(
              modelContext.resolveModelPath(options.getString("encoder") ?: "encoder.onnx"),
              modelContext.resolveModelPath(options.getString("decoder") ?: "decoder.onnx"),
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
      if (enableDenoise && !denoiseModel.isNullOrBlank()) {
        try {
          denoiser = createOfflineSpeechDenoiser(modelContext, denoiseModel, numThreads, provider, debug)
          denoiseInfo = "enabled:${modelContext.resolveModelPath(denoiseModel)}"
        } catch (e: Exception) {
          denoiser = null
          denoiseInfo = "init-failed:${e.message ?: "unknown"}"
        }
      } else {
        denoiseInfo = if (enableDenoise) "enabled but denoiseModel empty" else "disabled by option"
      }
      if (enablePunctuation && !punctuationModel.isNullOrBlank()) {
        try {
          punctuation = createOfflinePunctuation(modelContext, punctuationModel, numThreads, provider, debug)
          punctuationInfo = "enabled:${modelContext.resolveModelPath(punctuationModel)}"
        } catch (e: Exception) {
          punctuation = null
          punctuationInfo = "init-failed:${e.message ?: "unknown"}"
        }
      } else {
        punctuationInfo = if (enablePunctuation) "enabled but punctuationModel empty" else "disabled by option"
      }
      if (enableVad && !vadModel.isNullOrBlank()) {
        try {
          val vadModelPath = modelContext.resolveModelPath(vadModel)
          val normalizedVadPath = vadModelPath.lowercase()
          val useTenVad = normalizedVadPath.contains("ten-vad")
          if (!useTenVad) {
            println("[sherpa] Unsupported VAD model file for this runtime: $vadModelPath. Fallback without VAD.")
            vadInfo = "unsupported model: $vadModelPath"
          } else {
          val vadThreshold = options.getFloat("vadThreshold") ?: 0.35f
          val vadMinSilenceDuration = options.getFloat("vadMinSilenceDuration") ?: 0.9f
          val vadMinSpeechDuration = options.getFloat("vadMinSpeechDuration") ?: 0.18f
          val vadWindowSize = options.getInt("vadWindowSize") ?: 256
          val vadMaxSpeechDuration = options.getFloat("vadMaxSpeechDuration") ?: 15.0f
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
          vadActive = true
          vadInfo = "enabled:ten:$vadModelPath"
          println("[sherpa] VAD enabled. model=$vadModelPath type=ten")
          }
        } catch (e: Exception) {
          println("[sherpa] VAD initialization failed. fallback without VAD: ${e.message}")
          vad = null
          vadInfo = "init failed: ${e.message ?: "unknown"}"
        }
      } else {
        vadInfo = if (enableVad) "enabled but vadModel empty" else "disabled by option"
      }

      if (enableSpeakerDiarization) {
        if (vad == null) {
          vadInfo = "$vadInfo | speaker=disabled:requires-vad"
        } else {
          try {
            speakerDiarization = createOfflineSpeakerDiarization(modelContext, options, numThreads, provider, debug)
            val embeddingModel =
              options.getString("speakerEmbeddingModel")
                ?: DEFAULT_SPEAKER_EMBEDDING_MODEL_ASSET
            val extractorConfig =
              SpeakerEmbeddingExtractorConfig(
                modelContext.resolveModelPath(embeddingModel),
                numThreads,
                debug,
                provider,
              )
            speakerExtractor = SpeakerEmbeddingExtractor(modelContext.assetManager, extractorConfig)
            speakerManager = SpeakerEmbeddingManager(speakerExtractor.dim())
            vadInfo = "$vadInfo | speaker=enabled"
          } catch (e: Exception) {
            speakerDiarization = null
            speakerExtractor = null
            speakerManager = null
            vadInfo = "$vadInfo | speaker=init-failed:${e.message ?: "unknown"}"
          }
        }
      }

      audioRecord = createAudioRecord(sampleRate)

      realtimeRecognizer = recognizer
      realtimeStream = stream
      realtimeAudioRecord = audioRecord

      audioRecord.startRecording()
      sendRealtimeState("running", null, vadActive, "$vadInfo | denoise=$denoiseInfo | punct=$punctuationInfo")

      val shortBuffer = ShortArray(DEFAULT_AUDIO_BUFFER_SAMPLES)
      var lastEmitTime = 0L

      while (realtimeRunning) {
        val read = audioRecord.read(shortBuffer, 0, shortBuffer.size, AudioRecord.READ_BLOCKING)
        if (read <= 0) {
          continue
        }

        val rawSamples = FloatArray(read)
        for (i in 0 until read) {
          rawSamples[i] = shortBuffer[i] / 32768.0f
        }
        val denoised = denoiser?.run(rawSamples, sampleRate)
        val samples = denoised?.samples ?: rawSamples
        val processedSampleRate = denoised?.sampleRate ?: sampleRate

        if (vad != null) {
          vad.acceptWaveform(samples)
          while (!vad.empty()) {
            val segment = vad.front()
            vad.pop()
            stream.acceptWaveform(segment.samples, processedSampleRate)
            while (recognizer.isReady(stream)) {
              recognizer.decode(stream)
            }
            val segmentResult = recognizer.getResult(stream)
            if (segmentResult.text.isNotBlank()) {
              val outputText =
                if (speakerDiarization != null) {
                  val speakerSegments = speakerDiarization.process(segment.samples)
                  val speakerNameResult =
                    resolveSpeakerNamesForRealtimeSegment(
                      segment.samples,
                      sampleRate,
                      speakerSegments,
                      speakerExtractor,
                      speakerManager,
                      speakerSimilarityThreshold,
                      nextSpeakerIndex,
                    )
                  nextSpeakerIndex = speakerNameResult.nextSpeakerIndex
                  formatOnlineResultBySpeaker(segmentResult, speakerSegments, speakerNameResult.localSpeakerNameMap)
                } else {
                  segmentResult.text
                }
              val punctuatedText = applyPunctuation(punctuation, outputText)
              lastText = ""
              sendRealtimeResult(segmentResult, true, true, sampleRate, punctuatedText)
              recognizer.reset(stream)
            }
          }
        } else {
          stream.acceptWaveform(samples, processedSampleRate)

          while (recognizer.isReady(stream)) {
            recognizer.decode(stream)
          }

          val now = System.currentTimeMillis()
          if (now - lastEmitTime >= emitIntervalMs.toLong()) {
            val partial = recognizer.getResult(stream)
            if (partial.text != lastText) {
              lastText = partial.text
              val punctuatedPartialText = applyPunctuation(punctuation, partial.text)
              sendRealtimeResult(partial, false, false, sampleRate, punctuatedPartialText)
            }
            lastEmitTime = now
          }

          if (enableEndpoint && recognizer.isEndpoint(stream)) {
            val endpointResult = recognizer.getResult(stream)
            if (endpointResult.text.isNotBlank()) {
              val punctuatedText = applyPunctuation(punctuation, endpointResult.text)
              lastText = ""
              sendRealtimeResult(endpointResult, true, true, sampleRate, punctuatedText)
            }
            recognizer.reset(stream)
          }
        }
      }

      if (vad != null) {
        vad.flush()
        while (!vad.empty()) {
          val segment = vad.front()
          vad.pop()
          stream.acceptWaveform(segment.samples, sampleRate)
          while (recognizer.isReady(stream)) {
            recognizer.decode(stream)
          }
        }
      }

      stream.inputFinished()
      while (recognizer.isReady(stream)) {
        recognizer.decode(stream)
      }

      val finalResult = recognizer.getResult(stream)
      if (finalResult.text.isNotBlank()) {
        val punctuatedText = applyPunctuation(punctuation, finalResult.text)
        sendRealtimeResult(finalResult, true, false, sampleRate, punctuatedText)
      }
      sendRealtimeState("stopped", null, vadActive, "$vadInfo | denoise=$denoiseInfo | punct=$punctuationInfo")
    } catch (e: Exception) {
      sendRealtimeState("error", e.message ?: "unknown", vadActive, "$vadInfo | denoise=$denoiseInfo | punct=$punctuationInfo")
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
      denoiser?.release()
      punctuation?.release()
      vad?.release()
      speakerDiarization?.release()
      speakerExtractor?.release()
      speakerManager?.release()
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
    overrideText: String? = null,
  ) {
    sendEvent(
      REALTIME_EVENT_NAME,
      mapOf(
        "type" to if (isFinal) "final" else "partial",
        "text" to (overrideText ?: result.text),
        "tokens" to result.tokens.toList(),
        "timestamps" to result.timestamps.map { it.toDouble() },
        "isFinal" to isFinal,
        "isEndpoint" to isEndpoint,
        "sampleRate" to sampleRate,
      ),
    )
  }

  private fun sendRealtimeState(
    state: String,
    error: String? = null,
    vadActive: Boolean? = null,
    vadInfo: String? = null,
  ) {
    sendEvent(
      REALTIME_STATE_EVENT_NAME,
      mapOf(
        "state" to state,
        "error" to error,
        "vadActive" to vadActive,
        "vadInfo" to vadInfo,
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
    val denoiseModel = options?.getString("denoiseModel")
    val enableDenoise = options?.getBoolean("enableDenoise") ?: !denoiseModel.isNullOrBlank()
    val punctuationModel = options?.getString("punctuationModel")
    val requestedEnablePunctuation = options?.getBoolean("enablePunctuation") ?: !punctuationModel.isNullOrBlank()
    val enablePunctuation = requestedEnablePunctuation && modelType != "whisper"
    val decodingMethod = options?.getString("decodingMethod") ?: "greedy_search"
    val maxActivePaths = options?.getInt("maxActivePaths") ?: 4
    val blankPenalty = options?.getFloat("blankPenalty") ?: 0f
    val enableSpeakerDiarization = options?.getBoolean("enableSpeakerDiarization") ?: false

    var resolvedTokensPath = ""
    var resolvedEncoderPath = ""
    var resolvedDecoderPath = ""
    var resolvedJoinerPath = ""
    var resolvedParaformerModelPath = ""
    var resolvedCtcModelPath = ""

    val modelConfig = OfflineModelConfig().apply {
      resolvedTokensPath =
        if (!tokens.isNullOrBlank()) {
          modelContext.resolveModelPath(tokens)
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
      "transducer", "zipformer", "zipformer2" -> {
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
      "paraformer" -> {
        resolvedParaformerModelPath = modelContext.resolveModelPath(model)
        modelConfig.paraformer = OfflineParaformerModelConfig().apply {
          this.model = resolvedParaformerModelPath
        }
        modelConfig.modelType = "paraformer"
      }
      "zipformer2_ctc", "zipformer_ctc", "ctc" -> {
        resolvedCtcModelPath = modelContext.resolveModelPath(model)
        modelConfig.zipformerCtc = OfflineZipformerCtcModelConfig().apply {
          this.model = resolvedCtcModelPath
        }
        modelConfig.modelType = "zipformer2_ctc"
      }
      "whisper" -> {
        resolvedEncoderPath = modelContext.resolveModelPath(encoder)
        resolvedDecoderPath = modelContext.resolveModelPath(decoder)
        modelConfig.whisper = OfflineWhisperModelConfig().apply {
          this.encoder = resolvedEncoderPath
          this.decoder = resolvedDecoderPath
          this.language = "en"
          this.task = "transcribe"
        }
        modelConfig.modelType = "whisper"
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
    var denoiser: OfflineSpeechDenoiser? = null
    var punctuation: OfflinePunctuation? = null
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
          paraformerModelPath = resolvedParaformerModelPath,
          ctcModelPath = resolvedCtcModelPath,
        )
      recognizer = acquireOfflineRecognizer(recognizerKey, modelContext.assetManager, recognizerConfig)

      if (enableSpeakerDiarization) {
        speakerDiarization = createOfflineSpeakerDiarization(modelContext, options, numThreads, provider, debug)
      }
      if (enablePunctuation && !punctuationModel.isNullOrBlank()) {
        punctuation = createOfflinePunctuation(modelContext, punctuationModel, numThreads, provider, debug)
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
    } finally {
      stream?.release()
      denoiser?.release()
      punctuation?.release()
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
    paraformerModelPath: String,
    ctcModelPath: String,
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
      "paraformerModel=$paraformerModelPath",
      "ctcModel=$ctcModelPath",
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

  private fun formatOnlineResultBySpeaker(
    result: OnlineRecognizerResult,
    segments: Array<OfflineSpeakerDiarizationSegment>,
    localSpeakerNameMap: Map<Int, String> = emptyMap(),
  ): String {
    if (segments.isEmpty()) {
      return result.text
    }
    val tokens = result.tokens
    val timestamps = result.timestamps
    if (tokens.isEmpty() || timestamps.isEmpty()) {
      val speakerName = localSpeakerNameMap[segments[0].speaker] ?: speakerLabel(segments[0].speaker)
      return "$speakerName: ${result.text}"
    }

    val chunks = mutableListOf<SpeakerChunk>()
    val count = minOf(tokens.size, timestamps.size)
    for (index in 0 until count) {
      val normalized = normalizeToken(tokens[index])
      if (normalized.isBlank()) {
        continue
      }
      val localSpeaker = speakerForTime(timestamps[index], segments)
      val speaker = localSpeakerNameMap[localSpeaker] ?: speakerLabel(localSpeaker)
      if (chunks.isNotEmpty() && chunks.last().speaker == speaker) {
        val merged = mergePieceText(chunks.last().text, normalized)
        chunks[chunks.lastIndex] = SpeakerChunk(speaker, merged)
      } else {
        chunks.add(SpeakerChunk(speaker, normalized))
      }
    }

    if (chunks.isEmpty()) {
      val speakerName = localSpeakerNameMap[segments[0].speaker] ?: speakerLabel(segments[0].speaker)
      return "$speakerName: ${result.text}"
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

  private fun speakerForTime(time: Float, segments: Array<OfflineSpeakerDiarizationSegment>): Int {
    for (segment in segments) {
      if (time >= segment.start && time <= segment.end) {
        return segment.speaker
      }
    }

    var nearestSpeaker = segments[0].speaker
    var nearestDistance = Float.MAX_VALUE
    for (segment in segments) {
      val distance =
        when {
          time < segment.start -> segment.start - time
          time > segment.end -> time - segment.end
          else -> 0f
        }
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestSpeaker = segment.speaker
      }
    }
    return nearestSpeaker
  }

  private fun normalizeToken(token: String): String {
    return token
      .replace("▁", " ")
      .replace("Ġ", " ")
      .replace("<blk>", "")
      .trim()
  }

  private fun mergePieceText(left: String, right: String): String {
    if (left.isBlank()) return right
    if (right.isBlank()) return left
    val leftLast = left.last()
    val rightFirst = right.first()
    val needsSpace = leftLast.isLetterOrDigit() && rightFirst.isLetterOrDigit()
    return if (needsSpace) "$left $right" else "$left$right"
  }

  private data class RealtimeSpeakerNameResolveResult(
    val localSpeakerNameMap: Map<Int, String>,
    val nextSpeakerIndex: Int,
  )

  private fun resolveSpeakerNamesForRealtimeSegment(
    segmentSamples: FloatArray,
    sampleRate: Int,
    segments: Array<OfflineSpeakerDiarizationSegment>,
    extractor: SpeakerEmbeddingExtractor?,
    manager: SpeakerEmbeddingManager?,
    similarityThreshold: Float,
    startSpeakerIndex: Int,
  ): RealtimeSpeakerNameResolveResult {
    if (segments.isEmpty() || extractor == null || manager == null) {
      return RealtimeSpeakerNameResolveResult(emptyMap(), startSpeakerIndex)
    }

    var nextSpeaker = startSpeakerIndex
    val speakerMap = mutableMapOf<Int, String>()
    val localSpeakerIds = segments.map { it.speaker }.toSet()
    for (localSpeakerId in localSpeakerIds) {
      val speakerSamples = collectSamplesForSpeaker(segmentSamples, sampleRate, segments, localSpeakerId)
      if (speakerSamples.isEmpty()) {
        continue
      }

      var embedStream: OnlineStream? = null
      try {
        embedStream = extractor.createStream()
        embedStream.acceptWaveform(speakerSamples, sampleRate)
        if (!extractor.isReady(embedStream)) {
          continue
        }

        val embedding = extractor.compute(embedStream)
        val matchedName = manager.search(embedding, similarityThreshold)
        if (matchedName.isNotBlank()) {
          speakerMap[localSpeakerId] = matchedName
          continue
        }

        val newName = speakerNameByIndex(nextSpeaker)
        val added = manager.add(newName, embedding)
        if (added) {
          speakerMap[localSpeakerId] = newName
          nextSpeaker += 1
        } else {
          speakerMap[localSpeakerId] = speakerLabel(localSpeakerId)
        }
      } catch (_: Exception) {
        speakerMap[localSpeakerId] = speakerLabel(localSpeakerId)
      } finally {
        embedStream?.release()
      }
    }

    return RealtimeSpeakerNameResolveResult(speakerMap, nextSpeaker)
  }

  private fun collectSamplesForSpeaker(
    segmentSamples: FloatArray,
    sampleRate: Int,
    segments: Array<OfflineSpeakerDiarizationSegment>,
    speakerId: Int,
  ): FloatArray {
    val speakerSegments = segments.filter { it.speaker == speakerId }
    if (speakerSegments.isEmpty()) {
      return FloatArray(0)
    }

    var total = 0
    for (segment in speakerSegments) {
      val startIndex = (segment.start * sampleRate).toInt().coerceAtLeast(0)
      val endIndex = (segment.end * sampleRate).toInt().coerceAtMost(segmentSamples.size)
      if (endIndex > startIndex) {
        total += endIndex - startIndex
      }
    }
    if (total <= 0) {
      return FloatArray(0)
    }

    val out = FloatArray(total)
    var offset = 0
    for (segment in speakerSegments) {
      val startIndex = (segment.start * sampleRate).toInt().coerceAtLeast(0)
      val endIndex = (segment.end * sampleRate).toInt().coerceAtMost(segmentSamples.size)
      if (endIndex <= startIndex) {
        continue
      }
      val length = endIndex - startIndex
      System.arraycopy(segmentSamples, startIndex, out, offset, length)
      offset += length
    }
    return if (offset == out.size) out else out.copyOf(offset)
  }

  private fun speakerNameByIndex(index: Int): String {
    if (index in 0..25) {
      val suffix = ('A'.code + index).toChar()
      return "speaker$suffix"
    }
    return "speaker${index + 1}"
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
    private const val DEFAULT_MODEL_DIR_ASSET = "sherpa/asr/zh"
    private const val DEFAULT_SAMPLE_RATE = 16000
    private const val DEFAULT_FEATURE_DIM = 80
    private const val DEFAULT_NUM_THREADS = 2
    private const val DEFAULT_AUDIO_BUFFER_SAMPLES = 512
    private const val DEFAULT_EMIT_INTERVAL_MS = 150
    private const val WAV_HEADER_SIZE = 44
    private const val DEFAULT_SPEAKER_SEGMENTATION_MODEL_ASSET = "sherpa/speaker-diarization/pyannote-segmentation.onnx"
    private const val DEFAULT_SPEAKER_EMBEDDING_MODEL_ASSET = "sherpa/speaker-recognition/zh-cn.onnx"
  }
}
