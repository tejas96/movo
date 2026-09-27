package com.movo.ar

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

/** Legacy view manager (runs through the New Architecture interop layer). JS name: MovoArView. */
class MovoArViewManager : SimpleViewManager<MovoArView>() {
  override fun getName(): String = "MovoArView"

  override fun createViewInstance(reactContext: ThemedReactContext): MovoArView = MovoArView(reactContext)

  @ReactProp(name = "plates")
  fun setPlates(view: MovoArView, plates: String?) {
    view.setPlates(plates)
  }

  @ReactProp(name = "active")
  fun setActive(view: MovoArView, active: Boolean) {
    view.setActive(active)
  }

  @ReactProp(name = "poseHz", defaultDouble = 15.0)
  fun setPoseHz(view: MovoArView, hz: Double) {
    view.poseHz = hz
  }

  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> =
    mutableMapOf(
      "onPose" to mapOf("registrationName" to "onPose"),
      "onImage" to mapOf("registrationName" to "onImage"),
      "onTrackingState" to mapOf("registrationName" to "onTrackingState"),
      "onError" to mapOf("registrationName" to "onError"),
    )

  override fun onDropViewInstance(view: MovoArView) {
    view.destroy()
    super.onDropViewInstance(view)
  }
}
