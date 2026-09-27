require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "MovoArNative"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/tejas96/movo"
  s.license      = "UNLICENSED"
  s.authors      = "MOVO"
  s.platforms    = { :ios => "15.1" }
  s.source       = { :git => "https://github.com/tejas96/movo.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.swift_version = "5.9"
  s.frameworks   = "ARKit", "SceneKit", "UIKit"
  s.pod_target_xcconfig = { "DEFINES_MODULE" => "YES" }

  s.dependency "React-Core"
end
