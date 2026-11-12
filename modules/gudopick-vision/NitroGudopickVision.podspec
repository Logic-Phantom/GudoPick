require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "NitroGudopickVision"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported, :visionos => 1.0 }
  s.source       = { :git => "https://github.com/Logic-Phantom/GudoPick.git", :tag => "#{s.version}" }

  s.source_files = [
    # Implementation (Swift)
    "ios/**/*.{swift}",
    # Autolinking/Registration (Objective-C++)
    "ios/**/*.{m,mm}",
    # Implementation (C++ objects)
    "cpp/**/*.{hpp,cpp}",
  ]

  load 'nitrogen/generated/ios/NitroGudopickVision+autolinking.rb'
  add_nitrogen_files(s)

  s.frameworks = ['AVFoundation']

  s.dependency 'VisionCamera'
  # Google ML Kit (온디바이스). 정적 프레임워크로 배포된다.
  s.dependency 'GoogleMLKit/FaceDetection', '~> 9.0.0'
  s.dependency 'GoogleMLKit/ObjectDetection', '~> 9.0.0'
  s.static_framework = true

  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'
  install_modules_dependencies(s)
end
