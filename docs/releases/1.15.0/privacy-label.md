# 1.15.0 개인정보 라벨 메모

**상태: 코드 대조 완료(`fc146d7de`, 2026-11-06), 콘솔 입력 전.** `da9b73498`까지 `apps/mobile/package.json`은 그대로고 `app.config.ts`는 RevenueCat 테스트 키를 개발 빌드에만 넣은 변경뿐이다. 콘솔의 현재 값은 이 저장소에서 확인할 수 없다. "1.14.x" 열은 1.14.0 심사 메모에 적힌 항목만 채웠다. 최종 신고 판단과 제출은 사용자가 한다.

## 바뀌는 데이터 흐름

| 데이터                | 1.14.x                                                         | 1.15.0                                                                                                         |
| --------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 음성 입력             | 할 일 추가 시트의 음성 버튼 하나. 녹음 파일은 저장하지 않는다. | 빠른 말하기·말로 메모·받아쓰기가 음성을 글자로 바꾼다. 경로는 아래와 같다.                                     |
| 저장 녹음 파일        | 없음                                                           | 기기에 저장한다. 30일 뒤 자동 삭제하고 마이 탭 > 녹음 저장 공간에서 지울 수 있다. 아이두 서버로 보내지 않는다. |
| 사용자 콘텐츠(글자)   | 서버 저장                                                      | 글자를 아이두 서버로 보내고, AI 정리를 위해 Anthropic·Google·OpenAI에 보낸다. 서버는 전사를 저장하지 않는다.   |
| 위치·기기 식별자·진단 | 1.14.0 심사 메모 기준                                          | 변화 없음. Sentry Session Replay는 1.14.2와 같다(세션 10%, 오류 100%, 글자·이미지·벡터 마스킹).                |

## 음성 인식 경로

세 흐름을 따로 적는다.

1. **저장 녹음 파일**: 기기에 저장하고 아이두 서버로 보내지 않는다. 기기 백업에 포함될 수 있어(Android `allowBackup: true`) "이 기기에만"이라고 쓰지 않는다. "녹음 파일은 아이두 서버로 보내지 않아요"로 고지한다.
2. **음성**: 어댑터 `expo-speech-recognizer.gateway.ts`가 경로를 고른다.
   - iOS 빠른 말하기와 받아쓰기는 항상 Apple 서버 인식이다. 음성이 Apple로 간다.
   - iOS 말로 메모는 기기 인식을 우선한다. 기기 기본 언어와 같고 기기 인식이 가능할 때만 기기에서 처리한다.
   - Android는 `supportsOnDeviceRecognition()`이 참이고 설치된 언어일 때 기기에서 처리한다. 그렇지 않으면 음성이 Google로 갈 수 있다. 받아쓰기는 기기 인식을 요구하지 않아 네트워크로 갈 수 있다.
   - "폰에서만 처리"라는 단정은 쓰지 않는다.
3. **글자**: 음성을 글자로 바꾼 뒤의 글자는 아이두 서버와 AI 업체로 간다. 2번과 별개 항목이다.

인식 힌트(`features/voice/constants/speech-hints.ts`, `getRecognizerStartOptions`):

- 자주 틀리는 일반 단어 목록은 네트워크 인식에도 보낸다. 고정 목록이고 개인 정보가 아니다.
- 사용자의 카테고리·할 일 이름은 기기 인식일 때만 넘긴다.
- 합쳐서 100개까지다(Apple 권장 상한).

그 밖의 규칙:

- 서버 로그·Sentry·Analytics에는 말한 내용, 전사 글자, 할 일 제목을 남기지 않는다.
- Analytics `voice_capture_started`의 `on_device`로 실제 기기 인식 비율을 본다.

## App Store Connect (App Privacy)

| 항목                              | 제안 값                                                  | 근거                                                                                                                    |
| --------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Audio Data                        | 신고 판단 보류 (제출 전 확인)                            | 저장 녹음은 아이두 서버로 가지 않는다. iOS 빠른 말하기의 음성은 Apple 서버로 간다. 이 경로의 해석을 제출 전에 확인한다. |
| User Content > Other User Content | 수집함, 사용자와 연결됨, 추적에 쓰지 않음, 목적: 앱 기능 | 할 일·메모 텍스트와 AI 정리용 글자를 아이두 서버와 AI 업체가 처리한다.                                                  |
| Location                          | 1.14.0과 같음 (앱 기능, 추적 안 함)                      | 1.14.0 심사 메모                                                                                                        |
| Identifiers > Device ID           | 1.14.0과 같음 (앱 기능, 추적 안 함)                      | 1.14.0 심사 메모                                                                                                        |

"추적"은 아니요다. 광고 식별자나 데이터 브로커를 쓰지 않는다. Firebase의 `google_analytics_adid_collection_enabled`는 끔이고 Android `AD_ID` 권한은 뺀다.

## Google Play (Data safety)

| 항목                             | 제안 값                                                      | 메모                                                                                                                                          |
| -------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 음성 (Voice or sound recordings) | 임시 처리로 신고 검토                                        | 네트워크 인식 경로로 음성이 기기 밖으로 나갈 수 있다. Google 정의상 임시 처리도 기기 밖으로 나가면 신고 대상이다. 저장 녹음은 서버로 안 간다. |
| 사용자 콘텐츠 (텍스트)           | 수집함, 공유함(AI 처리 업체), 전송 중 암호화, 삭제 요청 가능 | 음성 인식 경로와 별개다. AI 업체 분류는 아래 사용자 확인 항목을 본다.                                                                         |
| 위치·기기 ID                     | 1.14.0과 같음                                                | 콘솔 현재 값과 대조 필요                                                                                                                      |

## 권한 점검

`app.config.ts`를 `APP_ENV=production`으로 평가한 결과다(`expo config --type introspect`, 2026-11-06). Firebase·Kakao 값은 자리표시자로 평가했다. 네이티브 빌드는 하지 않았으므로 최종 값은 Release APK와 `Info.plist`로 다시 확인한다.

| iOS 키                                | 쓰는 곳                                                          |
| ------------------------------------- | ---------------------------------------------------------------- |
| `NSMicrophoneUsageDescription`        | 말로 할 일 만들기·말로 메모·받아쓰기                             |
| `NSSpeechRecognitionUsageDescription` | Apple 음성 인식                                                  |
| `NSLocationWhenInUseUsageDescription` | 날씨 화면과 날씨 알림                                            |
| `NSPhotoLibraryAddUsageDescription`   | 공유 시트의 "이미지 저장"                                        |
| `NSPhotoLibraryUsageDescription`      | 앱은 읽지 않는다. 포함된 SDK가 API를 참조해 필요하다(ITMS-90683) |

- iOS에 없는 키: `NSFaceIDUsageDescription`, `NSLocationAlways*`, `NSMotionUsageDescription`, `NSLocalNetworkUsageDescription`, `UIBackgroundModes`.
- 문구 원본은 `apps/mobile/native-locales/{ko,en}.json`이다. iOS 문구라 Google은 넣지 않는다. 받아쓰기 경로가 있어 "기기에서 인식할 수 없으면"이라는 조건도 쓰지 않는다.
- Android 위험 권한: `RECORD_AUDIO`, `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`, `POST_NOTIFICATIONS`.
- Android에서 뺀 권한(`blockedPermissions`): `AD_ID`, `ACCESS_ADSERVICES_AD_ID`, `ACCESS_ADSERVICES_ATTRIBUTION`, `USE_BIOMETRIC`, `USE_FINGERPRINT`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW`.
- `ACCESS_LOCAL_NETWORK`와 `CHANGE_WIFI_MULTICAST_STATE`는 debug 매니페스트에만 있다(`react-android` debug, `expo-dev-launcher` debug).

## 심사·동의 연결

- **제3자 AI 전송 동의(5.1.2(i))**: 1.15 앱의 AI 동의 시트는 받는 곳을 이렇게 적는다. "글자는 Anthropic·Google·OpenAI가 정리해요. 음성은 Apple·Google 음성 인식이 글자로 바꿀 수 있어요." 명시적 동의를 받고 설정에서 철회할 수 있다(5.1.1).
- **이전 동의자**: 이전 안내(2026-10-26)에 동의한 사용자에게 바뀐 안내를 계정마다 한 번 보여 준다. 답하지 않으면 Google만 쓰고 기능은 그대로 동작한다.
- **가이드라인 원문 확인**: 2026-11-05에 [원문](https://developer.apple.com/app-store/review/guidelines/#data-use-and-sharing)을 대조했다. 제3자 AI를 포함해 개인 데이터를 공유하는 곳을 알리고 그 전에 명시적 허락을 받으라고 한다.
- **권한 전 안내 버튼**: 시스템 권한 창을 여는 버튼은 HIG에 따라 "계속"/"Continue"로 쓴다.
- **심사 메모**: [ko](app-review-notes.ko.md), [en](app-review-notes.en.md). 데모 계정 값은 비워 뒀다.
- **동의 거절**: 동의 시트의 "나중에"는 서버로 보내지 않는다. 설정에서 철회할 때만 `agreed:false`를 보낸다. "나중에" 뒤에는 AI를 다시 시도할 때 다시 묻는다. 말로 할 일 만들기·말로 메모하기는 듣기를 시작하지 않는다.
- **개인정보처리방침·이용약관**: 위탁 업체 목록과 음성 처리 조항을 갱신한다(랜딩 별도 저장소, 법무 검토).

## 사용자 확인 항목

1. **신고 판단**: 음성 인식 경로(Apple·Google)를 App Store Audio Data와 Play 음성 항목에 어떻게 신고할지 정한다. 위 표는 보수적인 안이다.
2. **Play의 AI 업체 분류**: [Data safety 도움말](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)은 개발자를 대신해 지시에 따라 처리하는 곳을 서비스 제공자로 보고 공유에서 뺀다. 각 업체와의 계약이 이 정의에 맞는지 확인해 확정한다.
3. **권한 전 안내의 닫기 버튼**: [HIG](https://developer.apple.com/design/human-interface-guidelines/privacy)는 시스템 창 앞 화면에 버튼을 하나만 두고, 법적 동의가 아니면 닫는 길을 두지 말라고 한다. 푸시 안내(`나중에`)와 위치 첫 소개(`취소`)는 1.14.x에도 있던 동작이다. 없애면 iOS에서 한 번뿐인 시스템 창을 바로 쓰게 되므로 유지할지 정한다.
4. **AI 업체 보관·학습 정책**: 각 업체의 API 데이터 보관 기간과 학습 사용 여부는 확인하지 않았다. 처리방침에 쓰기 전에 현재 정책을 확인한다. 코드로 확인한 것은 OpenAI `store: false`뿐이다.
5. **Android 권한 신고**: `expo-location`의 사용하지 않는 전경 서비스(`foregroundServiceType="location"`)가 매니페스트에 남는다. 콘솔에 전경 서비스 신고 양식이 뜨는지 확인한다.
6. **정밀 위치(다음 릴리스)**: [Play 권한 정책](https://support.google.com/googleplay/android-developer/answer/9888170?hl=en)은 2027-01-27부터 Android 17(API 37) 타깃 앱의 `ACCESS_FINE_LOCATION`에 신고를 요구한다. 지금 타깃은 36이다. 타깃을 올리기 전에 대략적 위치나 위치 버튼으로 바꿀 수 있는지 본다.
