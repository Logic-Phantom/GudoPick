//
//  HybridVisionDetector.swift
//  NitroGudopickVision
//
//  구도픽 온디바이스 감지기 (iOS).
//
//  ⚠️ 검증 상태: 이 파일은 Android 구현과 같은 Nitro 계약(VisionDetector.nitro.ts)에
//  맞춰 작성했지만, Windows 개발 환경에서는 iOS 빌드/실기기 실행을 할 수 없어
//  "코드 구현 / 미검증" 상태다. 특히 ML Kit iOS 결과 좌표계(버퍼 좌표 → 정방향 좌표)
//  회전 변환은 실기기에서 반드시 확인해야 한다. docs/TESTING.md 참고.
//

import AVFoundation
import Foundation
import MLKitFaceDetection
import MLKitObjectDetection
import MLKitVision
import NitroModules
import UIKit
import VisionCamera

final class HybridVisionDetector: HybridVisionDetectorSpec {
  private let lock = NSLock()
  private var faceDetector: FaceDetector?
  private var objectDetector: ObjectDetector?

  private var lastAnalysisStart: CFTimeInterval = 0

  private var analyzedFrames: Double = 0
  private var failedFrames: Double = 0
  private var lastDurationMs: Double = 0
  private var totalDurationMs: Double = 0

  var memorySize: Int {
    return 0
  }

  func shouldAnalyze(minIntervalMs: Double) throws -> Bool {
    lock.lock()
    defer { lock.unlock() }
    let now = CACurrentMediaTime()
    if lastAnalysisStart != 0 && (now - lastAnalysisStart) * 1000.0 < minIntervalMs {
      return false
    }
    lastAnalysisStart = now
    return true
  }

  func detect(frame: any HybridFrameSpec, kind: VisionSubjectKind) throws -> VisionDetection? {
    let startedAt = CACurrentMediaTime()
    guard let nativeFrame = frame as? any NativeFrame,
      let sampleBuffer = nativeFrame.sampleBuffer,
      let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer)
    else {
      return nil
    }

    let bufferWidth = Double(CVPixelBufferGetWidth(pixelBuffer))
    let bufferHeight = Double(CVPixelBufferGetHeight(pixelBuffer))
    guard bufferWidth > 0, bufferHeight > 0 else { return nil }

    let orientation = frame.orientation
    let image = VisionImage(buffer: sampleBuffer)
    image.orientation = Self.imageOrientation(for: orientation)

    var rect: CGRect?
    var trackingId: Double?
    do {
      switch kind {
      case .face:
        let faces = try getFaceDetector().results(in: image)
        // 가장 큰 얼굴 하나만 사용 (단체 인물 배치는 MVP 범위 밖)
        if let largest = faces.max(by: {
          $0.frame.width * $0.frame.height < $1.frame.width * $1.frame.height
        }) {
          rect = largest.frame
          if largest.hasTrackingID { trackingId = Double(largest.trackingID) }
        }
      case .object:
        let objects = try getObjectDetector().results(in: image)
        if let first = objects.first {
          rect = first.frame
          if let id = first.trackingID { trackingId = id.doubleValue }
        }
      }
    } catch {
      lock.lock()
      failedFrames += 1
      lock.unlock()
      return nil
    }

    let finishedAt = CACurrentMediaTime()
    let durationMs = (finishedAt - startedAt) * 1000.0
    lock.lock()
    analyzedFrames += 1
    lastDurationMs = durationMs
    totalDurationMs += durationMs
    lock.unlock()

    guard let rect else { return nil }

    // ML Kit iOS는 CMSampleBuffer 입력에 대해 버퍼(회전 전) 픽셀 좌표로 결과를 준다.
    // → 0..1로 정규화한 뒤 orientation에 따라 정방향 좌표계로 돌린다.
    let bx = Double(rect.origin.x) / bufferWidth
    let by = Double(rect.origin.y) / bufferHeight
    let bw = Double(rect.size.width) / bufferWidth
    let bh = Double(rect.size.height) / bufferHeight

    var x = bx
    var y = by
    var w = bw
    var h = bh
    var uprightWidth = bufferWidth
    var uprightHeight = bufferHeight

    switch orientation {
    case .up:
      break
    case .down:
      x = 1.0 - bx - bw
      y = 1.0 - by - bh
    case .right:
      x = 1.0 - by - bh
      y = bx
      w = bh
      h = bw
      uprightWidth = bufferHeight
      uprightHeight = bufferWidth
    case .left:
      x = by
      y = 1.0 - bx - bw
      w = bh
      h = bw
      uprightWidth = bufferHeight
      uprightHeight = bufferWidth
    }

    let clampedX = min(max(x, 0.0), 1.0)
    let clampedY = min(max(y, 0.0), 1.0)
    let clampedW = min(w, 1.0 - clampedX)
    let clampedH = min(h, 1.0 - clampedY)
    guard clampedW > 0, clampedH > 0 else { return nil }

    return VisionDetection(
      kind: kind,
      x: clampedX,
      y: clampedY,
      width: clampedW,
      height: clampedH,
      // ML Kit 얼굴/기본 객체 감지(분류 비활성)는 신뢰도 값을 제공하지 않는다.
      confidence: nil,
      trackingId: trackingId,
      frameWidth: uprightWidth,
      frameHeight: uprightHeight,
      isMirrored: frame.isMirrored,
      timestampMs: finishedAt * 1000.0,
      analysisDurationMs: durationMs
    )
  }

  func analyzePhoto(path: String) throws -> Promise<PhotoMetricsResult?> {
    return Promise.parallel {
      return Self.computePhotoMetrics(path: path)
    }
  }

  /// 사진 파일을 긴 변 약 480px로 축소해 밝기 통계와 라플라시안 분산을 계산한다. (미검증)
  private static func computePhotoMetrics(path: String) -> PhotoMetricsResult? {
    guard let image = UIImage(contentsOfFile: path), let cgImage = image.cgImage else { return nil }
    let longSide = max(cgImage.width, cgImage.height)
    guard longSide > 0 else { return nil }
    let scale = min(1.0, 480.0 / Double(longSide))
    let width = max(Int(Double(cgImage.width) * scale), 3)
    let height = max(Int(Double(cgImage.height) * scale), 3)

    var gray = [UInt8](repeating: 0, count: width * height)
    let drawn: Bool = gray.withUnsafeMutableBytes { buffer -> Bool in
      guard
        let context = CGContext(
          data: buffer.baseAddress,
          width: width,
          height: height,
          bitsPerComponent: 8,
          bytesPerRow: width,
          space: CGColorSpaceCreateDeviceGray(),
          bitmapInfo: CGImageAlphaInfo.none.rawValue
        )
      else { return false }
      context.interpolationQuality = .low
      context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
      return true
    }
    guard drawn else { return nil }

    var sum = 0.0
    var dark = 0
    var bright = 0
    for value in gray {
      sum += Double(value)
      if value < 20 { dark += 1 }
      if value > 245 { bright += 1 }
    }

    var lapSum = 0.0
    var lapSumSq = 0.0
    var count = 0
    for y in 1..<(height - 1) {
      let row = y * width
      for x in 1..<(width - 1) {
        let i = row + x
        let lap =
          4.0 * Double(gray[i]) - Double(gray[i - 1]) - Double(gray[i + 1])
          - Double(gray[i - width]) - Double(gray[i + width])
        lapSum += lap
        lapSumSq += lap * lap
        count += 1
      }
    }
    guard count > 0 else { return nil }
    let lapMean = lapSum / Double(count)
    let total = Double(width * height)
    return PhotoMetricsResult(
      meanLuminance: sum / total / 255.0,
      darkRatio: Double(dark) / total,
      brightRatio: Double(bright) / total,
      sharpness: lapSumSq / Double(count) - lapMean * lapMean
    )
  }

  func getStats() throws -> VisionDetectorStats {
    lock.lock()
    defer { lock.unlock() }
    return VisionDetectorStats(
      analyzedFrames: analyzedFrames,
      failedFrames: failedFrames,
      lastAnalysisDurationMs: lastDurationMs,
      averageAnalysisDurationMs: analyzedFrames > 0 ? totalDurationMs / analyzedFrames : 0
    )
  }

  func close() throws {
    lock.lock()
    defer { lock.unlock() }
    faceDetector = nil
    objectDetector = nil
    lastAnalysisStart = 0
  }

  func dispose() {
    try? close()
  }

  // MARK: - Private

  private func getFaceDetector() -> FaceDetector {
    lock.lock()
    defer { lock.unlock() }
    if let faceDetector { return faceDetector }
    let options = FaceDetectorOptions()
    options.performanceMode = .fast
    options.landmarkMode = .none
    options.contourMode = .none
    options.classificationMode = .none
    options.minFaceSize = 0.08
    options.isTrackingEnabled = true
    let detector = FaceDetector.faceDetector(options: options)
    faceDetector = detector
    return detector
  }

  private func getObjectDetector() -> ObjectDetector {
    lock.lock()
    defer { lock.unlock() }
    if let objectDetector { return objectDetector }
    let options = ObjectDetectorOptions()
    options.detectorMode = .stream
    options.shouldEnableMultipleObjects = false
    options.shouldEnableClassification = false
    let detector = ObjectDetector.objectDetector(options: options)
    objectDetector = detector
    return detector
  }

  private static func imageOrientation(for orientation: CameraOrientation) -> UIImage.Orientation {
    switch orientation {
    case .up: return .up
    case .down: return .down
    case .left: return .left
    case .right: return .right
    }
  }
}
