import ARKit
import SceneKit
import UIKit

/// ARKit camera view. Detects the landmark plates (ARReferenceImage), draws the building content with
/// [SceneRenderer] every frame, and streams a low-rate camera pose to JS.
@objc(MovoArView)
public class MovoArView: UIView, ARSessionDelegate, ARSCNViewDelegate {
  private let sceneView = ARSCNView()
  private var content: SceneRenderer!
  private var referenceImages = Set<ARReferenceImage>()
  private var running = false
  private var lastPoseAt: TimeInterval = 0
  private var lastImageAt: [String: TimeInterval] = [:]
  private var lastImageTracked: [String: Bool] = [:]
  private var platesSerial = 0

  @objc public var onPose: (([String: Any]) -> Void)?
  @objc public var onImage: (([String: Any]) -> Void)?
  @objc public var onTrackingState: (([String: Any]) -> Void)?
  @objc public var onError: (([String: Any]) -> Void)?
  @objc public var poseHz: Double = 4

  @objc public var active: Bool = false {
    didSet { if active { start() } else { pause() } }
  }

  @objc public var plates: String? {
    didSet { loadPlates() }
  }

  /// AR world (m) <- building (m), 16 numbers column-major. Empty or wrong length hides the content.
  @objc public var anchor: NSArray? {
    didSet {
      guard let a = anchor as? [NSNumber], a.count == 16 else {
        content.anchor = nil
        return
      }
      let f = a.map { $0.floatValue }
      content.anchor = simd_float4x4(
        simd_float4(f[0], f[1], f[2], f[3]),
        simd_float4(f[4], f[5], f[6], f[7]),
        simd_float4(f[8], f[9], f[10], f[11]),
        simd_float4(f[12], f[13], f[14], f[15])
      )
    }
  }

  @objc public var scene: String? {
    didSet { content.setScene(scene) }
  }

  @objc public var route: String? {
    didSet { content.setRoute(route) }
  }

  public override init(frame: CGRect) {
    super.init(frame: frame)
    setup()
  }

  public required init?(coder: NSCoder) {
    super.init(coder: coder)
    setup()
  }

  private func setup() {
    sceneView.frame = bounds
    sceneView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    sceneView.automaticallyUpdatesLighting = false
    sceneView.rendersCameraGrain = false
    sceneView.scene = SCNScene()
    sceneView.session.delegate = self
    sceneView.delegate = self
    content = SceneRenderer(scene: sceneView.scene)
    addSubview(sceneView)
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    sceneView.frame = bounds
  }

  public override func removeFromSuperview() {
    sceneView.session.pause()
    running = false
    super.removeFromSuperview()
  }

  // MARK: plates

  /// Decodes the plate images off the main thread, then (re)starts the session once.
  private func loadPlates() {
    platesSerial += 1
    let serial = platesSerial
    let json = plates
    DispatchQueue.global(qos: .userInitiated).async {
      var set = Set<ARReferenceImage>()
      if let json = json, let data = json.data(using: .utf8),
         let list = (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]] {
        for item in list {
          guard let id = item["id"] as? String,
                let b64 = item["imageBase64"] as? String,
                let width = item["physicalWidthM"] as? Double,
                let imageData = Data(base64Encoded: b64),
                let image = UIImage(data: imageData),
                let cg = image.cgImage else { continue }
          let ref = ARReferenceImage(cg, orientation: .up, physicalWidth: CGFloat(width))
          ref.name = id
          set.insert(ref)
        }
      }
      DispatchQueue.main.async {
        guard serial == self.platesSerial else { return }
        self.referenceImages = set
        if self.running { self.start() }
      }
    }
  }

  // MARK: session

  private func start() {
    guard ARWorldTrackingConfiguration.isSupported else {
      onTrackingState?(["state": "notAvailable", "reason": "arkitUnsupported"])
      return
    }
    let config = ARWorldTrackingConfiguration()
    // -Z of the AR world points to true north, so the camera's heading can be read from its transform
    config.worldAlignment = .gravityAndHeading
    config.planeDetection = []
    config.isAutoFocusEnabled = true
    config.detectionImages = referenceImages
    config.maximumNumberOfTrackedImages = 1
    sceneView.session.run(config, options: [.resetTracking, .removeExistingAnchors])
    running = true
    onTrackingState?(["state": "initializing"])
  }

  private func pause() {
    guard running else { return }
    sceneView.session.pause()
    running = false
    onTrackingState?(["state": "paused"])
  }

  private func orientation() -> UIInterfaceOrientation {
    return window?.windowScene?.interfaceOrientation ?? .portrait
  }

  // MARK: ARSCNViewDelegate (render thread)

  public func renderer(_ renderer: SCNSceneRenderer, updateAtTime time: TimeInterval) {
    content.update(pointOfView: renderer.pointOfView)
  }

  // MARK: ARSessionDelegate

  public func session(_ session: ARSession, didUpdate frame: ARFrame) {
    let now = frame.timestamp
    if now - lastPoseAt < 1.0 / max(poseHz, 0.5) { return }
    lastPoseAt = now
    let size = sceneView.bounds.size
    guard size.width > 0, size.height > 0 else { return }
    let camera = frame.camera
    let orient = orientation()
    let projection = camera.projectionMatrix(for: orient, viewportSize: size, zNear: 0.05, zFar: 100)
    let view = camera.viewMatrix(for: orient)
    onPose?([
      "camera": flatten(camera.transform),
      "view": flatten(view),
      "projection": flatten(projection),
      "width": size.width,
      "height": size.height,
      "t": now * 1000,
      "heading": heading(camera.transform),
      "tracking": trackingName(camera.trackingState),
    ])
  }

  public func session(_ session: ARSession, didAdd anchors: [ARAnchor]) { emitImages(anchors, force: true) }
  public func session(_ session: ARSession, didUpdate anchors: [ARAnchor]) { emitImages(anchors, force: false) }

  /// One event when a plate appears or its tracked state changes, then at most twice a second.
  private func emitImages(_ anchors: [ARAnchor], force: Bool) {
    let now = Date().timeIntervalSince1970
    for anchor in anchors {
      guard let image = anchor as? ARImageAnchor, let name = image.referenceImage.name else { continue }
      let changed = lastImageTracked[name] != image.isTracked
      if !force && !changed && now - (lastImageAt[name] ?? 0) < 0.5 { continue }
      lastImageAt[name] = now
      lastImageTracked[name] = image.isTracked
      onImage?(["plateId": name, "transform": flatten(image.transform), "tracked": image.isTracked])
    }
  }

  public func session(_ session: ARSession, cameraDidChangeTrackingState camera: ARCamera) {
    onTrackingState?(["state": trackingName(camera.trackingState), "reason": trackingReason(camera.trackingState)])
  }

  public func session(_ session: ARSession, didFailWithError error: Error) {
    onError?(["code": "session", "message": error.localizedDescription])
  }

  public func sessionWasInterrupted(_ session: ARSession) {
    onTrackingState?(["state": "paused", "reason": "interrupted"])
  }

  public func sessionInterruptionEnded(_ session: ARSession) {
    onTrackingState?(["state": "initializing", "reason": "interruptionEnded"])
  }

  // MARK: helpers

  private func trackingName(_ state: ARCamera.TrackingState) -> String {
    switch state {
    case .normal: return "normal"
    case .limited: return "limited"
    case .notAvailable: return "notAvailable"
    }
  }

  private func trackingReason(_ state: ARCamera.TrackingState) -> String {
    switch state {
    case .limited(let reason):
      switch reason {
      case .initializing: return "initializing"
      case .excessiveMotion: return "excessiveMotion"
      case .insufficientFeatures: return "insufficientFeatures"
      case .relocalizing: return "relocalizing"
      @unknown default: return "unknown"
      }
    default: return ""
    }
  }

  /// Where the camera points, degrees clockwise from north, on the ground plane. -1 while not tracking.
  private func heading(_ m: simd_float4x4) -> Double {
    let f = m.columns.2 // camera looks down its -Z axis: forward = -column 2
    let fx = -f.x, fz = -f.z
    if fx * fx + fz * fz < 1e-6 { return -1 }
    let deg = atan2(Double(fx), -Double(fz)) * 180 / .pi
    return (deg + 360).truncatingRemainder(dividingBy: 360)
  }

  /// Column-major 16 floats, same layout as simd and ARCore.
  private func flatten(_ m: simd_float4x4) -> [Float] {
    let c0 = m.columns.0, c1 = m.columns.1, c2 = m.columns.2, c3 = m.columns.3
    return [c0.x, c0.y, c0.z, c0.w, c1.x, c1.y, c1.z, c1.w, c2.x, c2.y, c2.z, c2.w, c3.x, c3.y, c3.z, c3.w]
  }
}
