import ARKit
import SceneKit
import UIKit

/// ARKit camera view. Detects the landmark plates (ARReferenceImage) and streams the camera pose to JS.
/// No 3D content is rendered here on purpose: JS projects the building model onto the screen.
@objc(MovoArView)
public class MovoArView: UIView, ARSessionDelegate {
  private let sceneView = ARSCNView()
  private var referenceImages = Set<ARReferenceImage>()
  private var running = false
  private var lastPoseAt: TimeInterval = 0

  @objc public var onPose: (([String: Any]) -> Void)?
  @objc public var onImage: (([String: Any]) -> Void)?
  @objc public var onTrackingState: (([String: Any]) -> Void)?
  @objc public var onError: (([String: Any]) -> Void)?
  @objc public var poseHz: Double = 15

  @objc public var active: Bool = false {
    didSet { if active { start() } else { pause() } }
  }

  @objc public var plates: String? {
    didSet {
      loadPlates()
      if running { start() }
    }
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
    sceneView.automaticallyUpdatesLighting = true
    sceneView.session.delegate = self
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

  private func loadPlates() {
    referenceImages.removeAll()
    guard let json = plates, let data = json.data(using: .utf8),
          let list = (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]] else { return }
    for item in list {
      guard let id = item["id"] as? String,
            let b64 = item["imageBase64"] as? String,
            let width = item["physicalWidthM"] as? Double,
            let imageData = Data(base64Encoded: b64),
            let image = UIImage(data: imageData),
            let cg = image.cgImage else { continue }
      let ref = ARReferenceImage(cg, orientation: .up, physicalWidth: CGFloat(width))
      ref.name = id
      referenceImages.insert(ref)
    }
  }

  // MARK: session

  private func start() {
    guard ARWorldTrackingConfiguration.isSupported else {
      onTrackingState?(["state": "notAvailable", "reason": "arkitUnsupported"])
      return
    }
    let config = ARWorldTrackingConfiguration()
    config.worldAlignment = .gravity
    config.planeDetection = [.horizontal]
    config.detectionImages = referenceImages
    config.maximumNumberOfTrackedImages = 2
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

  // MARK: ARSessionDelegate

  public func session(_ session: ARSession, didUpdate frame: ARFrame) {
    let now = frame.timestamp
    if now - lastPoseAt < 1.0 / max(poseHz, 1) { return }
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
      "tracking": trackingName(camera.trackingState),
    ])
  }

  public func session(_ session: ARSession, didAdd anchors: [ARAnchor]) { emitImages(anchors) }
  public func session(_ session: ARSession, didUpdate anchors: [ARAnchor]) { emitImages(anchors) }

  private func emitImages(_ anchors: [ARAnchor]) {
    for anchor in anchors {
      guard let image = anchor as? ARImageAnchor, let name = image.referenceImage.name else { continue }
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

  /// Column-major 16 floats, same layout as simd and ARCore.
  private func flatten(_ m: simd_float4x4) -> [Float] {
    let c0 = m.columns.0, c1 = m.columns.1, c2 = m.columns.2, c3 = m.columns.3
    return [c0.x, c0.y, c0.z, c0.w, c1.x, c1.y, c1.z, c1.w, c2.x, c2.y, c2.z, c2.w, c3.x, c3.y, c3.z, c3.w]
  }
}
