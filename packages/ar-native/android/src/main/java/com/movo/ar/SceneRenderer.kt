package com.movo.ar

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.opengl.GLES20
import android.opengl.GLUtils
import android.opengl.Matrix
import android.os.Build
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import java.nio.ShortBuffer

/**
 * Draws the building content (route ribbon, pipes, wires, fixtures, labels) on the GPU, in the AR world frame.
 *
 * JS sends two JSON groups (`scene` for the level, `route` for the path) and one `anchor` matrix
 * (AR world <- building metres). Parsing happens on a worker thread; the GL thread only uploads textures
 * and issues draw calls, so the camera image never waits for JS or for JSON.
 *
 * Patterns move with `u_Time`, so pipes flow and wires pulse at the camera's frame rate with zero work in JS.
 */
class SceneRenderer(private val context: Context) {

  private class Style(val color: FloatArray, val glow: FloatArray, val pattern: Int, val period: Float, val speed: Float)

  private class Mesh(
    val style: Style,
    val positions: FloatBuffer,
    val normals: FloatBuffer,
    val params: FloatBuffer,
    val indices: ShortBuffer,
    val count: Int,
  )

  private class Label(val text: String, val sub: String?, val kind: Int, val p: FloatArray) {
    var bitmap: Bitmap? = null
    var texture = 0
    var aspect = 1f
    // scratch, per frame
    var dist = 0f
    val world = FloatArray(4)
    var sx = 0f
    var sy = 0f
    var halfW = 0f
    var halfH = 0f
  }

  private class Group(val meshes: List<Mesh>, val labels: List<Label>)

  @Volatile private var pendingScene: Group? = null
  @Volatile private var pendingRoute: Group? = null
  @Volatile private var sceneSerial = 0
  @Volatile private var routeSerial = 0
  private var scene: Group? = null
  private var route: Group? = null

  /** AR world (m) <- building (m), column-major. null = draw nothing. */
  @Volatile var anchor: FloatArray? = null
    set(value) {
      field = value
      Log.d(TAG, if (value == null) "anchor cleared" else "anchor set, t=(${value[12]}, ${value[13]}, ${value[14]})")
    }

  // ---- content (any thread) ----

  fun setScene(json: String?) {
    val serial = ++sceneSerial
    parseAsync(json) { if (serial == sceneSerial) pendingScene = it }
  }

  fun setRoute(json: String?) {
    val serial = ++routeSerial
    parseAsync(json) { if (serial == routeSerial) pendingRoute = it }
  }

  private fun parseAsync(json: String?, done: (Group) -> Unit) {
    if (json.isNullOrEmpty()) {
      done(Group(emptyList(), emptyList()))
      return
    }
    Thread {
      try {
        done(parse(json))
      } catch (e: Exception) {
        Log.e(TAG, "scene parse failed", e)
        done(Group(emptyList(), emptyList()))
      }
    }.start()
  }

  private fun parse(json: String): Group {
    val root = JSONObject(json)
    val meshes = ArrayList<Mesh>()
    val meshArr = root.optJSONArray("meshes") ?: JSONArray()
    for (i in 0 until meshArr.length()) {
      val o = meshArr.getJSONObject(i)
      val idx = o.getJSONArray("indices")
      if (idx.length() == 0) continue
      val positions = floats(o.getJSONArray("positions"))
      if (positions.capacity() / 3 > 65535) {
        Log.w(TAG, "mesh ${o.optString("id")} has too many vertices, skipped")
        continue
      }
      meshes.add(
        Mesh(
          style = style(o.getJSONObject("style")),
          positions = positions,
          normals = floats(o.getJSONArray("normals")),
          params = floats(o.getJSONArray("params")),
          indices = shorts(idx),
          count = idx.length(),
        ),
      )
    }
    val labels = ArrayList<Label>()
    val labelArr = root.optJSONArray("labels") ?: JSONArray()
    for (i in 0 until labelArr.length()) {
      val o = labelArr.getJSONObject(i)
      val p = o.getJSONArray("p")
      val kind = when (o.optString("kind")) {
        "dest" -> KIND_DEST
        "marker" -> KIND_MARKER
        else -> KIND_ROOM
      }
      val label = Label(o.getString("text"), o.optString("sub").ifEmpty { null }, kind,
        floatArrayOf(p.getDouble(0).toFloat(), p.getDouble(1).toFloat(), p.getDouble(2).toFloat()))
      label.bitmap = renderLabel(label)
      labels.add(label)
    }
    return Group(meshes, labels)
  }

  private fun style(o: JSONObject): Style {
    val c = o.getJSONArray("color")
    val g = o.getJSONArray("glow")
    val pattern = when (o.optString("pattern")) {
      "chevron" -> 1
      "band" -> 2
      "pulse" -> 3
      else -> 0
    }
    return Style(
      floatArrayOf(c.getDouble(0).toFloat(), c.getDouble(1).toFloat(), c.getDouble(2).toFloat(), c.getDouble(3).toFloat()),
      floatArrayOf(g.getDouble(0).toFloat(), g.getDouble(1).toFloat(), g.getDouble(2).toFloat()),
      pattern,
      o.optDouble("period", 1.0).toFloat().coerceAtLeast(0.01f),
      o.optDouble("speed", 0.0).toFloat(),
    )
  }

  private fun floats(a: JSONArray): FloatBuffer {
    val b = ByteBuffer.allocateDirect(a.length() * 4).order(ByteOrder.nativeOrder()).asFloatBuffer()
    for (i in 0 until a.length()) b.put(a.getDouble(i).toFloat())
    b.position(0)
    return b
  }

  private fun shorts(a: JSONArray): ShortBuffer {
    val b = ByteBuffer.allocateDirect(a.length() * 2).order(ByteOrder.nativeOrder()).asShortBuffer()
    for (i in 0 until a.length()) b.put(a.getInt(i).toShort())
    b.position(0)
    return b
  }

  // ---- label bitmaps (worker thread) ----

  private val typeface: Typeface by lazy {
    try {
      val id = context.resources.getIdentifier("poppins_medium", "font", context.packageName)
      if (id != 0 && Build.VERSION.SDK_INT >= 26) context.resources.getFont(id)
      else Typeface.create("sans-serif-medium", Typeface.NORMAL)
    } catch (_: Exception) {
      Typeface.create("sans-serif-medium", Typeface.NORMAL)
    }
  }

  private fun renderLabel(l: Label): Bitmap {
    val text = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      typeface = this@SceneRenderer.typeface
      textSize = 42f
      color = if (l.kind == KIND_DEST) Color.rgb(21, 21, 21) else Color.WHITE
    }
    val sub = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      typeface = this@SceneRenderer.typeface
      textSize = 28f
      color = if (l.kind == KIND_DEST) Color.argb(200, 21, 21, 21) else Color.argb(190, 255, 255, 255)
    }
    val padX = 26f
    val padY = 16f
    val textW = text.measureText(l.text)
    val subW = l.sub?.let { sub.measureText(it) } ?: 0f
    val w = (maxOf(textW, subW) + padX * 2).toInt().coerceAtLeast(8)
    val lineH = 48f
    val subH = if (l.sub != null) 34f else 0f
    val h = (lineH + subH + padY * 2).toInt()
    val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)
    val bg = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = when (l.kind) {
        KIND_DEST -> Color.argb(238, 242, 153, 20)
        KIND_MARKER -> Color.argb(215, 40, 40, 48)
        else -> Color.argb(200, 18, 18, 22)
      }
    }
    val r = if (l.sub != null) 26f else h / 2f
    canvas.drawRoundRect(RectF(0f, 0f, w.toFloat(), h.toFloat()), r, r, bg)
    canvas.drawText(l.text, (w - textW) / 2f, padY + 38f, text)
    l.sub?.let { canvas.drawText(it, (w - subW) / 2f, padY + lineH + 26f, sub) }
    l.aspect = w.toFloat() / h.toFloat()
    return bmp
  }

  // ---- GL thread ----

  private var meshProgram = 0
  private var mAPosition = 0
  private var mANormal = 0
  private var mAParam = 0
  private var mUMvp = 0
  private var mUMv = 0
  private var mUColor = 0
  private var mUGlow = 0
  private var mUPattern = 0
  private var mUPeriod = 0
  private var mUSpeed = 0
  private var mUTime = 0

  private var labelProgram = 0
  private var lAPos = 0
  private var lUVp = 0
  private var lUCenter = 0
  private var lURight = 0
  private var lUUp = 0
  private var lUSize = 0
  private var lUTexture = 0

  private val quad: FloatBuffer =
    ByteBuffer.allocateDirect(8 * 4).order(ByteOrder.nativeOrder()).asFloatBuffer().apply {
      put(floatArrayOf(-0.5f, -0.5f, 0.5f, -0.5f, -0.5f, 0.5f, 0.5f, 0.5f))
      position(0)
    }

  private var proj0 = 1f
  private var proj5 = 1f
  private val mv = FloatArray(16)
  private val mvp = FloatArray(16)
  private val vp = FloatArray(16)
  private val tmp = FloatArray(4)

  fun createOnGlThread() {
    meshProgram = link(MESH_VS, MESH_FS)
    mAPosition = GLES20.glGetAttribLocation(meshProgram, "a_Position")
    mANormal = GLES20.glGetAttribLocation(meshProgram, "a_Normal")
    mAParam = GLES20.glGetAttribLocation(meshProgram, "a_Param")
    mUMvp = GLES20.glGetUniformLocation(meshProgram, "u_MVP")
    mUMv = GLES20.glGetUniformLocation(meshProgram, "u_MV")
    mUColor = GLES20.glGetUniformLocation(meshProgram, "u_Color")
    mUGlow = GLES20.glGetUniformLocation(meshProgram, "u_Glow")
    mUPattern = GLES20.glGetUniformLocation(meshProgram, "u_Pattern")
    mUPeriod = GLES20.glGetUniformLocation(meshProgram, "u_Period")
    mUSpeed = GLES20.glGetUniformLocation(meshProgram, "u_Speed")
    mUTime = GLES20.glGetUniformLocation(meshProgram, "u_Time")

    labelProgram = link(LABEL_VS, LABEL_FS)
    lAPos = GLES20.glGetAttribLocation(labelProgram, "a_Pos")
    lUVp = GLES20.glGetUniformLocation(labelProgram, "u_VP")
    lUCenter = GLES20.glGetUniformLocation(labelProgram, "u_Center")
    lURight = GLES20.glGetUniformLocation(labelProgram, "u_Right")
    lUUp = GLES20.glGetUniformLocation(labelProgram, "u_Up")
    lUSize = GLES20.glGetUniformLocation(labelProgram, "u_Size")
    lUTexture = GLES20.glGetUniformLocation(labelProgram, "u_Texture")
    // the GL context was lost: every texture must be uploaded again
    scene?.labels?.forEach { it.texture = 0 }
    route?.labels?.forEach { it.texture = 0 }
  }

  /** @param view world -> eye. @param proj eye -> clip. @param timeS seconds, monotonic. */
  fun draw(view: FloatArray, proj: FloatArray, timeS: Float) {
    pendingScene?.let {
      Log.d(TAG, "scene: ${it.meshes.size} meshes, ${it.labels.size} labels")
      scene = swap(scene, it)
      pendingScene = null
    }
    pendingRoute?.let {
      Log.d(TAG, "route: ${it.meshes.size} meshes, ${it.labels.size} labels")
      route = swap(route, it)
      pendingRoute = null
    }
    val a = anchor ?: return
    val s = scene
    val r = route
    if ((s == null || (s.meshes.isEmpty() && s.labels.isEmpty())) && (r == null || (r.meshes.isEmpty() && r.labels.isEmpty()))) return

    Matrix.multiplyMM(mv, 0, view, 0, a, 0)
    Matrix.multiplyMM(mvp, 0, proj, 0, mv, 0)
    Matrix.multiplyMM(vp, 0, proj, 0, view, 0)
    proj0 = proj[0]
    proj5 = proj[5]

    GLES20.glEnable(GLES20.GL_BLEND)
    GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA)
    GLES20.glEnable(GLES20.GL_DEPTH_TEST)
    GLES20.glDepthMask(true)
    GLES20.glDisable(GLES20.GL_CULL_FACE)

    GLES20.glUseProgram(meshProgram)
    GLES20.glUniformMatrix4fv(mUMvp, 1, false, mvp, 0)
    GLES20.glUniformMatrix4fv(mUMv, 1, false, mv, 0)
    GLES20.glUniform1f(mUTime, timeS)
    GLES20.glEnableVertexAttribArray(mAPosition)
    GLES20.glEnableVertexAttribArray(mANormal)
    GLES20.glEnableVertexAttribArray(mAParam)
    r?.meshes?.forEach { drawMesh(it) }
    s?.meshes?.forEach { drawMesh(it) }
    GLES20.glDisableVertexAttribArray(mAPosition)
    GLES20.glDisableVertexAttribArray(mANormal)
    GLES20.glDisableVertexAttribArray(mAParam)

    drawLabels(view, a, listOfNotNull(r, s))
    GLES20.glDisable(GLES20.GL_BLEND)
  }

  private fun drawMesh(m: Mesh) {
    val st = m.style
    GLES20.glUniform4fv(mUColor, 1, st.color, 0)
    GLES20.glUniform3fv(mUGlow, 1, st.glow, 0)
    GLES20.glUniform1i(mUPattern, st.pattern)
    GLES20.glUniform1f(mUPeriod, st.period)
    GLES20.glUniform1f(mUSpeed, st.speed)
    m.positions.position(0)
    m.normals.position(0)
    m.params.position(0)
    m.indices.position(0)
    GLES20.glVertexAttribPointer(mAPosition, 3, GLES20.GL_FLOAT, false, 0, m.positions)
    GLES20.glVertexAttribPointer(mANormal, 3, GLES20.GL_FLOAT, false, 0, m.normals)
    GLES20.glVertexAttribPointer(mAParam, 2, GLES20.GL_FLOAT, false, 0, m.params)
    GLES20.glDrawElements(GLES20.GL_TRIANGLES, m.count, GLES20.GL_UNSIGNED_SHORT, m.indices)
  }

  private val visible = ArrayList<Label>(32)
  private val placed = ArrayList<Label>(16)
  private val clip = FloatArray(4)

  private fun drawLabels(view: FloatArray, a: FloatArray, groups: List<Group>) {
    visible.clear()
    for (g in groups) for (l in g.labels) {
      tmp[0] = l.p[0]; tmp[1] = l.p[1]; tmp[2] = l.p[2]; tmp[3] = 1f
      Matrix.multiplyMV(l.world, 0, a, 0, tmp, 0)
      // eye-space depth: row 2 of the view matrix
      val ez = view[2] * l.world[0] + view[6] * l.world[1] + view[10] * l.world[2] + view[14]
      val ex = view[0] * l.world[0] + view[4] * l.world[1] + view[8] * l.world[2] + view[12]
      val ey = view[1] * l.world[0] + view[5] * l.world[1] + view[9] * l.world[2] + view[13]
      val dist = -ez
      if (dist < 0.3f || dist > MAX_LABEL_DIST) continue
      // roughly in front of the camera (within a wide cone)
      if (Math.abs(ex) > dist * 1.6f || Math.abs(ey) > dist * 2.2f) continue
      l.dist = dist
      visible.add(l)
    }
    if (visible.isEmpty()) return
    visible.sortBy { it.dist }
    // nearest first; a label whose pill would cover one already placed is skipped this frame
    placed.clear()
    for (l in visible) {
      if (placed.size >= MAX_LABELS) break
      val w = (l.dist * 0.17f).coerceIn(0.24f, 1.2f)
      tmp[0] = l.world[0]; tmp[1] = l.world[1]; tmp[2] = l.world[2]; tmp[3] = 1f
      Matrix.multiplyMV(clip, 0, vp, 0, tmp, 0)
      if (clip[3] <= 0.001f) continue
      l.sx = clip[0] / clip[3]
      l.sy = clip[1] / clip[3]
      // pill size in NDC: width w metres at distance d under the projection's focal lengths
      l.halfW = (w * 0.5f * proj0 / l.dist) * 1.08f
      l.halfH = (w / l.aspect * 0.5f * proj5 / l.dist) * 1.3f
      var free = true
      for (o in placed) {
        if (Math.abs(o.sx - l.sx) < o.halfW + l.halfW && Math.abs(o.sy - l.sy) < o.halfH + l.halfH) {
          free = false
          break
        }
      }
      if (free) placed.add(l)
    }
    val count = placed.size

    GLES20.glDisable(GLES20.GL_DEPTH_TEST)
    GLES20.glBlendFunc(GLES20.GL_ONE, GLES20.GL_ONE_MINUS_SRC_ALPHA) // bitmaps are premultiplied
    GLES20.glUseProgram(labelProgram)
    GLES20.glUniformMatrix4fv(lUVp, 1, false, vp, 0)
    // camera axes in world space: rows of the rotation part of the view matrix
    GLES20.glUniform3f(lURight, view[0], view[4], view[8])
    GLES20.glUniform3f(lUUp, view[1], view[5], view[9])
    GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
    GLES20.glUniform1i(lUTexture, 0)
    quad.position(0)
    GLES20.glVertexAttribPointer(lAPos, 2, GLES20.GL_FLOAT, false, 0, quad)
    GLES20.glEnableVertexAttribArray(lAPos)
    // far labels first so near ones draw on top
    for (i in count - 1 downTo 0) {
      val l = placed[i]
      if (l.texture == 0) l.texture = upload(l.bitmap ?: continue)
      val w = (l.dist * 0.17f).coerceIn(0.24f, 1.2f)
      GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, l.texture)
      GLES20.glUniform3f(lUCenter, l.world[0], l.world[1], l.world[2])
      GLES20.glUniform2f(lUSize, w, w / l.aspect)
      GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
    }
    GLES20.glDisableVertexAttribArray(lAPos)
    GLES20.glEnable(GLES20.GL_DEPTH_TEST)
    GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA)
  }

  private fun upload(bmp: Bitmap): Int {
    val tex = IntArray(1)
    GLES20.glGenTextures(1, tex, 0)
    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, tex[0])
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
    GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, bmp, 0)
    return tex[0]
  }

  private fun swap(old: Group?, new: Group): Group {
    old?.labels?.forEach {
      if (it.texture != 0) GLES20.glDeleteTextures(1, intArrayOf(it.texture), 0)
      it.texture = 0
    }
    return new
  }

  private fun link(vs: String, fs: String): Int {
    val v = compile(GLES20.GL_VERTEX_SHADER, vs)
    val f = compile(GLES20.GL_FRAGMENT_SHADER, fs)
    val p = GLES20.glCreateProgram()
    GLES20.glAttachShader(p, v)
    GLES20.glAttachShader(p, f)
    GLES20.glLinkProgram(p)
    val ok = IntArray(1)
    GLES20.glGetProgramiv(p, GLES20.GL_LINK_STATUS, ok, 0)
    if (ok[0] == 0) Log.e(TAG, "program link failed: ${GLES20.glGetProgramInfoLog(p)}")
    return p
  }

  private fun compile(type: Int, src: String): Int {
    val s = GLES20.glCreateShader(type)
    GLES20.glShaderSource(s, src)
    GLES20.glCompileShader(s)
    val ok = IntArray(1)
    GLES20.glGetShaderiv(s, GLES20.GL_COMPILE_STATUS, ok, 0)
    if (ok[0] == 0) Log.e(TAG, "shader compile failed: ${GLES20.glGetShaderInfoLog(s)}")
    return s
  }

  companion object {
    private const val TAG = "MovoArScene"
    private const val KIND_ROOM = 0
    private const val KIND_DEST = 1
    private const val KIND_MARKER = 2
    private const val MAX_LABELS = 14
    private const val MAX_LABEL_DIST = 16f

    private const val MESH_VS = """
      uniform mat4 u_MVP;
      uniform mat4 u_MV;
      attribute vec3 a_Position;
      attribute vec3 a_Normal;
      attribute vec2 a_Param;
      varying vec2 v_Param;
      varying vec3 v_NormalEye;
      varying vec3 v_PosEye;
      void main() {
        vec4 pe = u_MV * vec4(a_Position, 1.0);
        v_PosEye = pe.xyz;
        v_NormalEye = normalize(mat3(u_MV[0].xyz, u_MV[1].xyz, u_MV[2].xyz) * a_Normal);
        v_Param = a_Param;
        gl_Position = u_MVP * vec4(a_Position, 1.0);
      }
    """

    /**
     * Pattern 1 chevron: arrows that run forward along the ribbon, soft edges.
     * Pattern 2 band: liquid bands that slide along a tube, lit like a cylinder.
     * Pattern 3 pulse: short bright packets with a faint flicker, for electricity.
     * Pattern 0 solid: plain colour with a rim.
     */
    private const val MESH_FS = """
      precision mediump float;
      uniform vec4 u_Color;
      uniform vec3 u_Glow;
      uniform int u_Pattern;
      uniform float u_Period;
      uniform float u_Speed;
      uniform float u_Time;
      varying vec2 v_Param;
      varying vec3 v_NormalEye;
      varying vec3 v_PosEye;
      void main() {
        float d = v_Param.x;
        float l = v_Param.y;
        vec3 N = normalize(v_NormalEye);
        vec3 V = normalize(-v_PosEye);
        float ndv = abs(dot(N, V));
        float rim = pow(1.0 - ndv, 2.0);
        float lit = 0.62 + 0.38 * max(dot(N, normalize(vec3(0.25, 0.7, 0.65))), 0.0);
        vec3 col = u_Color.rgb;
        float a = u_Color.a;
        if (u_Pattern == 1) {
          float ph = fract((d + 0.35 * u_Period * abs(l) - u_Speed * u_Time) / u_Period);
          float band = smoothstep(0.0, 0.06, ph) * (1.0 - smoothstep(0.30, 0.40, ph));
          float edge = 1.0 - smoothstep(0.72, 1.0, abs(l));
          col = mix(col, u_Glow, band * 0.9);
          a = a * edge * (0.55 + 0.45 * band);
        } else if (u_Pattern == 2) {
          float w = 0.5 + 0.5 * sin(6.2831853 * (d - u_Speed * u_Time) / u_Period);
          col = mix(col * 0.7, u_Glow, w * 0.55) * lit + rim * 0.35;
          a = a * (0.8 + 0.2 * w);
        } else if (u_Pattern == 3) {
          float ph = fract((d - u_Speed * u_Time) / u_Period);
          float p = smoothstep(0.0, 0.05, ph) * (1.0 - smoothstep(0.05, 0.2, ph));
          float flick = 0.92 + 0.08 * sin(u_Time * 41.0 + d * 7.0);
          col = (mix(col * 0.55, u_Glow, p) * lit + rim * 0.3) * flick;
          a = a * (0.7 + 0.3 * p);
        } else {
          col = col * lit + rim * 0.35;
        }
        // far content fades, so a room is not filled with lines seen through the walls
        float fade = 1.0 - smoothstep(5.0, 14.0, length(v_PosEye));
        a = a * (0.2 + 0.8 * fade);
        gl_FragColor = vec4(col, a);
      }
    """

    private const val LABEL_VS = """
      uniform mat4 u_VP;
      uniform vec3 u_Center;
      uniform vec3 u_Right;
      uniform vec3 u_Up;
      uniform vec2 u_Size;
      attribute vec2 a_Pos;
      varying vec2 v_UV;
      void main() {
        vec3 w = u_Center + u_Right * (a_Pos.x * u_Size.x) + u_Up * (a_Pos.y * u_Size.y);
        v_UV = vec2(a_Pos.x + 0.5, 0.5 - a_Pos.y);
        gl_Position = u_VP * vec4(w, 1.0);
      }
    """

    private const val LABEL_FS = """
      precision mediump float;
      uniform sampler2D u_Texture;
      varying vec2 v_UV;
      void main() { gl_FragColor = texture2D(u_Texture, v_UV); }
    """
  }
}
