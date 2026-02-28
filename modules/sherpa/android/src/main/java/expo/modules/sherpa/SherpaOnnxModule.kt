package expo.modules.sherpa

import com.k2fsa.sherpa.onnx.FeatureConfig
import com.k2fsa.sherpa.onnx.OfflineModelConfig
import com.k2fsa.sherpa.onnx.OfflineRecognizer
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig
import com.k2fsa.sherpa.onnx.OfflineRecognizerResult
import com.k2fsa.sherpa.onnx.OfflineStream
import com.k2fsa.sherpa.onnx.OfflineTransducerModelConfig
import com.k2fsa.sherpa.onnx.WaveData
import com.k2fsa.sherpa.onnx.WaveReader
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class SherpaOnnxModule : Module() {
  private val executor: ExecutorService = Executors.newSingleThreadExecutor()

  override fun definition() = ModuleDefinition {
    Name("SherpaOnnx")

    Function("hello") {
      "Sherpa ready"
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
  }

  private fun transcribeWave(waveData: WaveData, options: Map<String, Any?>?): Map<String, Any?> {
    val modelDirAsset = options?.getString("modelDirAsset") ?: DEFAULT_MODEL_DIR_ASSET
    val encoder = options?.getString("encoder") ?: "encoder.int8.onnx"
    val decoder = options?.getString("decoder") ?: "decoder.int8.onnx"
    val joiner = options?.getString("joiner") ?: "joiner.int8.onnx"
    val tokens = options?.getString("tokens") ?: "tokens.txt"

    val sampleRate = options?.getInt("sampleRate") ?: DEFAULT_SAMPLE_RATE
    val featureDim = options?.getInt("featureDim") ?: DEFAULT_FEATURE_DIM
    val numThreads = options?.getInt("numThreads") ?: DEFAULT_NUM_THREADS
    val provider = options?.getString("provider") ?: "cpu"
    val debug = options?.getBoolean("debug") ?: false
    val decodingMethod = options?.getString("decodingMethod") ?: "greedy_search"
    val maxActivePaths = options?.getInt("maxActivePaths") ?: 4
    val blankPenalty = options?.getFloat("blankPenalty") ?: 0f

    val assetManager =
      appContext.reactContext?.assets ?: throw IllegalStateException("React context is not available")

    val transducerConfig =
      OfflineTransducerModelConfig(
        joinAssetPath(modelDirAsset, encoder),
        joinAssetPath(modelDirAsset, decoder),
        joinAssetPath(modelDirAsset, joiner),
      )

    val modelConfig = OfflineModelConfig().apply {
      this.transducer = transducerConfig
      this.tokens = joinAssetPath(modelDirAsset, tokens)
      this.numThreads = numThreads
      this.provider = provider
      this.debug = debug
      this.modelType = "transducer"
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
      recognizer = OfflineRecognizer(assetManager, recognizerConfig)
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

  private fun joinAssetPath(dir: String, name: String): String {
    return if (dir.endsWith("/")) "$dir$name" else "$dir/$name"
  }

  companion object {
    private const val DEFAULT_MODEL_DIR_ASSET = "sherpa/models/zipformer-multi-zh-hans"
    private const val DEFAULT_SAMPLE_RATE = 16000
    private const val DEFAULT_FEATURE_DIM = 80
    private const val DEFAULT_NUM_THREADS = 2
  }
}
