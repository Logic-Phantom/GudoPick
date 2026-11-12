# RELEASE_CHECKLIST — 출시 전 체크리스트

`[소유자]` = 계정·결제·법적 판단이 필요해 Claude가 수행하지 않은 일.

## A. 가장 먼저 (기능 검증)

- [ ] Android 실기기에 APK 설치 후 카메라 미리보기·촬영 확인
- [ ] 인물 모드: 얼굴 박스가 실제 얼굴 위치에 그려지는지 (후면/전면)
- [ ] 음식 모드: 객체 박스 위치
- [ ] 전면 카메라 좌우 반전 방향이 프리뷰와 일치하는지 (D-009)
- [ ] 프리뷰와 분석 프레임의 화각 일치 (가장자리 피사체로 확인)
- [ ] 수평선이 도는 방향(부호)이 맞는지
- [ ] 안내 문구 방향이 실제 체감과 맞는지
- [ ] 저장한 사진의 방향·크기·EXIF(위치 없음) 확인
- [ ] `docs/DEVICE_BENCHMARKS.md` 측정값 채우기
- [ ] iOS: macOS에서 `npx expo prebuild --platform ios` → `pod install` → 빌드 → 같은 항목 검증

## B. 소유자 입력·결정 `[소유자]`

- [ ] 운영자명, 문의 이메일 (앱 내 개인정보 처리방침의 "문의", `PRIVACY.md`)
- [ ] 개인정보 처리방침 공개 URL 게시
- [ ] 이용약관·문의 페이지 여부 결정
- [ ] 앱 이름 "구도픽 / GudoPick" 상표·중복 확인: KIPRIS, Google Play, App Store 검색
- [ ] 패키지/번들 ID `app.gudopick.mobile` 사용 가능 여부 → 불가 시 `app.json` 변경
- [ ] 저장소 라이선스(현재 템플릿 MIT) 유지 여부
- [ ] 샘플 이미지 생성일 기록, OpenAI 약관상 앱 번들·스토어 스크린샷 사용 가능 여부 재확인
- [ ] 앱 화면 문구 "완벽한 구도", "가장 좋은 구도로" 유지 여부 (D-024)
- [ ] 대상 연령·콘텐츠 등급

## C. 서명·빌드 `[소유자]`

- [ ] 현재 릴리스 APK는 **템플릿 디버그 키로 서명**됨 → 개인 테스트 전용, 배포 금지
- [ ] 업로드 키 생성·보관 또는 EAS Build 자격 증명 설정 (키/비밀번호를 저장소에 넣지 않기)
- [ ] `eas.json` 작성 및 EAS 프로젝트 연결(계정 로그인 필요) — 아직 만들지 않음
- [ ] AAB 빌드, `targetSdkVersion`이 제출 시점 Play 요구(API 36 이상)를 만족하는지 확인
- [ ] 버전(`app.json` version / versionCode) 정책

## D. Google Play `[소유자]`

- [ ] 개발자 계정(기존 계정 재사용 여부), 앱 생성
- [ ] Data Safety 양식 (`STORE_COMPLIANCE.md` 초안 검토, Firebase Remote Config/Installations 항목 확인)
- [ ] 콘텐츠 등급, 타겟 연령, 광고 없음 선언
- [ ] 스토어 등록 정보: 설명, 아이콘 512, 그래픽 이미지, **실제 화면 스크린샷**
- [ ] 내부 테스트 → 비공개/공개 테스트 요건 확인

## E. Apple App Store `[소유자]`

- [ ] Apple Developer Program, 번들 ID 등록
- [ ] macOS/Xcode 빌드 환경 또는 EAS Build
- [ ] App Privacy Details, Privacy Manifest 점검
- [ ] 권한 문구 최종 검수
- [ ] 심사 메모: 계정 불필요, 카메라 권한 허용 후 바로 체험 가능

## F. 출시 전 기술 점검

- [ ] `npm test`, `npm run typecheck`, `npm run lint`, `npx expo-doctor`
- [ ] `npm run licenses` 재생성 후 검토, `./gradlew :app:dependencies`로 Android 전이 의존성 확인
- [ ] 최종 병합 Manifest 권한 재확인
- [ ] 저장소·APK에 비밀키/토큰이 없는지 확인
- [ ] TalkBack/VoiceOver, 큰 글자, 햇빛 아래 가독성
- [ ] 10분 이상 카메라 실행: 발열·메모리·배터리
