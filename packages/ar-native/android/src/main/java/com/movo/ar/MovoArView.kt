package com.movo.ar

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.util.Base64
import android.util.Log
import android.view.WindowManager
import android.widget.FrameLayout
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
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
 * ARCore camera view. Renders the camera image, detects landmark plates (Augmented Images) and streams
 * the camera pose to JS. No 3D content is drawn natively; JS projects the building model onto the screen.
 */
class MovoArView(private val reactContext: ThemedReactContext) :
  FrameLayout(reactContext), GLSurfaceView.Renderer, LifecycleEventListener {

  private class PlateSpec(val id: String, val bitmap: Bitmap, val widthM: Float)

  private val surface = GLSurfaceView(reactContext)
  private val background = BackgroundRenderer()
  private var session: Session? = null
  private var plates: List<PlateSpec> = emptyList()
  private var active = false
  private var installRequested = false
  private var viewportChanged = false
  private var viewportWidth = 0
  private var viewportHeight = 0
  private var lastPoseNs = 0L
  var poseHz = 15.0

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

  fun setPlates(json: String?) {
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
    session?.let { configure(it) }
  }

  fun setActive(on: Boolean) {
    Log.d(TAG, "setActive($on) attached=$isAttachedToWindow activity=${reactContext.currentActivity != null}")
    active = on
    if (on) resume() else pause()
  }

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
    if (resumed) return
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
        val s = Session(activity)
        configure(s)
        session = s
        Log.d(TAG, "session created with ${plates.size} plates")
      } catch (e: Exception) {
        Log.e(TAG, "session create failed", e)
        emit("onError", mapOf("code" to "arcore", "message" to (e.message ?: e.javaClass.simpleName)))
        emit("onTrackingState", mapOf("state" to "notAvailable", "reason" to e.javaClass.simpleName))
        return
      }
    }
    try {
      session?.resume()
      surface.onResume()
      viewportChanged = true
      resumed = true
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

  private fun configure(s: Session) {
    val cfg = Config(s)
    cfg.focusMode = Config.FocusMode.AUTO
    cfg.updateMode = Config.UpdateMode.LATEST_CAMERA_IMAGE
    cfg.planeFindingMode = Config.PlaneFindingMode.HORIZONTAL
    val db = AugmentedImageDatabase(s)
    for (p in plates) {
      try {
        db.addImage(p.id, p.bitmap, p.widthM)
      } catch (e: Exception) {
        emit("onError", mapOf("code" to "plateImage", "message" to "${p.id}: ${e.message}"))
      }
    }
    cfg.augmentedImageDatabase = db
    s.configure(cfg)
  }

  private fun pause() {
    if (!resumed) return
    Log.d(TAG, "pause")
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

    for (img in frame.getUpdatedTrackables(AugmentedImage::class.java)) {
      if (img.trackingState != TrackingState.TRACKING) continue
      Log.d(TAG, "image ${img.name} method=${img.trackingMethod} extent=${img.extentX}x${img.extentZ}")
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

    val now = frame.timestamp
    if (now - lastPoseNs < (1e9 / poseHz.coerceAtLeast(1.0)).toLong()) return
    lastPoseNs = now
    val pose = FloatArray(16)
    camera.pose.toMatrix(pose, 0)
    val view = FloatArray(16)
    camera.getViewMatrix(view, 0)
    val proj = FloatArray(16)
    camera.getProjectionMatrix(proj, 0, 0.05f, 100f)
    emit(
      "onPose",
      mapOf(
        "camera" to pose.toList(),
        "view" to view.toList(),
        "projection" to proj.toList(),
        "width" to viewportWidth,
        "height" to viewportHeight,
        "t" to now / 1e6,
        "tracking" to trackingName(camera.trackingState, camera.trackingFailureReason),
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
