package com.margelo.nitro.gudopickvision

import android.graphics.BitmapFactory
import android.graphics.Rect
import android.os.SystemClock
import androidx.annotation.Keep
import androidx.annotation.OptIn
import androidx.camera.core.ExperimentalGetImage
import com.facebook.proguard.annotations.DoNotStrip
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetector
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.google.mlkit.vision.objects.ObjectDetection
import com.google.mlkit.vision.objects.ObjectDetector
import com.google.mlkit.vision.objects.defaults.ObjectDetectorOptions
import com.margelo.nitro.camera.HybridFrameSpec
import com.margelo.nitro.camera.public.NativeFrame
import com.margelo.nitro.core.Promise
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

/**
 * 구도픽 온디바이스 감지기 (Android).
 *
 * - 얼굴: ML Kit Face Detection, FAST 모드. 랜드마크/윤곽/분류(웃음·눈 감김)는 모두 끈다.
 *   얼굴의 위치와 크기만 사용하며 신원 식별·임베딩 생성은 하지 않는다.
 * - 사물: ML Kit Object Detection, STREAM 모드, 단일 주요 객체, 분류 비활성.
 *
 * `detect`는 VisionCamera AsyncRunner 스레드에서 동기적으로 호출된다.
 * ML Kit Task를 그 스레드에서 기다리므로(메인 스레드 아님) 반환 시점에는
 * 프레임 버퍼를 더 이상 참조하지 않는다 → 호출자가 곧바로 dispose할 수 있다.
 */
@DoNotStrip
@Keep
class HybridVisionDetector : HybridVisionDetectorSpec() {
  private val lock = Any()
  private var faceDetector: FaceDetector? = null
  private var objectDetector: ObjectDetector? = null

  private val lastAnalysisStartMs = AtomicLong(0L)

  // 통계 (AsyncRunner 스레드에서만 갱신, 읽기는 어느 스레드든 가능)
  @Volatile private var analyzedFrames = 0L
  @Volatile private var failedFrames = 0L
  @Volatile private var lastDurationMs = 0.0
  @Volatile private var totalDurationMs = 0.0

  override fun shouldAnalyze(minIntervalMs: Double): Boolean {
    val now = SystemClock.elapsedRealtime()
    val last = lastAnalysisStartMs.get()
    if (last != 0L && now - last < minIntervalMs.toLong()) return false
    return lastAnalysisStartMs.compareAndSet(last, now)
  }

  @OptIn(ExperimentalGetImage::class)
  override fun detect(frame: HybridFrameSpec, kind: VisionSubjectKind): VisionDetection? {
    val startedAt = SystemClock.elapsedRealtime()
    try {
      val nativeFrame = frame as? NativeFrame ?: return null
      val imageProxy = nativeFrame.image
      val mediaImage = imageProxy.image ?: return null
      val rotationDegrees = imageProxy.imageInfo.rotationDegrees
      val input = InputImage.fromMediaImage(mediaImage, rotationDegrees)

      // ML Kit은 rotationDegrees를 적용한 "똑바로 선" 좌표계로 결과를 돌려준다.
      val swapped = rotationDegrees == 90 || rotationDegrees == 270
      val uprightWidth = if (swapped) imageProxy.height else imageProxy.width
      val uprightHeight = if (swapped) imageProxy.width else imageProxy.height
      if (uprightWidth <= 0 || uprightHeight <= 0) return null

      var trackingId: Int? = null
      val box: Rect? =
        when (kind) {
          VisionSubjectKind.FACE -> {
            val faces = Tasks.await(getFaceDetector().process(input), TIMEOUT_MS, TimeUnit.MILLISECONDS)
            // 가장 큰 얼굴 하나만 사용 (단체 인물 배치는 MVP 범위 밖)
            val largest = faces.maxByOrNull { it.boundingBox.width().toLong() * it.boundingBox.height() }
            trackingId = largest?.trackingId
            largest?.boundingBox
          }
          VisionSubjectKind.OBJECT -> {
            val objects = Tasks.await(getObjectDetector().process(input), TIMEOUT_MS, TimeUnit.MILLISECONDS)
            val first = objects.firstOrNull()
            trackingId = first?.trackingId
            first?.boundingBox
          }
        }

      val finishedAt = SystemClock.elapsedRealtime()
      recordSuccess((finishedAt - startedAt).toDouble())
      if (box == null) return null

      val left = box.left.coerceIn(0, uprightWidth)
      val top = box.top.coerceIn(0, uprightHeight)
      val right = box.right.coerceIn(0, uprightWidth)
      val bottom = box.bottom.coerceIn(0, uprightHeight)
      if (right <= left || bottom <= top) return null

      return VisionDetection(
        kind = kind,
        x = left.toDouble() / uprightWidth,
        y = top.toDouble() / uprightHeight,
        width = (right - left).toDouble() / uprightWidth,
        height = (bottom - top).toDouble() / uprightHeight,
        // ML Kit 얼굴/기본 객체 감지(분류 비활성)는 신뢰도 값을 제공하지 않는다.
        confidence = null,
        trackingId = trackingId?.toDouble(),
        frameWidth = uprightWidth.toDouble(),
        frameHeight = uprightHeight.toDouble(),
        isMirrored = frame.isMirrored,
        timestampMs = finishedAt.toDouble(),
        analysisDurationMs = (finishedAt - startedAt).toDouble(),
      )
    } catch (e: Throwable) {
      failedFrames += 1
      android.util.Log.w(TAG, "detect failed: ${e.message}")
      return null
    }
  }

  override fun analyzePhoto(path: String): Promise<PhotoMetricsResult?> {
    return Promise.parallel { computePhotoMetrics(path) }
  }

  /**
   * 사진 파일을 긴 변 약 480px로 축소 디코딩해 밝기 통계와 라플라시안 분산을 계산한다.
   * 원본 파일은 읽기만 하며 수정하지 않는다.
   */
  private fun computePhotoMetrics(path: String): PhotoMetricsResult? {
    try {
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      BitmapFactory.decodeFile(path, bounds)
      if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

      var sample = 1
      val longSide = maxOf(bounds.outWidth, bounds.outHeight)
      while (longSide / (sample * 2) >= METRICS_LONG_SIDE) sample *= 2

      val bitmap =
        BitmapFactory.decodeFile(path, BitmapFactory.Options().apply { inSampleSize = sample })
          ?: return null
      val width = bitmap.width
      val height = bitmap.height
      val pixels = IntArray(width * height)
      bitmap.getPixels(pixels, 0, width, 0, 0, width, height)
      bitmap.recycle()
      if (width < 3 || height < 3) return null

      val gray = IntArray(pixels.size)
      var sum = 0L
      var dark = 0
      var bright = 0
      for (i in pixels.indices) {
        val c = pixels[i]
        val r = (c shr 16) and 0xFF
        val g = (c shr 8) and 0xFF
        val b = c and 0xFF
        val y = (r * 299 + g * 587 + b * 114) / 1000
        gray[i] = y
        sum += y
        if (y < 20) dark++
        if (y > 245) bright++
      }

      var lapSum = 0.0
      var lapSumSq = 0.0
      var count = 0
      for (yy in 1 until height - 1) {
        val row = yy * width
        for (xx in 1 until width - 1) {
          val i = row + xx
          val lap = (4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width]).toDouble()
          lapSum += lap
          lapSumSq += lap * lap
          count++
        }
      }
      val lapMean = lapSum / count
      val variance = lapSumSq / count - lapMean * lapMean
      val total = pixels.size.toDouble()

      return PhotoMetricsResult(
        meanLuminance = sum / total / 255.0,
        darkRatio = dark / total,
        brightRatio = bright / total,
        sharpness = variance,
      )
    } catch (e: Throwable) {
      android.util.Log.w(TAG, "analyzePhoto failed: ${e.message}")
      return null
    }
  }

  override fun getStats(): VisionDetectorStats {
    val count = analyzedFrames
    return VisionDetectorStats(
      analyzedFrames = count.toDouble(),
      failedFrames = failedFrames.toDouble(),
      lastAnalysisDurationMs = lastDurationMs,
      averageAnalysisDurationMs = if (count > 0) totalDurationMs / count else 0.0,
    )
  }

  override fun close() {
    synchronized(lock) {
      faceDetector?.close()
      faceDetector = null
      objectDetector?.close()
      objectDetector = null
    }
    lastAnalysisStartMs.set(0L)
  }

  override fun dispose() {
    close()
    super.dispose()
  }

  private fun recordSuccess(durationMs: Double) {
    analyzedFrames += 1
    lastDurationMs = durationMs
    totalDurationMs += durationMs
  }

  private fun getFaceDetector(): FaceDetector =
    synchronized(lock) {
      faceDetector ?: FaceDetection
        .getClient(
          FaceDetectorOptions
            .Builder()
            .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
            .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_NONE)
            .setContourMode(FaceDetectorOptions.CONTOUR_MODE_NONE)
            .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_NONE)
            .setMinFaceSize(0.08f)
            .enableTracking()
            .build(),
        ).also { faceDetector = it }
    }

  private fun getObjectDetector(): ObjectDetector =
    synchronized(lock) {
      objectDetector ?: ObjectDetection
        .getClient(
          ObjectDetectorOptions
            .Builder()
            .setDetectorMode(ObjectDetectorOptions.STREAM_MODE)
            // 다중 객체·분류는 켜지 않는다 (스트리밍 성능 우선).
            .build(),
        ).also { objectDetector = it }
    }

  private companion object {
    const val TAG = "GudopickVision"
    const val TIMEOUT_MS = 1500L
    const val METRICS_LONG_SIDE = 480
  }
}
