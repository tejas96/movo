import ARKit
import SceneKit
import UIKit

/// Draws the building content (route ribbon, pipes, wires, fixtures, labels) with SceneKit under one anchor node.
///
/// JS sends two JSON groups (`scene` for the level, `route` for the path) and one `anchor` matrix
/// (AR world <- building metres). JSON is parsed and geometry is built on a worker queue; the main thread only
/// swaps nodes. Shader modifiers animate the patterns on the GPU at the camera's frame rate.
final class SceneRenderer {
  private let root = SCNNode()
  private let sceneGroup = SCNNode()
  private let routeGroup = SCNNode()
  private var labels: [SCNNode] = []
  private var sceneSerial = 0
  private var routeSerial = 0
  private let queue = DispatchQueue(label: "movo.ar.scene", qos: .userInitiated)

  init(scene: SCNScene) {
    root.isHidden = true
    root.addChildNode(sceneGroup)
    root.addChildNode(routeGroup)
    scene.rootNode.addChildNode(root)
  }

  /// AR world (m) <- building (m). nil hides everything.
  var anchor: simd_float4x4? {
    didSet {
      if let a = anchor {
        root.simdTransform = a
        root.isHidden = false
      } else {
        root.isHidden = true
      }
    }
  }

  func setScene(_ json: String?) {
    sceneSerial += 1
    let serial = sceneSerial
    build(json) { nodes in
      guard serial == self.sceneSerial else { return }
      self.replace(group: self.sceneGroup, with: nodes)
    }
  }

  func setRoute(_ json: String?) {
    routeSerial += 1
    let serial = routeSerial
    build(json) { nodes in
      guard serial == self.routeSerial else { return }
      self.replace(group: self.routeGroup, with: nodes)
    }
  }

  /// Called every frame from the render loop: labels keep a readable size and only the nearest few show.
  func update(pointOfView: SCNNode?) {
    guard let cam = pointOfView?.simdWorldPosition, !root.isHidden else { return }
    var near: [(SCNNode, Float)] = []
    for l in labels {
      let d = simd_length(l.simdWorldPosition - cam)
      if d < 0.3 || d > SceneRenderer.maxLabelDist {
        l.isHidden = true
        continue
      }
      near.append((l, d))
    }
    near.sort { $0.1 < $1.1 }
    for (i, (l, d)) in near.enumerated() {
      if i >= SceneRenderer.maxLabels {
        l.isHidden = true
        continue
      }
      let w = min(max(d * 0.17, 0.24), 1.2)
      l.simdScale = simd_float3(repeating: w)
      l.isHidden = false
    }
  }

  // MARK: build (worker queue)

  private func build(_ json: String?, done: @escaping ([SCNNode]) -> Void) {
    guard let json = json, !json.isEmpty else {
      DispatchQueue.main.async { done([]) }
      return
    }
    queue.async {
      var nodes: [SCNNode] = []
      if let data = json.data(using: .utf8),
         let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
        for m in (root["meshes"] as? [[String: Any]]) ?? [] {
          if let n = self.meshNode(m) { nodes.append(n) }
        }
        for l in (root["labels"] as? [[String: Any]]) ?? [] {
          if let n = self.labelNode(l) { nodes.append(n) }
        }
      }
      DispatchQueue.main.async { done(nodes) }
    }
  }

  private func replace(group: SCNNode, with nodes: [SCNNode]) {
    for c in group.childNodes { c.removeFromParentNode() }
    for n in nodes { group.addChildNode(n) }
    labels = (sceneGroup.childNodes + routeGroup.childNodes).filter { $0.name == "label" }
  }

  private func floats(_ any: Any?) -> [Float] {
    return ((any as? [NSNumber]) ?? []).map { $0.floatValue }
  }

  private func meshNode(_ m: [String: Any]) -> SCNNode? {
    let pos = floats(m["positions"])
    let nrm = floats(m["normals"])
    let par = floats(m["params"])
    let idx = ((m["indices"] as? [NSNumber]) ?? []).map { UInt32(truncatingIfNeeded: $0.intValue) }
    let count = pos.count / 3
    guard count >= 3, idx.count >= 3, nrm.count == pos.count, par.count == count * 2 else { return nil }
    var vertices: [SCNVector3] = []
    var normals: [SCNVector3] = []
    var uv: [CGPoint] = []
    vertices.reserveCapacity(count)
    normals.reserveCapacity(count)
    uv.reserveCapacity(count)
    for i in 0..<count {
      vertices.append(SCNVector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]))
      normals.append(SCNVector3(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]))
      uv.append(CGPoint(x: CGFloat(par[i * 2]), y: CGFloat(par[i * 2 + 1])))
    }
    let element = SCNGeometryElement(indices: idx, primitiveType: .triangles)
    let geo = SCNGeometry(
      sources: [
        SCNGeometrySource(vertices: vertices),
        SCNGeometrySource(normals: normals),
        SCNGeometrySource(textureCoordinates: uv),
      ],
      elements: [element]
    )
    geo.firstMaterial = material(m["style"] as? [String: Any] ?? [:])
    let node = SCNNode(geometry: geo)
    node.name = "mesh"
    return node
  }

  private func material(_ s: [String: Any]) -> SCNMaterial {
    let c = floats(s["color"])
    let g = floats(s["glow"])
    let pattern: Float
    switch s["pattern"] as? String {
    case "chevron": pattern = 1
    case "band": pattern = 2
    case "pulse": pattern = 3
    default: pattern = 0
    }
    let mat = SCNMaterial()
    mat.lightingModel = .constant
    mat.isDoubleSided = true
    mat.blendMode = .alpha
    mat.writesToDepthBuffer = true
    mat.readsFromDepthBuffer = true
    mat.shaderModifiers = [.fragment: SceneRenderer.fragment]
    mat.setValue(NSValue(scnVector4: SCNVector4(c.count > 3 ? c[0] : 1, c.count > 3 ? c[1] : 1, c.count > 3 ? c[2] : 1, c.count > 3 ? c[3] : 1)), forKey: "u_color")
    mat.setValue(NSValue(scnVector3: SCNVector3(g.count > 2 ? g[0] : 1, g.count > 2 ? g[1] : 1, g.count > 2 ? g[2] : 1)), forKey: "u_glow")
    mat.setValue(NSNumber(value: max((s["period"] as? NSNumber)?.floatValue ?? 1, 0.01)), forKey: "u_period")
    mat.setValue(NSNumber(value: (s["speed"] as? NSNumber)?.floatValue ?? 0), forKey: "u_speed")
    mat.setValue(NSNumber(value: pattern), forKey: "u_pattern")
    return mat
  }

  // MARK: labels

  private func labelNode(_ l: [String: Any]) -> SCNNode? {
    guard let text = l["text"] as? String, let p = l["p"] as? [NSNumber], p.count == 3 else { return nil }
    let sub = (l["sub"] as? String).flatMap { $0.isEmpty ? nil : $0 }
    let kind = (l["kind"] as? String) ?? "room"
    let (image, aspect) = SceneRenderer.renderLabel(text: text, sub: sub, kind: kind)
    let plane = SCNPlane(width: 1, height: 1 / aspect)
    let mat = SCNMaterial()
    mat.diffuse.contents = image
    mat.lightingModel = .constant
    mat.isDoubleSided = true
    mat.readsFromDepthBuffer = false
    mat.writesToDepthBuffer = false
    plane.firstMaterial = mat
    let node = SCNNode(geometry: plane)
    node.name = "label"
    node.position = SCNVector3(p[0].floatValue, p[1].floatValue, p[2].floatValue)
    node.constraints = [SCNBillboardConstraint()]
    node.renderingOrder = 100
    node.isHidden = true
    return node
  }

  private static func renderLabel(text: String, sub: String?, kind: String) -> (UIImage, CGFloat) {
    let font = UIFont(name: "Poppins-Medium", size: 42) ?? UIFont.systemFont(ofSize: 42, weight: .medium)
    let subFont = UIFont(name: "Poppins-Medium", size: 28) ?? UIFont.systemFont(ofSize: 28, weight: .medium)
    let dark = kind == "dest"
    let fg = dark ? UIColor(red: 0.08, green: 0.08, blue: 0.08, alpha: 1) : UIColor.white
    let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: fg]
    let subAttrs: [NSAttributedString.Key: Any] = [.font: subFont, .foregroundColor: fg.withAlphaComponent(0.78)]
    let textSize = (text as NSString).size(withAttributes: attrs)
    let subSize = sub.map { ($0 as NSString).size(withAttributes: subAttrs) } ?? .zero
    let padX: CGFloat = 26
    let padY: CGFloat = 16
    let w = max(textSize.width, subSize.width) + padX * 2
    let h = 48 + (sub == nil ? 0 : 34) + padY * 2
    let size = CGSize(width: ceil(w), height: ceil(h))
    let bg: UIColor
    switch kind {
    case "dest": bg = UIColor(red: 0.95, green: 0.6, blue: 0.08, alpha: 0.93)
    case "marker": bg = UIColor(red: 0.16, green: 0.16, blue: 0.19, alpha: 0.84)
    default: bg = UIColor(red: 0.07, green: 0.07, blue: 0.09, alpha: 0.78)
    }
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    let image = UIGraphicsImageRenderer(size: size, format: format).image { _ in
      let r = sub == nil ? size.height / 2 : 26
      bg.setFill()
      UIBezierPath(roundedRect: CGRect(origin: .zero, size: size), cornerRadius: r).fill()
      (text as NSString).draw(at: CGPoint(x: (size.width - textSize.width) / 2, y: padY), withAttributes: attrs)
      if let s = sub {
        (s as NSString).draw(at: CGPoint(x: (size.width - subSize.width) / 2, y: padY + 50), withAttributes: subAttrs)
      }
    }
    return (image, size.width / size.height)
  }

  // MARK: shader

  static let maxLabels = 14
  static let maxLabelDist: Float = 16

  /// Same patterns as the Android GLSL: 1 chevron ribbon, 2 liquid bands, 3 electric pulses, 0 solid with a rim.
  /// Texture coordinate x = distance along the shape, y = lateral coordinate.
  static let fragment = """
    #pragma arguments
    float4 u_color;
    float3 u_glow;
    float u_period;
    float u_speed;
    float u_pattern;
    #pragma transparent
    #pragma body
    float d = _surface.diffuseTexcoord.x;
    float l = _surface.diffuseTexcoord.y;
    float t = scn_frame.time;
    float3 N = normalize(_surface.normal);
    float3 V = normalize(_surface.view);
    float ndv = abs(dot(N, V));
    float rim = pow(1.0 - ndv, 2.0);
    float lit = 0.62 + 0.38 * max(dot(N, normalize(float3(0.25, 0.7, 0.65))), 0.0);
    float3 col = u_color.rgb;
    float a = u_color.a;
    if (u_pattern > 0.5 && u_pattern < 1.5) {
      float ph = fract((d + 0.35 * u_period * abs(l) - u_speed * t) / u_period);
      float band = smoothstep(0.0, 0.06, ph) * (1.0 - smoothstep(0.30, 0.40, ph));
      float edge = 1.0 - smoothstep(0.72, 1.0, abs(l));
      col = mix(col, u_glow, band * 0.9);
      a = a * edge * (0.55 + 0.45 * band);
    } else if (u_pattern > 1.5 && u_pattern < 2.5) {
      float w = 0.5 + 0.5 * sin(6.2831853 * (d - u_speed * t) / u_period);
      col = mix(col * 0.7, u_glow, w * 0.55) * lit + rim * 0.35;
      a = a * (0.8 + 0.2 * w);
    } else if (u_pattern > 2.5) {
      float ph = fract((d - u_speed * t) / u_period);
      float p = smoothstep(0.0, 0.05, ph) * (1.0 - smoothstep(0.05, 0.2, ph));
      float flick = 0.92 + 0.08 * sin(t * 41.0 + d * 7.0);
      col = (mix(col * 0.55, u_glow, p) * lit + rim * 0.3) * flick;
      a = a * (0.7 + 0.3 * p);
    } else {
      col = col * lit + rim * 0.35;
    }
    float fade = 1.0 - smoothstep(5.0, 14.0, length(_surface.position));
    a = a * (0.2 + 0.8 * fade);
    _output.color = float4(col * a, a);
    """
}
