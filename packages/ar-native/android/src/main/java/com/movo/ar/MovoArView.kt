package com.movo.ar

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.util.Base64
import android.util.Log
import android.view.WindowManager
import android.widget.FrameLayout
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import com.google.ar.core.ArCoreApk
import com.google.ar.core.AugmentedImage
import com.google.ar.core.AugmentedImageDatabase
import com.google.ar.core.Config
import com.google.ar.core.Session
import com.google.ar.core.TrackingFailureReason
import com.google.ar.core.TrackingState
import com.google.ar.core.exceptions.CameraNotAvailableException
import org.json.JSONArray
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10

/**
 * ARCore camera view. Renders the camera image, detects landmark plates (Augmented Images), draws the
 * building content ([SceneRenderer]) every frame on the GPU, and streams a low-rate camera pose to JS.
 *
 * Heavy work stays off the UI thread: plate decoding and the image database are built on a worker
 * thread, scene JSON is parsed on a worker thread, and the GL thread only draws.
 */
class MovoArView(private val reactContext: ThemedReactContext) :
  FrameLayout(reactContext), GLSurfaceView.Renderer, LifecycleEventListener, SensorEventListener {

  private class PlateSpec(val id: String, val bitmap: Bitmap, val widthM: Float)

  private val surface = GLSurfaceView(reactContext)
  private val background = BackgroundRenderer()
  private val sceneRenderer = SceneRenderer(reactContext)
  private var session: Session? = null
  @Volatile private var plates: List<PlateSpec> = emptyList()
  @Volatile private var platesJson: String? = null
  private var active = false
  private var installRequested = false
  private var creating = false
  private var viewportChanged = false
  private var viewportWidth = 0
  private var viewportHeight = 0
  private var lastPoseNs = 0L
  private var firstFrameNs = 0L
  private var lastTrackingName = ""

  private val lastImageEmitNs = HashMap<String, Long>()
  private val lastImageMethod = HashMap<String, AugmentedImage.TrackingMethod>()
  private val viewM = FloatArray(16)
  private val projM = FloatArray(16)
  private val poseM = FloatArray(16)
  var poseHz = 4.0

  // compass: where the camera points, degrees clockwise from magnetic north; -1 until the sensor reports
  private val sensorManager = reactContext.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
  private val rotation = FloatArray(9)
  private val remapped = FloatArray(9)
  private val orientation = FloatArray(3)
  @Volatile private var headingDeg = -1.0

  init {
    surface.preserveEGLContextOnPause = true
    surface.setEGLContextClientVersion(2)
    surface.setEGLConfigChooser(8, 8, 8, 8, 16, 0)
    surface.setRenderer(this)
    surface.renderMode = GLSurfaceView.RENDERMODE_CONTINUOUSLY
    addView(surface, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    reactContext.addLifecycleEventListener(this)
  }

  // ---- props ----

  /** Decodes the plate images on a worker thread. Reconfigures a live session once they are ready. */
  fun setPlates(json: String?) {
    if (json == platesJson) return
    platesJson = json
    Thread {
      val list = ArrayList<PlateSpec>()
      if (!json.isNullOrEmpty()) {
        try {
          val arr = JSONArray(json)
          for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            val bytes = Base64.decode(o.getString("imageBase64"), Base64.DEFAULT)
            val bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: continue
            list.add(PlateSpec(o.getString("id"), bmp, o.getDouble("physicalWidthM").toFloat()))
          }
        } catch (e: Exception) {
          emit("onError", mapOf("code" to "plates", "message" to (e.message ?: "bad plates json")))
        }
      }
      plates = list
      val s = session
      if (s != null) {
        // the database must be rebuilt for the new images; do it off the UI thread, then swap in
        val cfg = buildConfig(s, list)
        post {
          val wasResumed = resumed
          if (wasResumed) pause()
          try {
            s.configure(cfg)
          } catch (e: Exception) {
            emit("onError", mapOf("code" to "configure", "message" to (e.message ?: e.javaClass.simpleName)))
          }
          if (wasResumed && active) resume()
        }
      }
    }.start()
  }

  fun setActive(on: Boolean) {
    Log.d(TAG, "setActive($on) attached=$isAttachedToWindow activity=${reactContext.currentActivity != null}")
    active = on
    if (on) resume() else pause()
  }

  fun setAnchor(arr: ReadableArray?) {
    if (arr == null || arr.size() != 16) {
      sceneRenderer.anchor = null
      return
    }
    val m = FloatArray(16)
    for (i in 0 until 16) m[i] = arr.getDouble(i).toFloat()
    sceneRenderer.anchor = m
  }

  fun setScene(json: String?) = sceneRenderer.setScene(json)

  fun setRoute(json: String?) = sceneRenderer.setRoute(json)

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    Log.d(TAG, "onAttachedToWindow active=$active session=${session != null}")
    if (active) post { resume() }
  }

  // ---- session ----

  private var resumed = false

  private fun resume() {
    val activity = reactContext.currentActivity
    if (activity == null) {
      Log.w(TAG, "resume: no activity yet, retrying")
      postDelayed({ if (active) resume() }, 300)
      return
    }
    if (!isAttachedToWindow) {
      Log.d(TAG, "resume: not attached yet, waiting for onAttachedToWindow")
      return
    }
    if (resumed || creating) return
    if (session == null) {
      try {
        when (ArCoreApk.getInstance().requestInstall(activity, !installRequested)) {
          ArCoreApk.InstallStatus.INSTALL_REQUESTED -> {
            installRequested = true
            emit("onTrackingState", mapOf("state" to "notAvailable", "reason" to "arcoreInstallRequested"))
            return
          }
          ArCoreApk.InstallStatus.INSTALLED -> {}
        }
        if (activity.checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
          emit("onError", mapOf("code" to "cameraPermission", "message" to "camera permission not granted"))
          return
        }
      } catch (e: Exception) {
        Log.e(TAG, "ARCore check failed", e)
        emit("onError", mapOf("code" to "arcore", "message" to (e.message ?: e.javaClass.simpleName)))
        emit("onTrackingState", mapOf("state" to "notAvailable", "reason" to e.javaClass.simpleName))
        return
      }
      // Session creation plus the image database take seconds on a budget phone: never on the UI thread.
      creating = true
      emit("onTrackingState", mapOf("state" to "initializing", "reason" to "starting"))
      Thread {
        try {
          val s = Session(activity)
          s.configure(buildConfig(s, plates))
          post {
            session = s
            creating = false
            Log.d(TAG, "session created with ${plates.size} plates")
            if (active) resume()
          }
        } catch (e: Exception) {
          Log.e(TAG, "session create failed", e)
          post { creating = false }
          emit("onError", mapOf("code" to "arcore", "message" to (e.message ?: e.javaClass.simpleName)))
          emit("onTrackingState", mapOf("state" to "notAvailable", "reason" to e.javaClass.simpleName))
        }
      }.start()
      return
    }
    try {
      session?.resume()
      surface.onResume()
      viewportChanged = true
      resumed = true
      sensorManager?.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)?.let {
        sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_UI)
      }
      Log.d(TAG, "session resumed")
      emit("onTrackingState", mapOf("state" to "initializing"))
    } catch (e: CameraNotAvailableException) {
      Log.e(TAG, "camera not available, retrying in 700 ms", e)
      emit("onError", mapOf("code" to "camera", "message" to "camera not available"))
      postDelayed({ if (active) resume() }, 700)
    } catch (e: Exception) {
      Log.e(TAG, "resume failed", e)
      emit("onError", mapOf("code" to "resume", "message" to (e.message ?: e.javaClass.simpleName)))
    }
  }

  /** Builds the session config with the plate database. Slow; call it on a worker thread. */
  private fun buildConfig(s: Session, list: List<PlateSpec>): Config {
    val cfg = Config(s)
    cfg.focusMode = Config.FocusMode.AUTO
    cfg.updateMode = Config.UpdateMode.LATEST_CAMERA_IMAGE
    cfg.planeFindingMode = Config.PlaneFindingMode.DISABLED
    cfg.lightEstimationMode = Config.LightEstimationMode.DISABLED
    val db = AugmentedImageDatabase(s)
    for (p in list) {
      try {
        db.addImage(p.id, p.bitmap, p.widthM)
      } catch (e: Exception) {
        emit("onError", mapOf("code" to "plateImage", "message" to "${p.id}: ${e.message}"))
      }
    }
    cfg.augmentedImageDatabase = db
    return cfg
  }

  private fun pause() {
    if (!resumed) return
    Log.d(TAG, "pause")
    sensorManager?.unregisterListener(this)
    surface.onPause()
    try {
      session?.pause()
    } catch (_: Exception) {}
    resumed = false
    emit("onTrackingState", mapOf("state" to "paused"))
  }

  fun destroy() {
    Log.d(TAG, "destroy")
    active = false
    pause()
    session?.close()
    session = null
    reactContext.removeLifecycleEventListener(this)
  }

  // ---- SensorEventListener (compass) ----

  override fun onSensorChanged(event: SensorEvent) {
    if (event.sensor.type != Sensor.TYPE_ROTATION_VECTOR) return
    SensorManager.getRotationMatrixFromVector(rotation, event.values)
    // the phone is held upright with the back camera looking forward: map the device -Z (camera) axis to "forward"
    SensorManager.remapCoordinateSystem(rotation, SensorManager.AXIS_X, SensorManager.AXIS_Z, remapped)
    SensorManager.getOrientation(remapped, orientation)
    val deg = Math.toDegrees(orientation[0].toDouble())
    headingDeg = (deg + 360.0) % 360.0
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

  // ---- LifecycleEventListener ----

  override fun onHostResume() {
    if (active) resume()
  }

  override fun onHostPause() {
    if (active) pause()
  }

  override fun onHostDestroy() {
    destroy()
  }

  // ---- GLSurfaceView.Renderer (GL thread) ----

  override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
    GLES20.glClearColor(0f, 0f, 0f, 1f)
    background.createOnGlThread()
    sceneRenderer.createOnGlThread()
  }

  override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
    GLES20.glViewport(0, 0, width, height)
    viewportWidth = width
    viewportHeight = height
    viewportChanged = true
  }

  @Suppress("DEPRECATION")
  private fun displayRotation(): Int {
    val wm = reactContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    return wm.defaultDisplay.rotation
  }

  override fun onDrawFrame(gl: GL10?) {
    GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT or GLES20.GL_DEPTH_BUFFER_BIT)
    val s = session ?: return
    if (viewportChanged) {
      s.setDisplayGeometry(displayRotation(), viewportWidth, viewportHeight)
      viewportChanged = false
    }
    s.setCameraTextureName(background.textureId)
    val frame = try {
      s.update()
    } catch (e: Exception) {
      return
    }
    background.draw(frame)
    val camera = frame.camera
    val now = frame.timestamp
    if (firstFrameNs == 0L) firstFrameNs = now

    for (img in frame.getUpdatedTrackables(AugmentedImage::class.java)) {
      if (img.trackingState != TrackingState.TRACKING) continue
      // one event when a plate appears or its tracking method changes, then at most twice a second
      val last = lastImageEmitNs[img.name] ?: 0L
      val methodChanged = lastImageMethod[img.name] != img.trackingMethod
      if (!methodChanged && now - last < 500_000_000L) continue
      lastImageEmitNs[img.name] = now
      lastImageMethod[img.name] = img.trackingMethod
      val m = FloatArray(16)
      img.centerPose.toMatrix(m, 0)
      emit(
        "onImage",
        mapOf(
          "plateId" to img.name,
          "transform" to m.toList(),
          "tracked" to (img.trackingMethod == AugmentedImage.TrackingMethod.FULL_TRACKING),
        ),
      )
    }

    val trackingNow = trackingName(camera.trackingState, camera.trackingFailureReason)
    if (trackingNow != lastTrackingName) {
      lastTrackingName = trackingNow
      emit("onTrackingState", mapOf("state" to trackingNow, "reason" to camera.trackingFailureReason.name))
    }

    if (camera.trackingState == TrackingState.TRACKING) {
      camera.getViewMatrix(viewM, 0)
      camera.getProjectionMatrix(projM, 0, 0.05f, 100f)
      sceneRenderer.draw(viewM, projM, (now - firstFrameNs) / 1e9f)
    }

    if (now - lastPoseNs < (1e9 / poseHz.coerceAtLeast(0.5)).toLong()) return
    lastPoseNs = now
    camera.pose.toMatrix(poseM, 0)
    if (camera.trackingState != TrackingState.TRACKING) {
      camera.getViewMatrix(viewM, 0)
      camera.getProjectionMatrix(projM, 0, 0.05f, 100f)
    }
    emit(
      "onPose",
      mapOf(
        "camera" to poseM.toList(),
        "view" to viewM.toList(),
        "projection" to projM.toList(),
        "width" to viewportWidth,
        "height" to viewportHeight,
        "t" to now / 1e6,
        "heading" to headingDeg,
        "tracking" to trackingNow,
      ),
    )
  }

  private fun trackingName(state: TrackingState, reason: TrackingFailureReason): String =
    when (state) {
      TrackingState.TRACKING -> "normal"
      TrackingState.PAUSED -> if (reason == TrackingFailureReason.NONE) "initializing" else "limited"
      TrackingState.STOPPED -> "notAvailable"
    }

  // ---- events ----

  private class ArEvent(surfaceId: Int, viewId: Int, private val name: String, private val payload: WritableMap) :
    Event<ArEvent>(surfaceId, viewId) {
    override fun getEventName(): String = name
    override fun getEventData(): WritableMap = payload
    override fun canCoalesce(): Boolean = false
  }

  companion object {
    private const val TAG = "MovoAr"
  }

  private fun emit(name: String, body: Map<String, Any?>) {
    val map = Arguments.makeNativeMap(body)
    val dispatcher = UIManagerHelper.getEventDispatcherForReactTag(reactContext, id) ?: return
    dispatcher.dispatchEvent(ArEvent(UIManagerHelper.getSurfaceId(this), id, name, map))
  }
}
