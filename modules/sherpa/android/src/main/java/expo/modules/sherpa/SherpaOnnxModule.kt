package expo.modules.sherpa

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SherpaOnnxModule : Module() {

  override fun definition() = ModuleDefinition {

    Name("SherpaOnnx")

    Function("hello") {
      "Sherpa ready"
    }

  }
}
