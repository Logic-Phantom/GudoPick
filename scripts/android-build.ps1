# 구도픽 로컬 Android 빌드 스크립트 (Windows PowerShell)
#
# 전역 환경 변수를 건드리지 않고 이 프로세스에만 JDK 17 / Android SDK 경로를 지정한다.
# 사용 예:
#   powershell -File scripts/android-build.ps1 assembleDebug
#   powershell -File scripts/android-build.ps1 assembleRelease
#
# 경로는 환경에 맞게 GUDOPICK_JAVA_HOME / GUDOPICK_ANDROID_HOME / GUDOPICK_GRADLE_HOME 로 덮어쓸 수 있다.
param(
  [string]$Task = "assembleDebug",
  [string]$Architectures = "arm64-v8a",
  [int]$ObjectPathMax = 230
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Pick([string]$override, [string]$fallback) {
  if ($override) { return $override } else { return $fallback }
}

$env:JAVA_HOME = Pick $env:GUDOPICK_JAVA_HOME "C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"
$env:ANDROID_HOME = Pick $env:GUDOPICK_ANDROID_HOME "C:\eclipse_AI\.android-sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:GRADLE_USER_HOME = Pick $env:GUDOPICK_GRADLE_HOME "C:\eclipse_AI\.gradle-home"
# 사용자 폴더에 한글 등 비ASCII 문자가 있으면 AGP prefab 단계(배치 파일)가 깨진다.
# → 임시 폴더를 ASCII 경로로 지정한다.
$tmp = Pick $env:GUDOPICK_TMP "C:\eclipse_AI\.tmp"
New-Item -ItemType Directory -Force $tmp | Out-Null
$env:TEMP = $tmp
$env:TMP = $tmp
$env:GRADLE_OPTS = "-Djava.io.tmpdir=$tmp -Dorg.gradle.jvmargs=`"-Xmx3g -XX:MaxMetaspaceSize=1g -Djava.io.tmpdir=$tmp`""
$env:NODE_ENV =if ($Task -like "*Release*") { "production" } else { "development" }

if (-not (Test-Path (Join-Path $root "android\gradlew.bat"))) {
  Write-Host "android/ 폴더가 없습니다. 먼저 'npx expo prebuild --platform android' 를 실행하세요."
  exit 1
}

# android/ 는 prebuild가 생성하므로 local.properties 를 매번 써 준다.
# cmake.dir: SDK 폴더가 비ASCII 실제 경로로 연결된 링크이면 ninja 실행이 실패하므로 ASCII 경로의 CMake를 지정한다.
$cmakeDir = Pick $env:GUDOPICK_CMAKE_DIR "C:\eclipse_AI\.tools\cmake-3.22.1"
$props = @("sdk.dir=$($env:ANDROID_HOME -replace '\\','\\')")
if (Test-Path (Join-Path $cmakeDir "bin\ninja.exe")) { $props += "cmake.dir=$($cmakeDir -replace '\\','\\')" }
[IO.File]::WriteAllLines((Join-Path $root "android\local.properties"), $props)

Push-Location (Join-Path $root "android")
try {
  # --no-daemon: 데몬이 출력 핸들을 붙잡아 로그 리다이렉션이 끝나지 않는 문제를 피한다.
  # expo.android.cmakeObjectPathMax: Windows에서 긴 경로 지원(LongPathsEnabled)이 꺼져 있으면
  # 260자 제한에 걸린다. Expo 기본값(1024) 대신 한도 안의 값을 주면 CMake가 긴 객체 경로를 해시로 줄인다.
  & .\gradlew.bat $Task "-PreactNativeArchitectures=$Architectures" "-Pexpo.android.cmakeObjectPathMax=$ObjectPathMax" --console=plain --no-daemon
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
