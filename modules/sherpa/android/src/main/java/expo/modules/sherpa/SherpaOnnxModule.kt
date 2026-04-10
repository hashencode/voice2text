package expo.modules.sherpa

import android.app.ActivityManager
import android.content.Context
import android.content.pm.PackageManager
import android.content.res.AssetManager
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import com.k2fsa.sherpa.onnx.FeatureConfig
import com.k2fsa.sherpa.onnx.OfflineFunAsrNanoModelConfig
import com.k2fsa.sherpa.onnx.OfflineModelConfig
import com.k2fsa.sherpa.onnx.OfflineMoonshineModelConfig
import com.k2fsa.sherpa.onnx.OfflineParaformerModelConfig
import com.k2fsa.sherpa.onnx.OfflinePunctuation
import com.k2fsa.sherpa.onnx.OfflinePunctuationConfig
import com.k2fsa.sherpa.onnx.OfflinePunctuationModelConfig
import com.k2fsa.sherpa.onnx.OfflineQwen3AsrModelConfig
import com.k2fsa.sherpa.onnx.OfflineRecognizer
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig
import com.k2fsa.sherpa.onnx.OfflineRecognizerResult
import com.k2fsa.sherpa.onnx.OfflineSpeechDenoiser
import com.k2fsa.sherpa.onnx.OfflineSpeechDenoiserConfig
import com.k2fsa.sherpa.onnx.OfflineSpeechDenoiserDpdfNetModelConfig
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
import com.k2fsa.sherpa.onnx.SileroVadModelConfig
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
import java.util.zip.ZipFile
import org.json.JSONArray
import org.json.JSONObject

class SherpaOnnxModule : Module() {
  private val executor: ExecutorService = Executors.newSingleThreadExecutor()
  private val wavRecordExecutor: ExecutorService = Executors.newSingleThreadExecutor()

  @Volatile
  private var wavRecordingRunning = false

  @Volatile
  private var wavRecordingPaused = false

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

  @Volatile
  private var wavStopReason = STOP_REASON_MANUAL

  @Volatile
  private var wavInterruptedBySystem = false

  @Volatile
  private var wavSessionId: String? = null

  @Volatile
  private var wavSessionDir: File? = null

  @Volatile
  private var wavSessionMetaFile: File? = null

  @Volatile
  private var wavSessionStartedAtMs: Long = 0L

  @Volatile
  private var wavChunkDurationMs = DEFAULT_WAV_CHUNK_DURATION_MS

  @Volatile
  private var wavSessionState = SESSION_STATE_IDLE

  @Volatile
  private var wavAudioManager: AudioManager? = null

  private val wavLock = Any()
  private val realtimeLock = Any()
  private val offlineCacheLock = Any()
  private val nativeLibProbeLock = Any()
  private val nativeLibProbeCache = mutableMapOf<String, Boolean>()
  private val wavChunkList = mutableListOf<WavChunkMeta>()

  private val wavAudioFocusChangeListener =
    AudioManager.OnAudioFocusChangeListener { focusChange ->
      when (focusChange) {
        AudioManager.AUDIOFOCUS_LOSS,
        AudioManager.AUDIOFOCUS_LOSS_TRANSIENT,
        AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK
        -> stopWavRecordingInternal(STOP_REASON_AUDIO_FOCUS_LOSS, interruptedBySystem = true)
      }
    }

  @Volatile
  private var cachedOfflineRecognizer: OfflineRecognizer? = null

  @Volatile
  private var cachedOfflineRecognizerKey: String? = null

  @Volatile
  private var activeRealtimeSession: RealtimeAsrSession? = null

  private data class RealtimeAsrSession(
    val mode: String,
    val sampleRate: Int,
    val decodeOptions: Map<String, Any?>,
    val vad: Vad?,
    var committedText: String = "",
    var partialText: String = "",
    var speechBuffer: ArrayList<Float> = arrayListOf(),
    var speechOffset: Int = 0,
    var speechStarted: Boolean = false,
    var speechStartOffset: Int = 0,
    var lastPartialDecodeAtMs: Long = 0L,
    var updatedAtMs: Long = 0L,
  )

  private data class WavChunkMeta(
    val index: Int,
    val path: String,
    val bytes: Long,
    val startSample: Long,
    val endSample: Long,
  )

  private data class WavInfo(
    val sampleRate: Int,
    val numSamples: Long,
    val durationMs: Long,
  )

  private data class RecoverableWavSession(
    val sessionDir: File,
    val metaFile: File,
    val sessionId: String,
    val outputPath: String,
    val sampleRate: Int,
    val chunkDurationMs: Int,
    val startedAtMs: Long,
    val state: String,
    val reason: String,
    val chunks: List<WavChunkMeta>,
  )

  private data class ProviderCheckResult(
    val supported: Boolean,
    val reason: String,
  )

  init {
    try {
      System.loadLibrary("sherpaaudio")
    } catch (e: UnsatisfiedLinkError) {
      println("[sherpa] sherpaaudio native lib is unavailable: ${e.message}")
    }
  }

  override fun definition() = ModuleDefinition {
    Name("SherpaOnnx")

    OnDestroy {
      stopWavRecordingInternal(STOP_REASON_MODULE_DESTROYED, interruptedBySystem = true)
      stopRealtimeAsrInternal()
      clearOfflineRecognizerCache()
      executor.shutdownNow()
      wavRecordExecutor.shutdownNow()
    }

    Function("hello") {
      "Sherpa ready"
    }

    Function("getRuntimeProfile") {
      val cores = Runtime.getRuntime().availableProcessors().coerceAtLeast(1)
      val activityManager = appContext.reactContext?.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
      val isLowRamDevice = activityManager?.isLowRamDevice ?: false
      val recommendedNumThreads = computeRecommendedNumThreads(cores, isLowRamDevice)
      val performanceTier = if (recommendedNumThreads >= 4) "high" else "low"
      mapOf(
        "availableProcessors" to cores,
        "isLowRamDevice" to isLowRamDevice,
        "recommendedNumThreads" to recommendedNumThreads,
        "performanceTier" to performanceTier,
      )
    }

    Function("getAutoProviders") {
      val providers = mutableListOf<String>()
      if (checkNnapiSupport().supported) {
        providers.add("nnapi")
      }
      if (checkXnnpackSupport().supported) {
        providers.add("xnnpack")
      }
      providers.add("cpu")
      providers
    }

    Function("getProviderDiagnostics") {
      val nnapiCheck = checkNnapiSupport()
      val xnnpackCheck = checkXnnpackSupport()

      val providers = mutableListOf<String>()
      if (nnapiCheck.supported) {
        providers.add("nnapi")
      }
      if (xnnpackCheck.supported) {
        providers.add("xnnpack")
      }
      providers.add("cpu")

      mapOf(
        "autoProviders" to providers,
        "nnapi" to mapOf(
          "supported" to nnapiCheck.supported,
          "reason" to nnapiCheck.reason,
        ),
        "xnnpack" to mapOf(
          "supported" to xnnpackCheck.supported,
          "reason" to xnnpackCheck.reason,
        ),
      )
    }

    Function("getProviderSelfCheck") {
      val autoProviders = buildProviderListForSelfCheck()
      val reactContext = appContext.reactContext
      val nativeLibDirPath = reactContext?.applicationInfo?.nativeLibraryDir
      val nativeLibDir = if (nativeLibDirPath.isNullOrBlank()) null else File(nativeLibDirPath)
      val nativeLibDirReady = nativeLibDir?.exists() == true && nativeLibDir.isDirectory

      fun checkLib(name: String): Map<String, Any?> {
        val exists = isBundledNativeLibraryAvailable(name)
        val inNativeLibDir = if (nativeLibDirReady) File(nativeLibDir, name).exists() else false
        val inApk = hasNativeLibraryInApk(name)
        return mapOf(
          "name" to name,
          "exists" to exists,
          "inNativeLibDir" to inNativeLibDir,
          "inApk" to inApk,
        )
      }

      val requiredLibs =
        listOf(
          "libsherpa-onnx-jni.so",
          "libonnxruntime.so",
          "libonnxruntime4j_jni.so",
        )

      mapOf(
        "abi" to Build.SUPPORTED_ABIS.toList(),
        "hardware" to Build.HARDWARE,
        "board" to Build.BOARD,
        "product" to Build.PRODUCT,
        "manufacturer" to Build.MANUFACTURER,
        "model" to Build.MODEL,
        "sdkInt" to Build.VERSION.SDK_INT,
        "nativeLibDir" to (nativeLibDirPath ?: ""),
        "nativeLibDirReady" to nativeLibDirReady,
        "availableProviders" to autoProviders,
        "libs" to requiredLibs.map { checkLib(it) },
      )
    }

    Function("isWavRecording") {
      wavRecordingRunning
    }

    Function("isWavRecordingPaused") {
      wavRecordingPaused
    }

    AsyncFunction("startWavRecording") { options: Map<String, Any?>?, promise: Promise ->
      synchronized(wavLock) {
        if (wavRecordingRunning) {
          promise.reject("ERR_WAV_RECORDING_ALREADY_RUNNING", "WAV recording is already running", null)
          return@AsyncFunction
        }

        try {
          val sampleRate = options?.getInt("sampleRate") ?: DEFAULT_SAMPLE_RATE
          val chunkDurationMs = (options?.getInt("chunkDurationMs") ?: DEFAULT_WAV_CHUNK_DURATION_MS).coerceIn(250, 5000)
          val realtimeMode = options?.getString("realtimeMode")?.trim()?.ifBlank { null }
          val realtimeOptions = options?.get("realtimeOptions") as? Map<String, Any?>
          val outputPath =
            options?.getString("path")?.removePrefix("file://")
              ?: run {
                val cacheDir =
                  appContext.reactContext?.cacheDir ?: throw IllegalStateException("React context is not available")
                File(cacheDir, "recording-${System.currentTimeMillis()}.wav").absolutePath
              }
          val sessionId = "session-${System.currentTimeMillis()}-${UUID.randomUUID().toString().substring(0, 8)}"
          val sessionDir = createWavSessionDir(sessionId)
          val sessionMetaFile = File(sessionDir, DEFAULT_WAV_SESSION_META_FILE)

          val outFile = File(outputPath)
          outFile.parentFile?.mkdirs()

          val audioRecord = createAudioRecord(sampleRate)

          wavRecordingRunning = true
          wavRecordingPaused = false
          wavAudioRecord = audioRecord
          wavOutputFile = outFile
          wavSampleRate = sampleRate
          wavWrittenBytes = 0
          wavStopReason = STOP_REASON_MANUAL
          wavInterruptedBySystem = false
          wavSessionId = sessionId
          wavSessionDir = sessionDir
          wavSessionMetaFile = sessionMetaFile
          wavSessionStartedAtMs = System.currentTimeMillis()
          wavChunkDurationMs = chunkDurationMs
          wavSessionState = SESSION_STATE_RECORDING
          wavChunkList.clear()
          wavStopLatch = CountDownLatch(1)
          persistCurrentWavSessionMeta()
          requestWavAudioFocus()

          if (!realtimeMode.isNullOrBlank() && realtimeMode != REALTIME_MODE_DISABLED) {
            val mergedRealtimeOptions = HashMap<String, Any?>()
            if (realtimeOptions != null) {
              mergedRealtimeOptions.putAll(realtimeOptions)
            }
            mergedRealtimeOptions["realtimeMode"] = realtimeMode
            mergedRealtimeOptions["sampleRate"] = sampleRate
            startRealtimeAsrInternal(mergedRealtimeOptions)
          }

          wavRecordExecutor.execute {
            runWavRecordingLoop(outFile, audioRecord, sampleRate, sessionDir)
          }

          promise.resolve(
            mapOf(
              "path" to outFile.absolutePath,
              "sampleRate" to sampleRate,
              "sessionId" to sessionId,
              "chunkDurationMs" to chunkDurationMs,
            ),
          )
        } catch (e: Exception) {
          wavRecordingRunning = false
          wavAudioRecord?.release()
          wavAudioRecord = null
          wavOutputFile = null
          wavSessionState = SESSION_STATE_IDLE
          wavChunkList.clear()
          wavSessionId = null
          wavSessionDir = null
          wavSessionMetaFile = null
          wavStopLatch = null
          abandonWavAudioFocus()
          promise.reject("ERR_WAV_RECORDING_START", e.message, e)
        }
      }
    }

    AsyncFunction("stopWavRecording") { promise: Promise ->
      val latch = wavStopLatch
      val outputFile = wavOutputFile
      val sampleRate = wavSampleRate

      stopWavRecordingInternal(STOP_REASON_MANUAL, interruptedBySystem = false)

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
            "sessionId" to wavSessionId,
          ),
        )
      }
    }

    AsyncFunction("pauseWavRecording") { promise: Promise ->
      synchronized(wavLock) {
        if (!wavRecordingRunning) {
          promise.reject("ERR_WAV_RECORDING_NOT_RUNNING", "WAV recording is not running", null)
          return@AsyncFunction
        }
        if (wavRecordingPaused) {
          promise.resolve(mapOf("ok" to true, "paused" to true))
          return@AsyncFunction
        }
        wavRecordingPaused = true
        promise.resolve(mapOf("ok" to true, "paused" to true))
      }
    }

    AsyncFunction("resumeWavRecording") { promise: Promise ->
      synchronized(wavLock) {
        if (!wavRecordingRunning) {
          promise.reject("ERR_WAV_RECORDING_NOT_RUNNING", "WAV recording is not running", null)
          return@AsyncFunction
        }
        if (!wavRecordingPaused) {
          promise.resolve(mapOf("ok" to true, "paused" to false))
          return@AsyncFunction
        }
        wavRecordingPaused = false
        promise.resolve(mapOf("ok" to true, "paused" to false))
      }
    }

    AsyncFunction("startRealtimeAsr") { options: Map<String, Any?>?, promise: Promise ->
      executor.execute {
        try {
          startRealtimeAsrInternal(options)
          promise.resolve(mapOf("ok" to true))
        } catch (e: Throwable) {
          promise.reject("ERR_REALTIME_ASR_START", e.message, e)
        }
      }
    }

    AsyncFunction("appendRealtimeAsrPcm") { samples: List<Double>, sampleRate: Int?, promise: Promise ->
      executor.execute {
        try {
          val pcm = FloatArray(samples.size) { index ->
            samples[index].toFloat()
          }
          appendRealtimeAsrSamplesInternal(pcm, sampleRate ?: DEFAULT_SAMPLE_RATE)
          promise.resolve(mapOf("ok" to true))
        } catch (e: Throwable) {
          promise.reject("ERR_REALTIME_ASR_APPEND", e.message, e)
        }
      }
    }

    AsyncFunction("stopRealtimeAsr") { promise: Promise ->
      executor.execute {
        try {
          stopRealtimeAsrInternal()
          promise.resolve(mapOf("ok" to true))
        } catch (e: Throwable) {
          promise.reject("ERR_REALTIME_ASR_STOP", e.message, e)
        }
      }
    }

    Function("getRealtimeAsrSnapshot") {
      synchronized(realtimeLock) {
        val session = activeRealtimeSession
        if (session == null) {
          mapOf(
            "active" to false,
            "mode" to "",
            "sampleRate" to DEFAULT_SAMPLE_RATE,
            "text" to "",
            "committedText" to "",
            "partialText" to "",
            "updatedAtMs" to 0.0,
          )
        } else {
          val text =
            if (session.partialText.isNotBlank()) {
              mergePieceText(session.committedText, session.partialText).trim()
            } else {
              session.committedText
            }
          mapOf(
            "active" to true,
            "mode" to session.mode,
            "sampleRate" to session.sampleRate,
            "text" to text,
            "committedText" to session.committedText,
            "partialText" to session.partialText,
            "updatedAtMs" to session.updatedAtMs.toDouble(),
          )
        }
      }
    }

    AsyncFunction("recoverWavRecordings") { promise: Promise ->
      executor.execute {
        try {
          val sessions = recoverInterruptedWavSessions()
          promise.resolve(sessions)
        } catch (e: Exception) {
          promise.reject("ERR_WAV_RECORDING_RECOVER", e.message, e)
        }
      }
    }

    AsyncFunction("listRecoverableWavRecordings") { promise: Promise ->
      executor.execute {
        try {
          promise.resolve(listRecoverableWavSessions())
        } catch (e: Exception) {
          promise.reject("ERR_WAV_RECORDING_LIST_RECOVERABLE", e.message, e)
        }
      }
    }

    AsyncFunction("recoverWavRecordingSession") { sessionId: String, promise: Promise ->
      executor.execute {
        try {
          val recovered = recoverInterruptedWavSessionById(sessionId)
          promise.resolve(recovered)
        } catch (e: Exception) {
          promise.reject("ERR_WAV_RECORDING_RECOVER_SESSION", e.message, e)
        }
      }
    }

    AsyncFunction("discardRecoverableWavRecordings") { sessionIds: List<String>?, promise: Promise ->
      executor.execute {
        try {
          val deletedCount = discardRecoverableWavSessions(sessionIds)
          promise.resolve(
            mapOf(
              "deleted" to deletedCount,
            ),
          )
        } catch (e: Exception) {
          promise.reject("ERR_WAV_RECORDING_DISCARD", e.message, e)
        }
      }
    }

    AsyncFunction("getWavInfo") { wavPath: String, promise: Promise ->
      executor.execute {
        try {
          val cleanPath = wavPath.removePrefix("file://")
          val file = File(cleanPath)
          if (!file.exists() || !file.isFile) {
            throw IllegalArgumentException("WAV file does not exist: $cleanPath")
          }
          val info = readWavInfo(file)
          promise.resolve(
            mapOf(
              "sampleRate" to info.sampleRate,
              "numSamples" to info.numSamples.toDouble(),
              "durationMs" to info.durationMs.toDouble(),
            ),
          )
        } catch (e: Exception) {
          promise.reject("ERR_WAV_INFO", e.message, e)
        }
      }
    }

    AsyncFunction("transcribeWav") { wavPath: String, options: Map<String, Any?>?, promise: Promise ->
      executor.execute {
        try {
          val cleanPath = wavPath.removePrefix("file://")
          val file = File(cleanPath)
          if (!file.exists() || !file.isFile) {
            throw IllegalArgumentException("WAV file does not exist: $cleanPath")
          }
          val readMode = (options?.get("wavReadMode") as? String)?.trim()?.lowercase() ?: WAV_READ_MODE_STREAMING
          if (readMode == WAV_READ_MODE_DIRECT) {
            println("[sherpa] transcribeWav mode=direct sizeBytes=${file.length()} path=$cleanPath")
            val waveData = WaveReader.Companion.readWave(cleanPath)
            promise.resolve(transcribeWave(waveData, options))
            return@execute
          }
          println("[sherpa] transcribeWav mode=streaming sizeBytes=${file.length()} path=$cleanPath")
          promise.resolve(transcribeWavStreaming(cleanPath, options))
        } catch (e: Throwable) {
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
        } catch (e: Throwable) {
          promise.reject("ERR_SHERPA_TRANSCRIBE_ASSET", e.message, e)
        }
      }
    }

    AsyncFunction("convertAudioToWav16k") { inputPath: String, outputPath: String, promise: Promise ->
      executor.execute {
        try {
          val input = inputPath.removePrefix("file://")
          val output = outputPath.removePrefix("file://")
          val err = nativeConvertAudioToWav16k(input, output)
          if (err.isBlank()) {
            promise.resolve(mapOf("ok" to true, "outputPath" to output))
          } else {
            promise.reject("ERR_AUDIO_CONVERT", err, null)
          }
        } catch (e: Exception) {
          promise.reject("ERR_AUDIO_CONVERT", e.message, e)
        }
      }
    }

    AsyncFunction("convertAudioToFormat") {
      inputPath: String,
      outputPath: String,
      format: String,
      options: Map<String, Any?>?,
      promise: Promise,
      ->
      executor.execute {
        try {
          val normalizedFormat = normalizeAudioExportFormat(format)
          if (normalizedFormat == null) {
            promise.reject(
              "ERR_AUDIO_CONVERT_FORMAT",
              "Unsupported format: $format. Supported: ${SUPPORTED_AUDIO_EXPORT_FORMATS.joinToString()}",
              null,
            )
            return@execute
          }

          val input = inputPath.removePrefix("file://")
          val output = outputPath.removePrefix("file://")
          val targetSampleRate = options?.getInt("sampleRate") ?: 0
          val targetBitRate = options?.getInt("bitRate") ?: 0
          val targetChannels = options?.getInt("channels") ?: 0
          val targetSampleFormat = options?.getString("sampleFormat")?.trim()?.lowercase()?.ifBlank { null }
          val targetCodec = options?.getString("codec")?.trim()?.ifBlank { null }

          if (targetSampleRate < 0) {
            promise.reject("ERR_AUDIO_CONVERT_FORMAT", "sampleRate must be >= 0", null)
            return@execute
          }
          if (targetBitRate < 0) {
            promise.reject("ERR_AUDIO_CONVERT_FORMAT", "bitRate must be >= 0", null)
            return@execute
          }
          if (targetChannels < 0) {
            promise.reject("ERR_AUDIO_CONVERT_FORMAT", "channels must be >= 0", null)
            return@execute
          }

          val err =
            nativeConvertAudioToFormat(
              input,
              output,
              normalizedFormat,
              targetSampleRate,
              targetBitRate,
              targetChannels,
              targetSampleFormat,
              targetCodec,
            )
          if (err.isBlank()) {
            promise.resolve(
              mapOf(
                "ok" to true,
                "outputPath" to output,
                "format" to normalizedFormat,
                "sampleRate" to targetSampleRate,
                "bitRate" to targetBitRate,
                "channels" to targetChannels,
                "sampleFormat" to (targetSampleFormat ?: ""),
                "codec" to (targetCodec ?: ""),
              ),
            )
          } else {
            promise.reject("ERR_AUDIO_CONVERT_FORMAT", err, null)
          }
        } catch (e: Exception) {
          promise.reject("ERR_AUDIO_CONVERT_FORMAT", e.message, e)
        }
      }
    }

    AsyncFunction("decodeAudioFileToFloatSamples") { inputPath: String, targetSampleRateHz: Double?, promise: Promise ->
      executor.execute {
        try {
          val input = inputPath.removePrefix("file://")
          val targetHz = (targetSampleRateHz ?: 0.0).toInt()
          val result = nativeDecodeAudioFileToFloatSamples(input, targetHz)
          if (result.isEmpty()) {
            promise.reject("ERR_AUDIO_DECODE", "Unexpected decode result", null)
            return@execute
          }
          if (result.size == 1 && result[0] is String) {
            promise.reject("ERR_AUDIO_DECODE", result[0] as String, null)
            return@execute
          }
          if (result.size != 2 || result[0] !is FloatArray || result[1] !is Number) {
            promise.reject("ERR_AUDIO_DECODE", "Unexpected decode payload", null)
            return@execute
          }

          val samples = result[0] as FloatArray
          val sampleRate = (result[1] as Number).toInt()
          val samplesArray = ArrayList<Double>(samples.size)
          for (value in samples) {
            samplesArray.add(value.toDouble())
          }
          promise.resolve(
            mapOf(
              "samples" to samplesArray,
              "sampleRate" to sampleRate,
            ),
          )
        } catch (e: Exception) {
          promise.reject("ERR_AUDIO_DECODE", e.message, e)
        }
      }
    }

    AsyncFunction("getAudioFileInfo") { inputPath: String, promise: Promise ->
      executor.execute {
        try {
          val input = inputPath.removePrefix("file://")
          val result = nativeGetAudioFileInfo(input)
          if (result.isEmpty()) {
            promise.reject("ERR_AUDIO_INFO", "Unexpected audio info result", null)
            return@execute
          }
          if (result.size == 1 && result[0] is String) {
            promise.reject("ERR_AUDIO_INFO", result[0] as String, null)
            return@execute
          }
          if (result.size != 3 || result[0] !is Number || result[1] !is Number || result[2] !is Number) {
            promise.reject("ERR_AUDIO_INFO", "Unexpected audio info payload", null)
            return@execute
          }
          promise.resolve(
            mapOf(
              "sampleRate" to (result[0] as Number).toInt(),
              "channels" to (result[1] as Number).toInt(),
              "durationMs" to (result[2] as Number).toLong().toDouble(),
            ),
          )
        } catch (e: Exception) {
          promise.reject("ERR_AUDIO_INFO", e.message, e)
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

  private fun startRealtimeAsrInternal(options: Map<String, Any?>?) {
    val mode = options?.getString("realtimeMode")?.trim()?.ifBlank { REALTIME_MODE_OFFICIAL_SIMULATED_VAD } ?: REALTIME_MODE_OFFICIAL_SIMULATED_VAD
    val sampleRate = options?.getInt("sampleRate") ?: DEFAULT_SAMPLE_RATE
    val decodeOptions = HashMap<String, Any?>()
    if (options != null) {
      decodeOptions.putAll(options)
    }
    decodeOptions["sampleRate"] = sampleRate
    decodeOptions["enableVad"] = false
    decodeOptions["enableSpeakerDiarization"] = false
    decodeOptions["includeVerboseResult"] = false
    decodeOptions["wavReadMode"] = WAV_READ_MODE_STREAMING

    val vad =
      if (mode == REALTIME_MODE_OFFICIAL_SIMULATED_VAD) {
        createRealtimeVad(options, sampleRate)
      } else {
        null
      }

    synchronized(realtimeLock) {
      activeRealtimeSession?.vad?.release()
      activeRealtimeSession = RealtimeAsrSession(mode = mode, sampleRate = sampleRate, decodeOptions = decodeOptions, vad = vad)
    }
  }

  private fun stopRealtimeAsrInternal() {
    synchronized(realtimeLock) {
      activeRealtimeSession?.vad?.release()
      activeRealtimeSession = null
    }
  }

  private fun appendRealtimeAsrSamplesInternal(samples: FloatArray, sampleRate: Int) {
    if (samples.isEmpty()) {
      return
    }
    synchronized(realtimeLock) {
      val session = activeRealtimeSession ?: return
      if (session.sampleRate != sampleRate) {
        return
      }
      val vad = session.vad
      if (vad == null) {
        val text = decodeRealtimeText(session, samples)
        if (text.isNotBlank()) {
          session.committedText = mergePieceText(session.committedText, text).trim()
          session.updatedAtMs = System.currentTimeMillis()
        }
        return
      }

      session.speechBuffer.addAll(samples.toList())
      while (session.speechOffset + STREAMING_VAD_WINDOW_SIZE_SAMPLES < session.speechBuffer.size) {
        vad.acceptWaveform(
          session.speechBuffer
            .subList(session.speechOffset, session.speechOffset + STREAMING_VAD_WINDOW_SIZE_SAMPLES)
            .toFloatArray(),
        )
        session.speechOffset += STREAMING_VAD_WINDOW_SIZE_SAMPLES
        if (!session.speechStarted && vad.isSpeechDetected()) {
          session.speechStarted = true
          session.speechStartOffset = maxOf(session.speechOffset - STREAMING_SPEECH_START_OFFSET_SAMPLES, 0)
          session.lastPartialDecodeAtMs = 0L
        }
      }

      val nowMs = System.currentTimeMillis()
      if (
        session.speechStarted &&
        session.speechOffset > session.speechStartOffset &&
        nowMs - session.lastPartialDecodeAtMs >= STREAMING_PARTIAL_DECODE_INTERVAL_MS
      ) {
        val partialSamples = session.speechBuffer.subList(session.speechStartOffset, session.speechOffset).toFloatArray()
        val partialText = decodeRealtimeText(session, partialSamples)
        session.partialText = partialText
        session.lastPartialDecodeAtMs = nowMs
        if (partialText.isNotBlank()) {
          session.updatedAtMs = nowMs
        }
      }

      while (!vad.empty()) {
        val segment = vad.front()
        vad.pop()
        val segmentText = decodeRealtimeText(session, segment.samples)
        if (segmentText.isNotBlank()) {
          session.committedText = mergePieceText(session.committedText, segmentText).trim()
          session.updatedAtMs = System.currentTimeMillis()
        }
        session.partialText = ""
        session.speechStarted = false
        session.speechBuffer = arrayListOf()
        session.speechOffset = 0
        session.speechStartOffset = 0
        session.lastPartialDecodeAtMs = 0L
      }
    }
  }

  private fun decodeRealtimeText(session: RealtimeAsrSession, samples: FloatArray): String {
    if (samples.isEmpty()) {
      return ""
    }
    return try {
      val result = transcribeWave(WaveData(samples, session.sampleRate), session.decodeOptions)
      result["text"] as? String ?: ""
    } catch (_: Throwable) {
      ""
    }.trim()
  }

  private fun createRealtimeVad(options: Map<String, Any?>?, sampleRate: Int): Vad? {
    return try {
      val modelContext = resolveModelContext(options)
      val vadModel = options?.getString("vadModel")
      val vadEngine = options?.getString("vadEngine")?.lowercase()
      val vadModelPath = resolveVadModelPath(modelContext, vadModel)
      val normalizedVadPath = vadModelPath.lowercase()
      val resolvedVadEngine =
        when {
          vadEngine == "tenvad" || vadEngine == "silerovad" -> vadEngine
          normalizedVadPath.contains("ten-vad") -> "tenvad"
          normalizedVadPath.contains("silero") -> "silerovad"
          else -> ""
        }
      if (resolvedVadEngine.isBlank()) {
        return null
      }
      val numThreads = options?.getInt("numThreads") ?: resolveDefaultNumThreads()
      val provider = options?.getString("provider") ?: "cpu"
      val debug = options?.getBoolean("debug") ?: false
      val config =
        if (resolvedVadEngine == "tenvad") {
          val tenVadConfig =
            TenVadModelConfig().apply {
              this.model = vadModelPath
              this.threshold = options?.getFloat("vadThreshold") ?: 0.5f
              this.minSilenceDuration = options?.getFloat("vadMinSilenceDuration") ?: 0.5f
              this.minSpeechDuration = options?.getFloat("vadMinSpeechDuration") ?: 0.25f
              this.windowSize = options?.getInt("vadWindowSize") ?: 256
              this.maxSpeechDuration = options?.getFloat("vadMaxSpeechDuration") ?: 20.0f
            }
          VadModelConfig(
            SileroVadModelConfig(),
            tenVadConfig,
            sampleRate,
            numThreads,
            provider,
            debug,
          )
        } else {
          val sileroVadConfig =
            SileroVadModelConfig().apply {
              this.model = vadModelPath
              this.threshold = options?.getFloat("vadThreshold") ?: 0.2f
              this.minSilenceDuration = options?.getFloat("vadMinSilenceDuration") ?: 0.5f
              this.minSpeechDuration = options?.getFloat("vadMinSpeechDuration") ?: 0.2f
              this.windowSize = options?.getInt("vadWindowSize") ?: 512
              this.maxSpeechDuration = options?.getFloat("vadMaxSpeechDuration") ?: 20.0f
            }
          VadModelConfig(
            sileroVadConfig,
            TenVadModelConfig(),
            sampleRate,
            numThreads,
            provider,
            debug,
          )
        }
      Vad(modelContext.assetManager, config)
    } catch (_: Throwable) {
      null
    }
  }

  private fun stopWavRecordingInternal(reason: String, interruptedBySystem: Boolean) {
    if (!wavRecordingRunning) {
      return
    }
    wavStopReason = reason
    wavInterruptedBySystem = interruptedBySystem
    wavRecordingPaused = false
    wavRecordingRunning = false
    try {
      wavAudioRecord?.stop()
    } catch (_: Exception) {
    }
  }

  private fun runWavRecordingLoop(outputFile: File, audioRecord: AudioRecord, sampleRate: Int, sessionDir: File) {
    var localWrittenBytes = 0L
    var chunkIndex = 0
    var chunkWrittenBytes = 0L
    var chunkStartSample = 0L
    var chunkFile: File? = null
    var chunkStream: FileOutputStream? = null
    val targetChunkBytes = maxOf((sampleRate.toLong() * 2L * wavChunkDurationMs.toLong()) / 1000L, MIN_WAV_CHUNK_BYTES)
    val chunksDir = File(sessionDir, DEFAULT_WAV_CHUNKS_DIR)
    chunksDir.mkdirs()

    fun openNewChunk() {
      chunkIndex += 1
      chunkWrittenBytes = 0L
      chunkStartSample = localWrittenBytes / 2L
      chunkFile = File(chunksDir, "chunk-${chunkIndex.toString().padStart(6, '0')}.pcm")
      chunkStream = FileOutputStream(chunkFile!!)
    }

    fun closeCurrentChunk() {
      val stream = chunkStream ?: return
      val file = chunkFile
      stream.flush()
      stream.fd.sync()
      stream.close()
      chunkStream = null
      if (chunkWrittenBytes <= 0L || file == null) {
        file?.delete()
        return
      }

      val endSample = chunkStartSample + (chunkWrittenBytes / 2L)
      synchronized(wavLock) {
        wavChunkList.add(
          WavChunkMeta(
            index = chunkIndex,
            path = file.absolutePath,
            bytes = chunkWrittenBytes,
            startSample = chunkStartSample,
            endSample = endSample,
          ),
        )
        wavWrittenBytes = localWrittenBytes
        persistCurrentWavSessionMeta()
      }
    }

    try {
      audioRecord.startRecording()
      val shortBuffer = ShortArray(DEFAULT_AUDIO_BUFFER_SAMPLES)
      val byteBuffer = ByteArray(DEFAULT_AUDIO_BUFFER_SAMPLES * 2)
      openNewChunk()

      while (wavRecordingRunning) {
        val read = audioRecord.read(shortBuffer, 0, shortBuffer.size, AudioRecord.READ_BLOCKING)
        if (read <= 0) {
          continue
        }

        if (wavRecordingPaused) {
          continue
        }

        val floatSamples = FloatArray(read)
        for (i in 0 until read) {
          floatSamples[i] = shortBuffer[i] / 32768.0f
        }
        appendRealtimeAsrSamplesInternal(floatSamples, sampleRate)

        var offset = 0
        for (i in 0 until read) {
          val sample = shortBuffer[i].toInt()
          byteBuffer[offset] = (sample and 0xFF).toByte()
          byteBuffer[offset + 1] = ((sample shr 8) and 0xFF).toByte()
          offset += 2
        }

        if (chunkStream == null) {
          openNewChunk()
        }
        val stream = chunkStream ?: continue
        stream.write(byteBuffer, 0, offset)
        localWrittenBytes += offset.toLong()
        chunkWrittenBytes += offset.toLong()

        if (chunkWrittenBytes >= targetChunkBytes) {
          closeCurrentChunk()
          openNewChunk()
        }
      }
    } finally {
      try {
        closeCurrentChunk()
      } catch (_: Exception) {
      }

      try {
        audioRecord.stop()
      } catch (_: Exception) {
      }
      audioRecord.release()

      var finalState = SESSION_STATE_FINALIZING
      val finalReason = wavStopReason
      if (wavInterruptedBySystem) {
        finalState = SESSION_STATE_INTERRUPTED
      }

      synchronized(wavLock) {
        wavWrittenBytes = localWrittenBytes
        wavSessionState = finalState
        persistCurrentWavSessionMeta()
      }

      try {
        if (wavChunkList.isNotEmpty()) {
          localWrittenBytes = mergeChunksToWav(outputFile, wavChunkList.toList(), sampleRate)
        }
      } catch (_: Exception) {
        finalState = SESSION_STATE_INTERRUPTED
      }

      synchronized(wavLock) {
        wavWrittenBytes = localWrittenBytes
        wavSessionState =
          if (finalState == SESSION_STATE_INTERRUPTED) {
            SESSION_STATE_INTERRUPTED
          } else {
            SESSION_STATE_COMPLETED
          }
        wavStopReason = finalReason
        persistCurrentWavSessionMeta()
      }

      if (finalState != SESSION_STATE_INTERRUPTED) {
        try {
          cleanupWavSessionCache(sessionDir, outputFile.absolutePath)
        } catch (_: Exception) {
        }
      }

      abandonWavAudioFocus()
      wavAudioRecord = null
      wavRecordingPaused = false
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

  private fun readWavInfo(file: File): WavInfo {
    val fileSize = file.length()
    if (fileSize <= WAV_HEADER_SIZE) {
      return WavInfo(sampleRate = DEFAULT_SAMPLE_RATE, numSamples = 0L, durationMs = 0L)
    }

    var sampleRate = DEFAULT_SAMPLE_RATE
    var bitsPerSample = 16
    var dataSize = fileSize - WAV_HEADER_SIZE
    RandomAccessFile(file, "r").use { raf ->
      if (raf.length() >= WAV_HEADER_SIZE) {
        raf.seek(24)
        sampleRate = Integer.reverseBytes(raf.readInt())
        raf.seek(34)
        bitsPerSample = java.lang.Short.reverseBytes(raf.readShort()).toInt()
        raf.seek(40)
        dataSize = Integer.reverseBytes(raf.readInt()).toLong() and 0xFFFFFFFFL
      }
    }

    val bytesPerSample = when {
      bitsPerSample <= 8 -> 1L
      bitsPerSample <= 16 -> 2L
      else -> 4L
    }
    val safeSampleRate = if (sampleRate > 0) sampleRate else DEFAULT_SAMPLE_RATE
    val numSamples = maxOf(dataSize / bytesPerSample, 0L)
    val durationMs = ((numSamples.toDouble() / safeSampleRate.toDouble()) * 1000.0).toLong()
    return WavInfo(sampleRate = safeSampleRate, numSamples = numSamples, durationMs = durationMs)
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

  private fun resolveWavRecordingSessionsRoot(): File {
    val context = appContext.reactContext ?: throw IllegalStateException("React context is not available")
    val root = File(context.filesDir, DEFAULT_WAV_RECORDING_SESSIONS_SUBDIR)
    if (!root.exists()) {
      root.mkdirs()
    }
    if (!root.exists() || !root.isDirectory) {
      throw IllegalStateException("Unable to create wav recording sessions root: ${root.absolutePath}")
    }
    return root
  }

  private fun createWavSessionDir(sessionId: String): File {
    val root = resolveWavRecordingSessionsRoot()
    val sessionDir = File(root, sessionId)
    if (!sessionDir.exists()) {
      sessionDir.mkdirs()
    }
    val chunksDir = File(sessionDir, DEFAULT_WAV_CHUNKS_DIR)
    if (!chunksDir.exists()) {
      chunksDir.mkdirs()
    }
    if (!sessionDir.exists() || !sessionDir.isDirectory || !chunksDir.exists() || !chunksDir.isDirectory) {
      throw IllegalStateException("Unable to create wav recording session directory: ${sessionDir.absolutePath}")
    }
    return sessionDir
  }

  private fun persistCurrentWavSessionMeta() {
    val sessionId = wavSessionId ?: return
    val sessionMetaFile = wavSessionMetaFile ?: return
    val outputPath = wavOutputFile?.absolutePath ?: ""
    val snapshot = wavChunkList.toList().sortedBy { it.index }
    writeWavSessionMetaFile(
      metaFile = sessionMetaFile,
      sessionId = sessionId,
      state = wavSessionState,
      reason = wavStopReason,
      outputPath = outputPath,
      sampleRate = wavSampleRate,
      chunkDurationMs = wavChunkDurationMs,
      startedAtMs = wavSessionStartedAtMs,
      totalPcmBytes = wavWrittenBytes,
      interruptedBySystem = wavInterruptedBySystem,
      chunks = snapshot,
    )
  }

  private fun writeWavSessionMetaFile(
    metaFile: File,
    sessionId: String,
    state: String,
    reason: String,
    outputPath: String,
    sampleRate: Int,
    chunkDurationMs: Int,
    startedAtMs: Long,
    totalPcmBytes: Long,
    interruptedBySystem: Boolean,
    chunks: List<WavChunkMeta>,
  ) {
    metaFile.parentFile?.mkdirs()
    val now = System.currentTimeMillis()
    val json =
      JSONObject().apply {
        put("sessionId", sessionId)
        put("state", state)
        put("reason", reason)
        put("outputPath", outputPath)
        put("sampleRate", sampleRate)
        put("chunkDurationMs", chunkDurationMs)
        put("startedAtMs", startedAtMs)
        put("updatedAtMs", now)
        put("totalPcmBytes", totalPcmBytes)
        put("numSamples", totalPcmBytes / 2L)
        put("interruptedBySystem", interruptedBySystem)
        put(
          "chunks",
          JSONArray().apply {
            chunks.forEach { chunk ->
              put(
                JSONObject().apply {
                  put("index", chunk.index)
                  put("path", chunk.path)
                  put("bytes", chunk.bytes)
                  put("startSample", chunk.startSample)
                  put("endSample", chunk.endSample)
                },
              )
            }
          },
        )
      }

    val tmpFile = File(metaFile.parentFile, "${metaFile.name}.tmp")
    FileOutputStream(tmpFile).use { fos ->
      fos.write(json.toString(2).toByteArray(Charsets.UTF_8))
      fos.flush()
      fos.fd.sync()
    }
    if (metaFile.exists()) {
      metaFile.delete()
    }
    if (!tmpFile.renameTo(metaFile)) {
      FileInputStream(tmpFile).use { input ->
        FileOutputStream(metaFile).use { output ->
          val buffer = ByteArray(8192)
          var read = input.read(buffer)
          while (read > 0) {
            output.write(buffer, 0, read)
            read = input.read(buffer)
          }
          output.flush()
          output.fd.sync()
        }
      }
      tmpFile.delete()
    }
  }

  private fun mergeChunksToWav(outputFile: File, chunks: List<WavChunkMeta>, sampleRate: Int): Long {
    if (chunks.isEmpty()) {
      return 0L
    }
    outputFile.parentFile?.mkdirs()
    if (outputFile.exists()) {
      outputFile.delete()
    }

    var totalBytes = 0L
    FileOutputStream(outputFile).use { fos ->
      fos.write(ByteArray(WAV_HEADER_SIZE))
      val buffer = ByteArray(8192)
      chunks.sortedBy { it.index }.forEach { chunk ->
        val chunkFile = File(chunk.path)
        if (!chunkFile.exists() || !chunkFile.isFile) {
          return@forEach
        }
        FileInputStream(chunkFile).use { fis ->
          var read = fis.read(buffer)
          while (read > 0) {
            fos.write(buffer, 0, read)
            totalBytes += read.toLong()
            read = fis.read(buffer)
          }
        }
      }
      fos.flush()
      fos.fd.sync()
    }
    writeWavHeader(outputFile, totalBytes, sampleRate)
    return totalBytes
  }

  private fun collectChunkFiles(sessionDir: File): List<WavChunkMeta> {
    val chunksDir = File(sessionDir, DEFAULT_WAV_CHUNKS_DIR)
    if (!chunksDir.exists() || !chunksDir.isDirectory) {
      return emptyList()
    }
    val files =
      chunksDir
        .listFiles { file -> file.isFile && file.name.endsWith(".pcm") }
        ?.sortedBy { it.name }
        ?: emptyList()

    val out = mutableListOf<WavChunkMeta>()
    var sampleCursor = 0L
    for ((idx, file) in files.withIndex()) {
      val bytes = file.length()
      if (bytes <= 0L) {
        continue
      }
      val startSample = sampleCursor
      val endSample = startSample + bytes / 2L
      sampleCursor = endSample
      out.add(
        WavChunkMeta(
          index = idx + 1,
          path = file.absolutePath,
          bytes = bytes,
          startSample = startSample,
          endSample = endSample,
        ),
      )
    }
    return out
  }

  private fun parseSessionMeta(metaFile: File): JSONObject? {
    return try {
      val content = FileInputStream(metaFile).use { fis ->
        fis.readBytes().toString(Charsets.UTF_8)
      }
      JSONObject(content)
    } catch (_: Exception) {
      null
    }
  }

  private fun collectRecoverableWavSessions(): List<RecoverableWavSession> {
    val root = resolveWavRecordingSessionsRoot()
    if (!root.exists() || !root.isDirectory) {
      return emptyList()
    }

    val candidates = mutableListOf<RecoverableWavSession>()
    val sessionDirs = root.listFiles { file -> file.isDirectory }?.sortedByDescending { it.name } ?: emptyList()
    for (sessionDir in sessionDirs) {
      val metaFile = File(sessionDir, DEFAULT_WAV_SESSION_META_FILE)
      if (!metaFile.exists() || !metaFile.isFile) {
        continue
      }

      val meta = parseSessionMeta(metaFile) ?: continue
      val state = meta.optString("state", SESSION_STATE_IDLE)
      if (state == SESSION_STATE_COMPLETED) {
        continue
      }
      val reason = meta.optString("reason", "")
      val existingOutputPath = meta.optString("outputPath", "")
      if (state == SESSION_STATE_INTERRUPTED && reason == STOP_REASON_RECOVERED_AFTER_RESTART && existingOutputPath.isNotBlank()) {
        val existingOutput = File(existingOutputPath)
        if (existingOutput.exists() && existingOutput.isFile && existingOutput.length() > WAV_HEADER_SIZE) {
          continue
        }
      }

      val sessionId = meta.optString("sessionId", sessionDir.name)
      val sampleRate = meta.optInt("sampleRate", DEFAULT_SAMPLE_RATE)
      val chunkDurationMs = meta.optInt("chunkDurationMs", DEFAULT_WAV_CHUNK_DURATION_MS)
      val startedAtMs = meta.optLong("startedAtMs", 0L)
      val outputPathRaw = meta.optString("outputPath", "")
      val outputPath =
        if (outputPathRaw.isBlank()) {
          File(sessionDir, "recovered-${sessionId}.wav").absolutePath
        } else {
          outputPathRaw
        }

      val chunks = collectChunkFiles(sessionDir)
      if (chunks.isEmpty()) {
        continue
      }

      candidates.add(
        RecoverableWavSession(
          sessionDir = sessionDir,
          metaFile = metaFile,
          sessionId = sessionId,
          outputPath = outputPath,
          sampleRate = sampleRate,
          chunkDurationMs = chunkDurationMs,
          startedAtMs = startedAtMs,
          state = state,
          reason = reason,
          chunks = chunks,
        ),
      )
    }
    return candidates
  }

  private fun listRecoverableWavSessions(): List<Map<String, Any?>> {
    return collectRecoverableWavSessions().map { session ->
      val totalPcmBytes = session.chunks.sumOf { it.bytes }
      mapOf(
        "sessionId" to session.sessionId,
        "outputPath" to session.outputPath,
        "sampleRate" to session.sampleRate,
        "numSamples" to (totalPcmBytes / 2L).toDouble(),
        "numChunks" to session.chunks.size,
        "state" to session.state,
        "reason" to session.reason,
        "startedAtMs" to session.startedAtMs.toDouble(),
      )
    }
  }

  private fun recoverSession(session: RecoverableWavSession): Map<String, Any?>? {
    val outFile = File(session.outputPath)
    val mergedBytes =
      try {
        mergeChunksToWav(outFile, session.chunks, session.sampleRate)
      } catch (_: Exception) {
        return null
      }

    writeWavSessionMetaFile(
      metaFile = session.metaFile,
      sessionId = session.sessionId,
      state = SESSION_STATE_COMPLETED,
      reason = STOP_REASON_RECOVERED_AFTER_RESTART,
      outputPath = outFile.absolutePath,
      sampleRate = session.sampleRate,
      chunkDurationMs = session.chunkDurationMs,
      startedAtMs = session.startedAtMs,
      totalPcmBytes = mergedBytes,
      interruptedBySystem = true,
      chunks = session.chunks,
    )

    try {
      cleanupWavSessionCache(session.sessionDir, outFile.absolutePath)
    } catch (_: Exception) {
    }

    return mapOf(
      "sessionId" to session.sessionId,
      "path" to outFile.absolutePath,
      "sampleRate" to session.sampleRate,
      "numSamples" to (mergedBytes / 2L).toDouble(),
      "state" to SESSION_STATE_INTERRUPTED,
      "reason" to STOP_REASON_RECOVERED_AFTER_RESTART,
    )
  }

  private fun recoverInterruptedWavSessionById(sessionId: String): Map<String, Any?>? {
    if (sessionId.isBlank()) {
      return null
    }
    val target = collectRecoverableWavSessions().firstOrNull { it.sessionId == sessionId } ?: return null
    return recoverSession(target)
  }

  private fun recoverInterruptedWavSessions(): List<Map<String, Any?>> {
    val recovered = mutableListOf<Map<String, Any?>>()
    for (session in collectRecoverableWavSessions()) {
      val result = recoverSession(session) ?: continue
      recovered.add(result)
    }
    return recovered
  }

  private fun discardRecoverableWavSessions(sessionIds: List<String>?): Int {
    val targets =
      if (sessionIds.isNullOrEmpty()) {
        collectRecoverableWavSessions()
      } else {
        val targetIdSet = sessionIds.map { it.trim() }.filter { it.isNotBlank() }.toSet()
        collectRecoverableWavSessions().filter { targetIdSet.contains(it.sessionId) }
      }

    var deleted = 0
    targets.forEach { session ->
      if (session.sessionDir.deleteRecursively()) {
        deleted += 1
      }
    }
    return deleted
  }

  private fun cleanupWavSessionCache(sessionDir: File, keepPath: String?) {
    if (!sessionDir.exists() || !sessionDir.isDirectory) {
      return
    }

    val keepAbsolutePath = keepPath?.let { File(it).absolutePath }
    sessionDir.listFiles()?.forEach { child ->
      if (keepAbsolutePath != null && child.absolutePath == keepAbsolutePath) {
        return@forEach
      }
      if (child.isDirectory) {
        child.deleteRecursively()
      } else {
        child.delete()
      }
    }

    val remaining = sessionDir.listFiles() ?: return
    if (remaining.isEmpty()) {
      sessionDir.delete()
    }
  }

  private fun requestWavAudioFocus() {
    val context = appContext.reactContext ?: return
    val audioManager = context.getSystemService(android.content.Context.AUDIO_SERVICE) as? AudioManager ?: return
    wavAudioManager = audioManager
    audioManager.requestAudioFocus(
      wavAudioFocusChangeListener,
      AudioManager.STREAM_MUSIC,
      AudioManager.AUDIOFOCUS_GAIN_TRANSIENT,
    )
  }

  private fun abandonWavAudioFocus() {
    try {
      wavAudioManager?.abandonAudioFocus(wavAudioFocusChangeListener)
    } catch (_: Exception) {
    } finally {
      wavAudioManager = null
    }
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

    val modelType = options?.getString("modelType") ?: "paraformer"
    if (modelType != "paraformer" && modelType != "moonshine" && modelType != "funasr_nano" && modelType != "qwen3_asr") {
      throw IllegalArgumentException("Unsupported modelType: $modelType")
    }
    val model = options?.getString("model") ?: "model.int8.onnx"
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
    val convFrontend = options?.getString("convFrontend") ?: "conv_frontend.onnx"
    val maxTotalLen = options?.getInt("maxTotalLen") ?: 4096
    val maxNewTokens = options?.getInt("maxNewTokens") ?: 512
    val temperature = options?.getFloat("temperature") ?: 0f
    val topP = options?.getFloat("topP") ?: 1f
    val seed = options?.getInt("seed") ?: 0
    val hotwords = options?.getString("hotwords") ?: ""
    val tokens = options?.getString("tokens")

    val sampleRate = options?.getInt("sampleRate") ?: DEFAULT_SAMPLE_RATE
    val featureDim = options?.getInt("featureDim") ?: DEFAULT_FEATURE_DIM
    val numThreads = options?.getInt("numThreads") ?: resolveDefaultNumThreads()
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
    val vadEngine = options?.getString("vadEngine")?.lowercase()
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
    var resolvedQwen3ConvFrontendPath = ""
    var resolvedQwen3EncoderPath = ""
    var resolvedQwen3DecoderPath = ""
    var resolvedQwen3TokenizerDirPath = ""

    val modelConfig = OfflineModelConfig().apply {
      resolvedTokensPath =
        if (!tokens.isNullOrBlank()) {
          modelContext.resolveModelPath(tokens)
        } else if (modelType == "funasr_nano" || modelType == "qwen3_asr") {
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
      "paraformer" -> {
        resolvedEncoderPath = modelContext.resolveModelPath(model)
        modelConfig.paraformer = OfflineParaformerModelConfig().apply {
          this.model = resolvedEncoderPath
        }
        modelConfig.modelType = "paraformer"
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
      "qwen3_asr" -> {
        val tokenizerDir =
          if (tokenizer.endsWith(".json")) {
            File(tokenizer).parent ?: tokenizer
          } else {
            tokenizer
          }
        resolvedQwen3ConvFrontendPath = modelContext.resolveModelPath(convFrontend)
        resolvedQwen3EncoderPath = modelContext.resolveModelPath(encoder)
        resolvedQwen3DecoderPath = modelContext.resolveModelPath(decoder)
        resolvedQwen3TokenizerDirPath = modelContext.resolveModelPath(tokenizerDir)
        modelConfig.qwen3Asr = OfflineQwen3AsrModelConfig().apply {
          this.convFrontend = resolvedQwen3ConvFrontendPath
          this.encoder = resolvedQwen3EncoderPath
          this.decoder = resolvedQwen3DecoderPath
          this.tokenizer = resolvedQwen3TokenizerDirPath
          this.maxTotalLen = maxTotalLen
          this.maxNewTokens = maxNewTokens
          this.temperature = temperature
          this.topP = topP
          this.seed = seed
          this.hotwords = hotwords
        }
        modelConfig.modelType = "qwen3_asr"
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
      "paraformer" -> {
        ensureModelPathReadable(modelContext, resolvedTokensPath, "tokens")
        ensureModelPathReadable(modelContext, resolvedEncoderPath, "model")
      }
      "funasr_nano" -> {
        ensureModelPathReadable(modelContext, resolvedEncoderAdaptorPath, "encoderAdaptor")
        ensureModelPathReadable(modelContext, resolvedLlmPath, "llm")
        ensureModelPathReadable(modelContext, resolvedEmbeddingPath, "embedding")
        ensureModelPathReadable(modelContext, "$resolvedTokenizerDirPath/tokenizer.json", "tokenizer")
      }
      "qwen3_asr" -> {
        ensureModelPathReadable(modelContext, resolvedQwen3ConvFrontendPath, "convFrontend")
        ensureModelPathReadable(modelContext, resolvedQwen3EncoderPath, "encoder")
        ensureModelPathReadable(modelContext, resolvedQwen3DecoderPath, "decoder")
        ensureModelPathReadable(modelContext, "$resolvedQwen3TokenizerDirPath/tokenizer_config.json", "tokenizerConfig")
        ensureModelPathReadable(modelContext, "$resolvedQwen3TokenizerDirPath/vocab.json", "tokenizerVocab")
        ensureModelPathReadable(modelContext, "$resolvedQwen3TokenizerDirPath/merges.txt", "tokenizerMerges")
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
          qwen3ConvFrontendPath = resolvedQwen3ConvFrontendPath,
          qwen3EncoderPath = resolvedQwen3EncoderPath,
          qwen3DecoderPath = resolvedQwen3DecoderPath,
          qwen3TokenizerDirPath = resolvedQwen3TokenizerDirPath,
          qwen3MaxTotalLen = maxTotalLen,
          qwen3MaxNewTokens = maxNewTokens,
          qwen3Temperature = temperature,
          qwen3TopP = topP,
          qwen3Seed = seed,
          qwen3Hotwords = hotwords,
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
          val resolvedVadEngine =
            when {
              vadEngine == "tenvad" || vadEngine == "silerovad" -> vadEngine
              normalizedVadPath.contains("ten-vad") -> "tenvad"
              normalizedVadPath.contains("silero") -> "silerovad"
              else -> ""
            }
          if (resolvedVadEngine.isBlank()) {
            println("[sherpa] Unsupported offline VAD model file: $vadModelPath. Fallback without VAD.")
            vad = null
          } else {
            val vadModelConfig: VadModelConfig
            if (resolvedVadEngine == "tenvad") {
              val vadThreshold = options?.getFloat("vadThreshold") ?: 0.5f
              val vadMinSilenceDuration = options?.getFloat("vadMinSilenceDuration") ?: 0.5f
              val vadMinSpeechDuration = options?.getFloat("vadMinSpeechDuration") ?: 0.25f
              val vadWindowSize = options?.getInt("vadWindowSize") ?: 256
              val vadMaxSpeechDuration = options?.getFloat("vadMaxSpeechDuration") ?: 20.0f
              val tenVadConfig = TenVadModelConfig().apply {
                this.model = vadModelPath
                this.threshold = vadThreshold
                this.minSilenceDuration = vadMinSilenceDuration
                this.minSpeechDuration = vadMinSpeechDuration
                this.windowSize = vadWindowSize
                this.maxSpeechDuration = vadMaxSpeechDuration
              }
              vadModelConfig =
                VadModelConfig(
                  SileroVadModelConfig(),
                  tenVadConfig,
                  sampleRate,
                  numThreads,
                  provider,
                  debug,
                )
            } else {
              val vadThreshold = options?.getFloat("vadThreshold") ?: 0.2f
              val vadMinSilenceDuration = options?.getFloat("vadMinSilenceDuration") ?: 0.5f
              val vadMinSpeechDuration = options?.getFloat("vadMinSpeechDuration") ?: 0.2f
              val vadWindowSize = options?.getInt("vadWindowSize") ?: 512
              val vadMaxSpeechDuration = options?.getFloat("vadMaxSpeechDuration") ?: 20.0f
              val vadNegThreshold = options?.getFloat("vadNegThreshold") ?: -1.0f
              val sileroVadConfig = SileroVadModelConfig().apply {
                this.model = vadModelPath
                this.threshold = vadThreshold
                this.minSilenceDuration = vadMinSilenceDuration
                this.minSpeechDuration = vadMinSpeechDuration
                this.windowSize = vadWindowSize
                this.maxSpeechDuration = vadMaxSpeechDuration
              }
              vadModelConfig =
                VadModelConfig(
                  sileroVadConfig,
                  TenVadModelConfig(),
                  sampleRate,
                  numThreads,
                  provider,
                  debug,
                )
              if (vadNegThreshold != -1.0f) {
                println("[sherpa] silerovad neg_threshold is unsupported in current Android binding, ignored: $vadNegThreshold")
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

  private fun transcribeWavStreaming(wavPath: String, options: Map<String, Any?>?): Map<String, Any?> {
    val file = File(wavPath)
    if (!file.exists() || !file.isFile) {
      throw IllegalArgumentException("WAV file does not exist: $wavPath")
    }
    val wavInfo = readWavInfo(file)
    val inputSampleRate = wavInfo.sampleRate

    val modelContext = resolveModelContext(options)

    val modelType = options?.getString("modelType") ?: "paraformer"
    if (modelType != "paraformer" && modelType != "moonshine" && modelType != "funasr_nano" && modelType != "qwen3_asr") {
      throw IllegalArgumentException("Unsupported modelType: $modelType")
    }
    val model = options?.getString("model") ?: "model.int8.onnx"
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
    val convFrontend = options?.getString("convFrontend") ?: "conv_frontend.onnx"
    val maxTotalLen = options?.getInt("maxTotalLen") ?: 4096
    val maxNewTokens = options?.getInt("maxNewTokens") ?: 512
    val temperature = options?.getFloat("temperature") ?: 0f
    val topP = options?.getFloat("topP") ?: 1f
    val seed = options?.getInt("seed") ?: 0
    val hotwords = options?.getString("hotwords") ?: ""
    val tokens = options?.getString("tokens")

    val sampleRate = inputSampleRate
    val existingText = options?.getString("streamingExistingText")?.trim() ?: ""
    val requestedStartOffsetBytes = options?.getLong("streamingStartOffsetBytes")
    val safeStartOffsetBytes =
      when {
        requestedStartOffsetBytes == null -> WAV_HEADER_SIZE.toLong()
        requestedStartOffsetBytes < WAV_HEADER_SIZE.toLong() -> WAV_HEADER_SIZE.toLong()
        requestedStartOffsetBytes > file.length() -> file.length()
        else -> requestedStartOffsetBytes
      }
    val baseProcessedSamples = ((safeStartOffsetBytes - WAV_HEADER_SIZE.toLong()).coerceAtLeast(0L)) / 2L
    val featureDim = options?.getInt("featureDim") ?: DEFAULT_FEATURE_DIM
    val numThreads = options?.getInt("numThreads") ?: resolveDefaultNumThreads()
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
    val vadEngine = options?.getString("vadEngine")?.lowercase()
    val enableVad = options?.getBoolean("enableVad") ?: !vadModel.isNullOrBlank()
    val enableSpeakerDiarization = options?.getBoolean("enableSpeakerDiarization") ?: false
    val includeVerboseResult = options?.getBoolean("includeVerboseResult") ?: false

    // TODO(dev): Add chunk-wise denoise with overlap-add so large files can stay streaming-only.
    if (enableDenoise) {
      throw IllegalArgumentException("Streaming transcribe does not support denoise yet")
    }
    // TODO(dev): Add two-stage speaker diarization (chunk embeddings + global clustering) for streaming mode.
    if (enableSpeakerDiarization) {
      throw IllegalArgumentException("Streaming transcribe does not support speaker diarization yet")
    }

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
    var resolvedQwen3ConvFrontendPath = ""
    var resolvedQwen3EncoderPath = ""
    var resolvedQwen3DecoderPath = ""
    var resolvedQwen3TokenizerDirPath = ""

    val modelConfig = OfflineModelConfig().apply {
      resolvedTokensPath =
        if (!tokens.isNullOrBlank()) {
          modelContext.resolveModelPath(tokens)
        } else if (modelType == "funasr_nano" || modelType == "qwen3_asr") {
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
      "paraformer" -> {
        resolvedEncoderPath = modelContext.resolveModelPath(model)
        modelConfig.paraformer = OfflineParaformerModelConfig().apply {
          this.model = resolvedEncoderPath
        }
        modelConfig.modelType = "paraformer"
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
      "qwen3_asr" -> {
        val tokenizerDir =
          if (tokenizer.endsWith(".json")) {
            File(tokenizer).parent ?: tokenizer
          } else {
            tokenizer
          }
        resolvedQwen3ConvFrontendPath = modelContext.resolveModelPath(convFrontend)
        resolvedQwen3EncoderPath = modelContext.resolveModelPath(encoder)
        resolvedQwen3DecoderPath = modelContext.resolveModelPath(decoder)
        resolvedQwen3TokenizerDirPath = modelContext.resolveModelPath(tokenizerDir)
        modelConfig.qwen3Asr = OfflineQwen3AsrModelConfig().apply {
          this.convFrontend = resolvedQwen3ConvFrontendPath
          this.encoder = resolvedQwen3EncoderPath
          this.decoder = resolvedQwen3DecoderPath
          this.tokenizer = resolvedQwen3TokenizerDirPath
          this.maxTotalLen = maxTotalLen
          this.maxNewTokens = maxNewTokens
          this.temperature = temperature
          this.topP = topP
          this.seed = seed
          this.hotwords = hotwords
        }
        modelConfig.modelType = "qwen3_asr"
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
      "paraformer" -> {
        ensureModelPathReadable(modelContext, resolvedTokensPath, "tokens")
        ensureModelPathReadable(modelContext, resolvedEncoderPath, "model")
      }
      "funasr_nano" -> {
        ensureModelPathReadable(modelContext, resolvedEncoderAdaptorPath, "encoderAdaptor")
        ensureModelPathReadable(modelContext, resolvedLlmPath, "llm")
        ensureModelPathReadable(modelContext, resolvedEmbeddingPath, "embedding")
        ensureModelPathReadable(modelContext, "$resolvedTokenizerDirPath/tokenizer.json", "tokenizer")
      }
      "qwen3_asr" -> {
        ensureModelPathReadable(modelContext, resolvedQwen3ConvFrontendPath, "convFrontend")
        ensureModelPathReadable(modelContext, resolvedQwen3EncoderPath, "encoder")
        ensureModelPathReadable(modelContext, resolvedQwen3DecoderPath, "decoder")
        ensureModelPathReadable(modelContext, "$resolvedQwen3TokenizerDirPath/tokenizer_config.json", "tokenizerConfig")
        ensureModelPathReadable(modelContext, "$resolvedQwen3TokenizerDirPath/vocab.json", "tokenizerVocab")
        ensureModelPathReadable(modelContext, "$resolvedQwen3TokenizerDirPath/merges.txt", "tokenizerMerges")
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
    var punctuation: OfflinePunctuation? = null
    var vad: Vad? = null
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
          qwen3ConvFrontendPath = resolvedQwen3ConvFrontendPath,
          qwen3EncoderPath = resolvedQwen3EncoderPath,
          qwen3DecoderPath = resolvedQwen3DecoderPath,
          qwen3TokenizerDirPath = resolvedQwen3TokenizerDirPath,
          qwen3MaxTotalLen = maxTotalLen,
          qwen3MaxNewTokens = maxNewTokens,
          qwen3Temperature = temperature,
          qwen3TopP = topP,
          qwen3Seed = seed,
          qwen3Hotwords = hotwords,
        )
      recognizer = acquireOfflineRecognizer(recognizerKey, modelContext.assetManager, recognizerConfig)
      if (enablePunctuation && !punctuationModel.isNullOrBlank()) {
        punctuation = createOfflinePunctuation(modelContext, punctuationModel, numThreads, provider, debug)
      }
      if (enableVad) {
        try {
          val vadModelPath = resolveVadModelPath(modelContext, vadModel)
          val normalizedVadPath = vadModelPath.lowercase()
          val resolvedVadEngine =
            when {
              vadEngine == "tenvad" || vadEngine == "silerovad" -> vadEngine
              normalizedVadPath.contains("ten-vad") -> "tenvad"
              normalizedVadPath.contains("silero") -> "silerovad"
              else -> ""
            }
          if (resolvedVadEngine.isBlank()) {
            println("[sherpa] Unsupported offline VAD model file: $vadModelPath. Skip VAD in streaming mode.")
            vad = null
          } else {
            val vadModelConfig: VadModelConfig
            if (resolvedVadEngine == "tenvad") {
              val vadThreshold = options?.getFloat("vadThreshold") ?: 0.5f
              val vadMinSilenceDuration = options?.getFloat("vadMinSilenceDuration") ?: 0.5f
              val vadMinSpeechDuration = options?.getFloat("vadMinSpeechDuration") ?: 0.25f
              val vadWindowSize = options?.getInt("vadWindowSize") ?: 256
              val vadMaxSpeechDuration = options?.getFloat("vadMaxSpeechDuration") ?: 20.0f
              val tenVadConfig = TenVadModelConfig().apply {
                this.model = vadModelPath
                this.threshold = vadThreshold
                this.minSilenceDuration = vadMinSilenceDuration
                this.minSpeechDuration = vadMinSpeechDuration
                this.windowSize = vadWindowSize
                this.maxSpeechDuration = vadMaxSpeechDuration
              }
              vadModelConfig =
                VadModelConfig(
                  SileroVadModelConfig(),
                  tenVadConfig,
                  sampleRate,
                  numThreads,
                  provider,
                  debug,
                )
            } else {
              val vadThreshold = options?.getFloat("vadThreshold") ?: 0.2f
              val vadMinSilenceDuration = options?.getFloat("vadMinSilenceDuration") ?: 0.5f
              val vadMinSpeechDuration = options?.getFloat("vadMinSpeechDuration") ?: 0.2f
              val vadWindowSize = options?.getInt("vadWindowSize") ?: 512
              val vadMaxSpeechDuration = options?.getFloat("vadMaxSpeechDuration") ?: 20.0f
              val sileroVadConfig = SileroVadModelConfig().apply {
                this.model = vadModelPath
                this.threshold = vadThreshold
                this.minSilenceDuration = vadMinSilenceDuration
                this.minSpeechDuration = vadMinSpeechDuration
                this.windowSize = vadWindowSize
                this.maxSpeechDuration = vadMaxSpeechDuration
              }
              vadModelConfig =
                VadModelConfig(
                  sileroVadConfig,
                  TenVadModelConfig(),
                  sampleRate,
                  numThreads,
                  provider,
                  debug,
                )
            }
            vad = Vad(modelContext.assetManager, vadModelConfig)
          }
        } catch (e: Exception) {
          println("[sherpa] Offline VAD initialization failed in streaming mode: ${e.message}")
          vad = null
        }
      }

      if (includeVerboseResult) {
        throw IllegalArgumentException("Streaming chunk mode does not support verbose result yet")
      }

      var totalSamples = 0L
      val startedAtMs = System.currentTimeMillis()
      var lastLoggedPercent = -1
      var committedText = existingText
      var partialText = ""
      var lastChunkResult: OfflineRecognizerResult? = null
      val vadSegments = mutableListOf<Map<String, Any?>>()
      var segmentIndex = 0
      var speechBuffer = arrayListOf<Float>()
      var speechOffset = 0
      var speechStarted = false
      var speechStartOffset = 0
      var lastPartialDecodeAtMs = 0L
      val offlineVadSessionDir =
        if (vad != null) {
          try {
            createOfflineVadSessionDir()
          } catch (_: Exception) {
            null
          }
        } else {
          null
        }

      if (debug) {
        println(
          "[sherpa][streaming] start path=$wavPath sampleRate=$sampleRate estimatedSamples=${wavInfo.numSamples} vadEnabled=${vad != null} startOffsetBytes=$safeStartOffsetBytes",
        )
      }

      RandomAccessFile(file, "r").use { raf ->
        raf.seek(safeStartOffsetBytes)
        val byteBuffer = ByteArray(STREAMING_WAV_READ_BUFFER_BYTES)
        var chunkCount = 0
        while (true) {
          val bytesRead = raf.read(byteBuffer)
          if (bytesRead <= 0) {
            break
          }
          val sampleCount = bytesRead / 2
          if (sampleCount <= 0) {
            continue
          }
          val samples = pcm16LeToFloatSamples(byteBuffer, sampleCount)
          totalSamples += sampleCount.toLong()
          if (debug && wavInfo.numSamples > 0) {
            val progress = ((totalSamples * 100L) / wavInfo.numSamples).toInt().coerceIn(0, 100)
            if (progress >= lastLoggedPercent + STREAMING_LOG_STEP_PERCENT || progress == 100) {
              lastLoggedPercent = progress
              val processedSec = totalSamples.toDouble() / sampleRate.toDouble()
              val estimatedSec = wavInfo.numSamples.toDouble() / sampleRate.toDouble()
              println(
                "[sherpa][streaming] progress=$progress% processedSec=${"%.2f".format(processedSec)} estimatedSec=${"%.2f".format(estimatedSec)}",
              )
            }
          }
          if (vad == null) {
            chunkCount += 1
            if (debug) {
              println("[sherpa][streaming] chunk-decode-start index=$chunkCount samples=${samples.size}")
            }
            val chunkResult = decodeChunkResult(recognizer, samples, sampleRate)
            lastChunkResult = chunkResult
            val chunkText = chunkResult.text.trim()
            if (chunkText.isNotBlank()) {
              committedText = mergePieceText(committedText, chunkText).trim()
            }
            if (debug) {
              println("[sherpa][streaming] chunk-decode-done index=$chunkCount textLength=${chunkText.length}")
            }
            continue
          }

          speechBuffer.addAll(samples.toList())
          while (speechOffset + STREAMING_VAD_WINDOW_SIZE_SAMPLES < speechBuffer.size) {
            vad.acceptWaveform(
              speechBuffer
                .subList(speechOffset, speechOffset + STREAMING_VAD_WINDOW_SIZE_SAMPLES)
                .toFloatArray(),
            )
            speechOffset += STREAMING_VAD_WINDOW_SIZE_SAMPLES
            if (!speechStarted && vad.isSpeechDetected()) {
              speechStarted = true
              speechStartOffset = maxOf(speechOffset - STREAMING_SPEECH_START_OFFSET_SAMPLES, 0)
              lastPartialDecodeAtMs = 0L
            }
          }

          val nowMs = System.currentTimeMillis()
          if (speechStarted && speechOffset > speechStartOffset && nowMs - lastPartialDecodeAtMs >= STREAMING_PARTIAL_DECODE_INTERVAL_MS) {
            val partialSamples = speechBuffer.subList(speechStartOffset, speechOffset).toFloatArray()
            val partialResult = decodeChunkResult(recognizer, partialSamples, sampleRate)
            lastChunkResult = partialResult
            partialText = partialResult.text.trim()
            lastPartialDecodeAtMs = nowMs
          }

          while (!vad.empty()) {
            val segment = vad.front()
            vad.pop()
            segmentIndex += 1
            val segmentFile = offlineVadSessionDir?.let { File(it, "seg-${segmentIndex.toString().padStart(6, '0')}.wav") }
            try {
              if (segmentFile != null) {
                writeFloatSamplesToWav(segmentFile, segment.samples, sampleRate)
              }
            } catch (_: Exception) {
            }
            val segmentResult = decodeChunkResult(recognizer, segment.samples, sampleRate)
            lastChunkResult = segmentResult
            val segmentText = segmentResult.text.trim()
            if (segmentText.isNotBlank()) {
              committedText = mergePieceText(committedText, segmentText).trim()
            }
            partialText = ""

            vadSegments.add(
              mapOf(
                "index" to segmentIndex,
                "path" to (segmentFile?.absolutePath ?: ""),
                "text" to segmentText,
                "numSamples" to segment.samples.size,
                "durationMs" to ((segment.samples.size.toDouble() / sampleRate.toDouble()) * 1000.0),
              ),
            )

            speechStarted = false
            speechBuffer = arrayListOf()
            speechOffset = 0
            speechStartOffset = 0
            lastPartialDecodeAtMs = 0L
          }
        }
      }

      if (vad != null) {
        vad.flush()
        while (!vad.empty()) {
          val segment = vad.front()
          vad.pop()
          segmentIndex += 1
          val segmentFile = offlineVadSessionDir?.let { File(it, "seg-${segmentIndex.toString().padStart(6, '0')}.wav") }
          try {
            if (segmentFile != null) {
              writeFloatSamplesToWav(segmentFile, segment.samples, sampleRate)
            }
          } catch (_: Exception) {
          }
          val segmentResult = decodeChunkResult(recognizer, segment.samples, sampleRate)
          lastChunkResult = segmentResult
          vadSegments.add(
            mapOf(
              "index" to segmentIndex,
              "path" to (segmentFile?.absolutePath ?: ""),
              "text" to segmentResult.text.trim(),
              "numSamples" to segment.samples.size,
              "durationMs" to ((segment.samples.size.toDouble() / sampleRate.toDouble()) * 1000.0),
            ),
          )
          val segmentText = segmentResult.text.trim()
          if (segmentText.isNotBlank()) {
            committedText = mergePieceText(committedText, segmentText).trim()
          }
          partialText = ""
        }
      }

      val mergedText =
        if (partialText.isNotBlank()) {
          mergePieceText(committedText, partialText).trim()
        } else {
          committedText
        }
      if (debug) {
        println("[sherpa][streaming] map-result-start includeVerboseResult=$includeVerboseResult")
      }
      resultMap =
        mapOf(
          "text" to mergedText,
          "tokens" to emptyList<String>(),
          "timestamps" to emptyList<Double>(),
          "durations" to emptyList<Double>(),
          "lang" to (lastChunkResult?.lang ?: ""),
          "emotion" to (lastChunkResult?.emotion ?: ""),
          "event" to (lastChunkResult?.event ?: ""),
          "sampleRate" to sampleRate,
          "numSamples" to (baseProcessedSamples + totalSamples).toDouble(),
        ).toMutableMap()
      if (debug) {
        println("[sherpa][streaming] map-result-done")
      }
      val rawText = resultMap["text"] as? String
      if (!rawText.isNullOrBlank()) {
        if (debug) {
          println("[sherpa][streaming] punctuation-start")
        }
        resultMap["text"] = applyPunctuation(punctuation, rawText)
        if (debug) {
          println("[sherpa][streaming] punctuation-done")
        }
      }
      if (vad != null) {
        resultMap["vadSegments"] = vadSegments
      }
      if (debug) {
        val totalElapsedMs = System.currentTimeMillis() - startedAtMs
        println(
          "[sherpa][streaming] done elapsedMs=$totalElapsedMs totalSamples=$totalSamples textLength=${(resultMap["text"] as? String)?.length ?: 0} vadSegments=${vadSegments.size}",
        )
      }
    } finally {
      punctuation?.release()
      vad?.release()
    }

    return resultMap
  }

  private fun pcm16LeToFloatSamples(buffer: ByteArray, sampleCount: Int): FloatArray {
    val samples = FloatArray(sampleCount)
    var byteIndex = 0
    for (index in 0 until sampleCount) {
      val low = buffer[byteIndex].toInt() and 0xFF
      val high = buffer[byteIndex + 1].toInt()
      val pcm = ((high shl 8) or low).toShort()
      samples[index] = pcm / 32768.0f
      byteIndex += 2
    }
    return samples
  }

  private fun decodeChunkResult(recognizer: OfflineRecognizer, samples: FloatArray, sampleRate: Int): OfflineRecognizerResult {
    var chunkStream: OfflineStream? = null
    try {
      chunkStream = recognizer.createStream()
      chunkStream.acceptWaveform(samples, sampleRate)
      recognizer.decode(chunkStream)
      return recognizer.getResult(chunkStream)
    } finally {
      chunkStream?.release()
    }
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
    qwen3ConvFrontendPath: String,
    qwen3EncoderPath: String,
    qwen3DecoderPath: String,
    qwen3TokenizerDirPath: String,
    qwen3MaxTotalLen: Int,
    qwen3MaxNewTokens: Int,
    qwen3Temperature: Float,
    qwen3TopP: Float,
    qwen3Seed: Int,
    qwen3Hotwords: String,
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
      "qwen3ConvFrontend=$qwen3ConvFrontendPath",
      "qwen3Encoder=$qwen3EncoderPath",
      "qwen3Decoder=$qwen3DecoderPath",
      "qwen3TokenizerDir=$qwen3TokenizerDirPath",
      "qwen3MaxTotalLen=$qwen3MaxTotalLen",
      "qwen3MaxNewTokens=$qwen3MaxNewTokens",
      "qwen3Temperature=$qwen3Temperature",
      "qwen3TopP=$qwen3TopP",
      "qwen3Seed=$qwen3Seed",
      "qwen3Hotwords=$qwen3Hotwords",
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
          OfflineSpeechDenoiserDpdfNetModelConfig(),
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
    return toMap(waveData.sampleRate, waveData.samples.size.toLong(), true)
  }

  private fun OfflineRecognizerResult.toMap(sampleRate: Int, numSamples: Long, includeVerboseResult: Boolean): Map<String, Any?> {
    return mapOf(
      "text" to text,
      "tokens" to if (includeVerboseResult) tokens.toList() else emptyList<String>(),
      "timestamps" to if (includeVerboseResult) timestamps.map { it.toDouble() } else emptyList<Double>(),
      "durations" to if (includeVerboseResult) durations.map { it.toDouble() } else emptyList<Double>(),
      "lang" to lang,
      "emotion" to emotion,
      "event" to event,
      "sampleRate" to sampleRate,
      "numSamples" to numSamples.toDouble(),
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

  private fun Map<String, Any?>.getLong(key: String): Long? {
    val value = this[key]
    return when (value) {
      is Long -> value
      is Int -> value.toLong()
      is Double -> value.toLong()
      is Float -> value.toLong()
      else -> null
    }
  }

  private fun resolveDefaultNumThreads(): Int {
    val cores = Runtime.getRuntime().availableProcessors().coerceAtLeast(1)
    val activityManager = appContext.reactContext?.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
    val isLowRamDevice = activityManager?.isLowRamDevice ?: false
    return computeRecommendedNumThreads(cores, isLowRamDevice)
  }

  private fun computeRecommendedNumThreads(cores: Int, isLowRamDevice: Boolean): Int {
    // High-tier: enough CPU cores and not low-RAM device -> 4 threads.
    // Otherwise keep 2 threads to reduce contention/thermal pressure on low-tier devices.
    return if (!isLowRamDevice && cores >= 8) 4 else 2
  }

  private fun normalizeAudioExportFormat(format: String): String? {
    val normalized = format.trim().lowercase()
    if (normalized.isBlank()) {
      return null
    }
    return when (normalized) {
      "ogg" -> "oggm"
      in SUPPORTED_AUDIO_EXPORT_FORMATS -> normalized
      else -> null
    }
  }

  private fun checkNnapiSupport(): ProviderCheckResult {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
      return ProviderCheckResult(false, "Android 版本低于 9（API 28）")
    }
    val reactContext = appContext.reactContext ?: return ProviderCheckResult(false, "React context 不可用")
    val pm: PackageManager = reactContext.packageManager ?: return ProviderCheckResult(false, "PackageManager 不可用")
    if (!pm.hasSystemFeature("android.hardware.neuralnetworks")) {
      return ProviderCheckResult(false, "系统未声明 android.hardware.neuralnetworks 特性")
    }
    return ProviderCheckResult(true, "ok")
  }

  private fun checkXnnpackSupport(): ProviderCheckResult {
    val abiSet = Build.SUPPORTED_ABIS.map { it.lowercase() }.toSet()
    if (abiSet.isEmpty()) {
      return ProviderCheckResult(false, "设备 ABI 列表为空")
    }

    val hasSupportedAbi =
      abiSet.any { abi ->
        abi == "arm64-v8a" || abi == "armeabi-v7a" || abi == "x86_64" || abi == "x86"
      }
    if (!hasSupportedAbi) {
      return ProviderCheckResult(false, "当前 ABI 不在 XNNPACK 支持列表")
    }

    // ORT CPU runtime must exist; otherwise xnnpack cannot be used.
    if (!isBundledNativeLibraryAvailable("libonnxruntime.so")) {
      return ProviderCheckResult(false, "缺少 libonnxruntime.so")
    }
    return ProviderCheckResult(true, "ok")
  }

  private fun buildProviderListForSelfCheck(): List<String> {
    val providers = mutableListOf<String>()
    if (checkNnapiSupport().supported) {
      providers.add("nnapi")
    }
    if (checkXnnpackSupport().supported) {
      providers.add("xnnpack")
    }
    providers.add("cpu")
    return providers
  }

  private fun isBundledNativeLibraryAvailable(libName: String): Boolean {
    synchronized(nativeLibProbeLock) {
      nativeLibProbeCache[libName]?.let { return it }
    }
    val result = hasNativeLibraryInNativeLibDir(libName) || hasNativeLibraryInApk(libName)
    synchronized(nativeLibProbeLock) {
      nativeLibProbeCache[libName] = result
    }
    return result
  }

  private fun hasNativeLibraryInNativeLibDir(libName: String): Boolean {
    val nativeLibDirPath = appContext.reactContext?.applicationInfo?.nativeLibraryDir ?: return false
    val nativeLibDir = File(nativeLibDirPath)
    if (!nativeLibDir.exists() || !nativeLibDir.isDirectory) {
      return false
    }
    return File(nativeLibDir, libName).exists()
  }

  private fun hasNativeLibraryInApk(libName: String): Boolean {
    val appInfo = appContext.reactContext?.applicationInfo ?: return false
    val apkPaths = mutableListOf<String>()
    appInfo.sourceDir?.takeIf { it.isNotBlank() }?.let { apkPaths.add(it) }
    appInfo.splitSourceDirs?.forEach { splitPath ->
      if (!splitPath.isNullOrBlank()) {
        apkPaths.add(splitPath)
      }
    }
    if (apkPaths.isEmpty()) {
      return false
    }
    for (apkPath in apkPaths) {
      try {
        ZipFile(apkPath).use { zipFile ->
          for (abi in Build.SUPPORTED_ABIS) {
            val entryName = "lib/${abi}/${libName}"
            if (zipFile.getEntry(entryName) != null) {
              return true
            }
          }
        }
      } catch (_: Throwable) {
        // ignore broken/unsupported split, continue scanning next apk
      }
    }
    return false
  }

  companion object {
    private const val DEFAULT_MODEL_DIR_ASSET = "sherpa/asr/zh"
    private const val DEFAULT_SAMPLE_RATE = 16000
    private const val DEFAULT_FEATURE_DIM = 80
    private const val DEFAULT_AUDIO_BUFFER_SAMPLES = 512
    private const val WAV_READ_MODE_STREAMING = "streaming"
    private const val WAV_READ_MODE_DIRECT = "direct"
    private const val REALTIME_MODE_DISABLED = "disabled"
    private const val REALTIME_MODE_OFFICIAL_SIMULATED_VAD = "official_simulated_vad"
    private const val STREAMING_WAV_READ_BUFFER_BYTES = 4 * 1024 * 1024
    private const val STREAMING_LOG_STEP_PERCENT = 5
    private const val STREAMING_VAD_WINDOW_SIZE_SAMPLES = 512
    private const val STREAMING_PARTIAL_DECODE_INTERVAL_MS = 200L
    private const val STREAMING_SPEECH_START_OFFSET_SAMPLES = 6400
    private const val WAV_HEADER_SIZE = 44
    private const val DEFAULT_VAD_MODEL_ASSET = "sherpa/onnx/ten-vad.onnx"
    private const val DEFAULT_RUNTIME_VAD_SUBDIR = "sherpa/vad"
    private const val DEFAULT_OFFLINE_VAD_SEGMENTS_SUBDIR = "sherpa/offline-vad-segments"
    private const val DEFAULT_SPEAKER_SEGMENTATION_MODEL_ASSET = "sherpa/onnx/speaker-diarization.onnx"
    private const val DEFAULT_SPEAKER_EMBEDDING_MODEL_ASSET = "sherpa/onnx/speaker-recognition.onnx"
    private const val DEFAULT_WAV_RECORDING_SESSIONS_SUBDIR = "sherpa/wav-recordings/sessions"
    private const val DEFAULT_WAV_CHUNKS_DIR = "chunks"
    private const val DEFAULT_WAV_SESSION_META_FILE = "session.meta.json"
    private const val DEFAULT_WAV_CHUNK_DURATION_MS = 1000
    private const val MIN_WAV_CHUNK_BYTES = 2048L
    private const val SESSION_STATE_IDLE = "IDLE"
    private const val SESSION_STATE_RECORDING = "RECORDING"
    private const val SESSION_STATE_FINALIZING = "FINALIZING"
    private const val SESSION_STATE_COMPLETED = "COMPLETED"
    private const val SESSION_STATE_INTERRUPTED = "INTERRUPTED"
    private const val STOP_REASON_MANUAL = "manual_stop"
    private const val STOP_REASON_AUDIO_FOCUS_LOSS = "audio_focus_loss"
    private const val STOP_REASON_MODULE_DESTROYED = "module_destroyed"
    private const val STOP_REASON_RECOVERED_AFTER_RESTART = "recovered_after_restart"
    private val SUPPORTED_AUDIO_EXPORT_FORMATS =
      setOf("wav", "wav16k", "mp3", "flac", "m4a", "aac", "opus", "oggm", "webm", "mkv")

    @JvmStatic
    private external fun nativeConvertAudioToWav16k(inputPath: String, outputPath: String): String

    @JvmStatic
    private external fun nativeConvertAudioToFormat(
      inputPath: String,
      outputPath: String,
      format: String,
      outputSampleRateHz: Int,
      outputBitRate: Int,
      outputChannels: Int,
      outputSampleFormat: String?,
      outputCodecName: String?,
    ): String

    @JvmStatic
    private external fun nativeDecodeAudioFileToFloatSamples(inputPath: String, targetSampleRateHz: Int): Array<Any>

    @JvmStatic
    private external fun nativeGetAudioFileInfo(inputPath: String): Array<Any>
  }
}
