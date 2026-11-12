# PRIVACY — 개인정보 처리 원칙과 처리방침 초안

- 작성일: 2026-11-12
- 상태: **초안**. 운영자명·문의 이메일·공개 URL은 소유자가 확정해야 한다(RELEASE_CHECKLIST).
- 앱 내 표시: 설정 > 개인정보 처리방침 (`src/shared/legal-content.ts`)

## 1. 근거로 확인한 사실

| 항목 | 근거 | 확인 방법 |
|---|---|---|
| 구도픽 자체 서버·계정·분석/광고 SDK 없음 | 코드/의존성 | `package.json`, `docs/THIRD_PARTY_NOTICES.md` (코드 확인) |
| 프레임은 JS로 넘어오지 않고 네이티브에서 분석, 좌표만 전달 | `useSubjectDetection.ts`, `HybridVisionDetector.kt` | 코드 확인 |
| ML Kit 입력·출력은 기기에서 처리, Google 서버로 전송하지 않음 | ML Kit Terms & Privacy (2025-05-14) | 공식 문서 확인 |
| ML Kit는 버그 수정·모델 업데이트·하드웨어 호환 정보를 위해 Google 서버에 접속할 수 있고, API 성능·사용 지표를 Google에 전송 | 같은 문서 | 공식 문서 확인 |
| ML Kit Android SDK 수집 항목: 기기 정보, 앱 정보(패키지명·버전), 설치당 식별자, 성능 지표, API 구성, 입출력 크기, 기능 버전, 이벤트 유형, 오류 코드. HTTPS 전송, 제3자 공유 없음 | ML Kit Android 데이터 공개 페이지 | 공식 문서 확인 |
| `com.google.mlkit:object-detection`은 진단용으로 Firebase Remote Config + Firebase Installations 사용 | 같은 문서 | 공식 문서 확인 |
| 실제 기기에서 앱이 내보내는 네트워크 트래픽 | — | **미검증** (실기기 캡처 필요) |

따라서 "완전 오프라인", "어떤 네트워크 통신도 없음", "데이터 수집 없음"이라고 쓰지 않는다.

## 2. 앱의 동작

| 데이터 | 처리 |
|---|---|
| 카메라 프레임 | 기기 안에서만 분석(위치·크기). 저장하지 않음. 구도픽 서버 없음 |
| 얼굴 | 위치·크기만 사용. 신원 식별, 얼굴 특징/임베딩 저장, 감정·외모 평가 없음. 랜드마크·분류 기능 비활성 |
| 촬영 사진 | 셔터를 직접 눌렀을 때만 촬영. 저장 전에는 앱 캐시의 임시 파일. "저장하기"를 눌렀을 때만 사진 앱에 추가. 그 외 경로에서는 삭제 |
| 사진 보관함 | 읽지 않음. 쓰기 전용(Add Only) 권한만 사용 |
| 위치 | 권한을 요청하지 않음. 촬영 시 위치를 전달하지 않아 위치 EXIF를 새로 넣지 않음 |
| 기기에 저장 | 온보딩 완료 여부, 프리셋(취향 선택 값), 앱 설정 |
| 삭제 | 설정 > 앱 정보 > 데이터 초기화. 앱 삭제 시 함께 삭제. 사진 앱에 저장한 사진은 사용자가 사진 앱에서 직접 관리 |

## 3. 권한

| 권한 | 사용 | 요청 시점 |
|---|---|---|
| 카메라 (`CAMERA`, `NSCameraUsageDescription`) | 미리보기·구도 안내·촬영 | 카메라 화면에서 이유를 설명한 뒤 버튼을 눌렀을 때 |
| 사진 추가 (`NSPhotoLibraryAddUsageDescription`, Android는 MediaStore 쓰기) | "저장하기" | 저장 버튼을 눌렀을 때 |
| 마이크, 위치, 연락처, 사진 읽기, 광고 ID | 사용하지 않음 | — |

Android에서 명시적으로 차단한 권한(`app.json` `blockedPermissions`): `RECORD_AUDIO`, `ACCESS_FINE/COARSE_LOCATION`, `ACCESS_MEDIA_LOCATION`, `READ_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES/VIDEO/AUDIO`, `READ_MEDIA_VISUAL_USER_SELECTED`, `MANAGE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW`, `AD_ID`.
최종 병합 Manifest 확인 결과는 `docs/TESTING.md`에 기록한다.

## 4. 처리방침 초안 (공개용)

> **구도픽 개인정보 처리방침 (초안)**
>
> 구도픽(이하 "앱")은 계정이나 서버 없이 기기 안에서 동작합니다.
>
> 1. **수집·저장하는 정보**: 앱은 운영자의 서버로 어떤 개인정보도 전송하지 않습니다. 촬영 취향(프리셋)과 앱 설정은 사용자의 기기에만 저장됩니다.
> 2. **카메라**: 카메라 화면은 구도 안내를 위해 기기 안에서만 분석되며 저장되거나 운영자에게 전송되지 않습니다. 앱은 얼굴로 사람을 식별하지 않습니다.
> 3. **사진**: 사진은 사용자가 셔터를 누를 때만 촬영되고, "저장하기"를 누를 때만 기기의 사진 앱에 추가됩니다. 앱은 기존 사진을 읽지 않습니다.
> 4. **제3자 SDK**: 앱은 기기 내 분석을 위해 Google ML Kit을 사용합니다. ML Kit은 이미지와 분석 결과를 Google로 보내지 않지만, 기능 제공·진단·성능 측정을 위해 기기 정보, 앱 정보, 설치 단위 식별자, 성능 및 사용 통계 등을 Google로 전송할 수 있습니다. 자세한 내용은 Google 개인정보처리방침(https://policies.google.com/privacy)과 ML Kit 약관(https://developers.google.com/ml-kit/terms)을 참고하세요.
> 5. **위치·마이크·연락처·광고 식별자**: 사용하지 않습니다.
> 6. **데이터 삭제**: 앱의 설정 > 앱 정보 > 데이터 초기화, 또는 앱 삭제로 기기에 저장된 앱 데이터를 지울 수 있습니다.
> 7. **아동**: (소유자 확정 필요 — 대상 연령과 스토어 설정에 맞춰 작성)
> 8. **문의**: (소유자 입력 필요 — 운영자명, 이메일)
> 9. **변경**: 이 방침이 바뀌면 앱과 이 페이지에 공지합니다. 시행일: (소유자 입력)

## 5. 남은 확인 사항

- [ ] 실기기에서 네트워크 트래픽 캡처로 ML Kit/Firebase 통신 실측
- [ ] iOS ML Kit SDK의 Privacy Manifest·데이터 공개 페이지 확인 (https://developers.google.com/ml-kit/ios-data-disclosure)
- [ ] 공개 처리방침 URL 게시, 운영자·문의처 확정
