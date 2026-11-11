# 빌드와 배포

EAS 빌드·로컬 빌드, 환경 변수와 Secrets, 스토어 제출, 배포 순서를 다룬다. 명령은 `apps/mobile`에서 실행한다. 새 기능 소개(Steps·캠페인·이미지)는 [whats-new-release.md](./whats-new-release.md), 릴리스별 변경은 [releases/](./releases/)에 있다.

## 배포 순서

서버 배포 → 안정화 확인 → 앱 제출이다. 앱은 최신 서버 응답만 읽고 옛 서버 분기를 두지 않으므로 앱 1.15.0이 나간 뒤에는 서버를 1.15 이전으로 되돌리지 못한다. 서버 문제는 수정 배포로 대응한다([호환](../../../docs/conventions/compatibility.md)).

## 환경과 프로필

| Profile             | APP_ENV     | API URL                       | 용도                             | iOS            | Android |
| ------------------- | ----------- | ----------------------------- | -------------------------------- | -------------- | ------- |
| `development`       | development | 자동 감지                     | 개발·디버깅(dev client)          | 시뮬레이터용   | APK     |
| `preview`           | preview     | `https://api-preview.aido.kr` | 내부 테스트·QA                   | 실기기(Ad Hoc) | APK     |
| `production`        | production  | `https://api.aido.kr`         | 스토어 제출(빌드 번호 자동 증가) | App Store용    | AAB     |
| `production-device` | production  | 위와 같음                     | 실기기 Release 검증              | Ad Hoc         | APK     |

- `--profile`을 생략하면 `production`이다. `production-device`는 `production` EAS environment를 명시적으로 상속한다(내부 배포의 기본 environment인 preview로 production 설정이 바뀌지 않게 한다).
- 개발 API URL은 자동 감지한다. Android 에뮬레이터는 `localhost → 10.0.2.2`, iOS 시뮬레이터는 `localhost` 유지, 실기기는 개발 머신 IP이며 같은 Wi-Fi여야 한다. 환경 변수 파일은 `.env` + `.env.development`(개발), `.env.preview`, `.env.production`이고 필수 값은 `APP_ENV`·`EXPO_PUBLIC_API_URL`이다.
- 번들 ID는 환경마다 다르다(`com.aido.mobile` · `.preview` · `.dev`). 한 기기에 함께 설치되고 키체인·App Group·푸시 토큰도 분리된다.

## 환경 변수

```bash
# 런타임
APP_ENV                      # development | preview | production
EXPO_PUBLIC_API_URL          # API 서버 URL
EXPO_PUBLIC_SENTRY_DSN       # Sentry DSN (publishable)
EXPO_PUBLIC_SENTRY_DEBUG     # (선택) dev에서 Sentry SDK만 켠다. 'true'일 때만
EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY  # 카카오톡 공유 네이티브 앱 키 (publishable)

# 빌드 (EAS Secrets)
GOOGLE_SERVICES_JSON         # Firebase Android (Base64)
GOOGLE_SERVICES_INFO_PLIST   # Firebase iOS (Base64, 환경별 값)
SENTRY_AUTH_TOKEN            # Sentry 소스맵 업로드 (sensitive)
EXPO_PUBLIC_EAS_PROJECT_ID   # EAS 프로젝트 ID
```

OAuth 클라이언트 ID·시크릿은 앱에 두지 않고 **API 서버 환경 변수**에서 관리한다([인증](./auth.md#소셜-로그인)). 값·서명 파일·로그를 Git에 넣지 않는다.

## EAS Secrets

`eas-build-pre-install.sh`가 빌드 전에 환경 변수를 Base64 디코딩해 `google-services.json`을 복원하고, `app.config.ts`의 `googleServicesFile`이 그 파일을 참조한다.

```bash
# Android: 모든 환경이 같은 파일을 쓴다
base64 -i google-services.json | pbcopy
eas secret:create --scope project --name GOOGLE_SERVICES_JSON --value "붙여넣기" --type string

# iOS: 환경마다 plist가 다르다. 같은 이름을 EAS 환경마다 다른 값으로 등록한다
base64 -i GoogleService-Info.development.plist | pbcopy
eas env:create --name GOOGLE_SERVICES_INFO_PLIST --value "붙여넣기" --environment development --visibility secret

# Sentry: DSN은 publishable, Auth Token은 sensitive
eas env:create --name EXPO_PUBLIC_SENTRY_DSN --value "<DSN>" --environment production --visibility plaintext
eas env:create --name SENTRY_AUTH_TOKEN --value "<TOKEN>" --environment production --visibility sensitive
```

| APP_ENV     | 번들 ID                   | 로컬 plist 파일                        |
| ----------- | ------------------------- | -------------------------------------- |
| production  | `com.aido.mobile`         | `GoogleService-Info.plist`             |
| preview     | `com.aido.mobile.preview` | `GoogleService-Info.preview.plist`     |
| development | `com.aido.mobile.dev`     | `GoogleService-Info.development.plist` |

- Android `google-services.json`은 패키지별 client가 한 파일에 들어 있다. Firebase 콘솔에 `.dev`·`.preview` Android 앱을 추가한 뒤 다시 받은 파일을 등록한다.
- Base64는 줄바꿈 없이 만든다(macOS는 `base64 -i`). Secret은 프로젝트 멤버만 접근한다. `eas secret:list`로 확인한다.
- `EXPO_PUBLIC_SENTRY_DSN`은 `app.config.ts`의 `extra.sentryDsn`으로 전달되어 `initErrorReporting()`에서 쓰고, `SENTRY_AUTH_TOKEN`은 빌드 중 소스맵 업로드에만 쓴다(런타임 미포함).
- 카카오톡 공유는 앱에 네이티브 앱 키가 필요하다. EAS 환경 `production`·`preview`·`development`에 각각 넣고 로컬은 `.env.development`에 둔다. 카카오 디벨로퍼스에 iOS 번들 ID(`com.aido.mobile`, `.preview`), Android 패키지, Android 키 해시 세 가지(debug 키, EAS 업로드 키, Play 앱 서명 키)를 모두 등록한다. 키가 있을 때만 `app.config.ts`가 카카오 config plugin을 넣고, 키를 처음 넣거나 바꾸면 **dev client를 다시 빌드**한다(JS 리로드로는 반영되지 않는다).
- `@react-native-kakao/share`의 podspec은 `RNCKakaoSocial`·`RNCKakaoUser`를 요구하지만 `peerDependencies`에는 core만 있다. `@react-native-kakao/social`·`user`를 같은 버전(`pnpm-workspace.yaml` catalog)으로 직접 둔다. 빠지면 `pod install`이 `Unable to find a specification for 'RNCKakaoSocial'`로 실패한다.

## 빌드 방법과 비용

| 방법                       | 명령                                           | 무료 티어 차감                  | 비고                                                 |
| -------------------------- | ---------------------------------------------- | ------------------------------- | ---------------------------------------------------- |
| 클라우드 빌드              | `eas build --platform <p> --profile <profile>` | 차감(월 30분, iOS·Android 각각) | 대기열, iOS 10-20분 · Android 5-15분                 |
| 로컬 빌드                  | 위 명령에 `--local`                            | 차감 안 됨                      | Xcode·Fastlane·CocoaPods(iOS) / Android SDK·NDK·Java |
| EAS Submit·EAS Update(OTA) | `eas submit`, `eas update`                     | 차감 안 됨                      | 빌드 시간과 별개                                     |

```bash
pnpm build:development[:android|:ios]   # dev client
pnpm build:preview[:android|:ios]
pnpm build:production[:android|:ios]
pnpm build:production:local:android     # = eas build --local --platform android --profile production
pnpm build:production:local:ios
pnpm update:preview "메시지"            # OTA
pnpm update:production "메시지"
```

- SDK 58 빌드는 EAS CLI 24.8.0 이상이다. `npm install -g eas-cli@24.8.0` 뒤 `eas --version`으로 PATH에서 실행되는 버전을 확인한다(Node 버전 관리 도구와 Homebrew의 전역 위치가 다르면 이전 CLI가 실행된다).
- iOS 로컬 빌드 도구: `brew install fastlane cocoapods`, `xcode-select -p`·`fastlane --version`·`pod --version`으로 확인한다.
- 로컬 빌드는 `eas.json`의 Node/Fastlane/CocoaPods 도구 버전을 설치하지 않고 EAS Secret도 자동 제공하지 않는다. 필요한 값은 기존 `GOOGLE_SERVICES_JSON`·`GOOGLE_SERVICES_INFO_PLIST` 복원 경로로 공급한다([Expo 로컬 빌드](https://docs.expo.dev/build-reference/local-builds/)).
- 실기기 Release 검증용 설치 파일(production API·Firebase·Sentry 설정, iOS는 등록된 기기용 Ad Hoc, Android는 APK)은 `eas build --local --platform <ios|android> --profile production-device`다. 스토어 제출 파일과 구분한다.

### 스토어 제출용 로컬 빌드

`eas build --local`은 시도마다 원격 빌드 번호를 올리고 실패한 시도도 번호를 쓴다. 아래 조건을 갖춘 뒤 한 번에 돌린다.

```bash
# 1. main을 독립 clone으로 받는다(작업 중인 checkout·worktree를 쓰지 않는다)
gh repo clone Aiddoo/Aido-platform /tmp/aido-build -- --depth 1 --branch main
cd /tmp/aido-build && pnpm install --frozen-lockfile
# google-services.json, GoogleService-Info.plist를 apps/mobile에 둔다(git 제외 파일)

# 2. 압축 단계만 먼저 확인한다(빌드 번호를 올리지 않는다)
cd apps/mobile
GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.fsmonitor GIT_CONFIG_VALUE_0=false \
  eas build:inspect -p android -e production --stage archive --output /tmp/aido-archive --force

# 3. 플랫폼마다 TMPDIR을 나눠 동시에 빌드한다
GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.fsmonitor GIT_CONFIG_VALUE_0=false TMPDIR=/tmp/eas-ios \
  eas build --local -p ios --profile production --non-interactive --output ~/Desktop/aido-<버전>.ipa < /dev/null
GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.fsmonitor GIT_CONFIG_VALUE_0=false TMPDIR=/tmp/eas-android \
  eas build --local -p android --profile production --non-interactive --output ~/Desktop/aido-<버전>.aab < /dev/null
```

| 증상                                                                    | 원인                                                                              | 대책                                                      |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `Compressing project files` 뒤 오류 없이 종료(exit 0), 빌드 번호만 오름 | 전역 `core.fsmonitor=true`가 EAS 임시 복사본 `.git`에 소켓을 만들고 복사가 멈춘다 | 명령에만 `core.fsmonitor=false`를 준다(위 `GIT_CONFIG_*`) |
| `createBundleReleaseJsAndAssets` `ENOTEMPTY …/metro-cache`              | iOS·Android가 같은 `TMPDIR`의 Metro 캐시를 동시에 쓴다                            | 플랫폼마다 `TMPDIR`을 나눈다                              |

### SDK 58 빌드 주의

- **precompiled 모듈 끔**: iOS 117은 precompiled ExpoFileSystem이 ExpoModulesJSI에 없는 Swift 심볼을 참조해 JS 시작 전에 DYLD에서 종료됐다. `expo-build-properties.ios.usePrecompiledModules=false`로 Expo 모듈을 함께 소스 빌드한다([Expo 공식 설정](https://docs.expo.dev/guides/prebuilt-expo-modules/)). 의존성 버전을 내리거나 생성된 `ios/` 파일만 고치는 방식으로 대체하지 않는다. OTA로 이 장애를 해결할 수 없다.
- **Firebase 초기화**: `withFirebaseInitialization` plugin이 RNFirebase가 인식하지 못하는 SDK 58 AppDelegate에 네이티브 Firebase 초기화를 더한다. RNFirebase plugin 바로 뒤에 등록하며 새 template을 인식하지 못하면 prebuild를 실패시킨다. 생성된 launch method에서 Firebase가 React Native factory보다 먼저 한 번만 설정되는지 확인한다.
- **`expo-web-browser` plugin**: package exports에 `app.plugin.js`가 없어 EAS resolver가 런타임 모듈로 오인한다. `app.config.ts`에서 설치된 package의 실제 plugin 파일을 프로젝트 상대 경로로 지정한다(절대 경로가 fingerprint에 들어가 runtime이 달라지지 않게). `Expo.fx` 오류를 앱 런타임·Expo 소스 변경으로 고치지 않는다.
- **위젯 layout registry** import 경로는 실제 파일 경로로 정규화한다. macOS의 `/tmp`와 `/private/tmp`가 Metro에서 다르게 처리되어 iOS archive가 실패하지 않도록 `expo-widgets` 패치에 반영돼 있다.

### 네이티브 검증

```bash
pnpm test:node                                       # plugin·Firebase 초기화·위젯 갤러리 locale·스크립트 등
pnpm check:ipa-linkage /absolute/path/to/production.ipa
pnpm check:native-icons
```

`check:ipa-linkage`의 범위는 arm64 앱과 번들된 Expo framework의 강한 two-level 심볼 참조다. 시스템 framework, 실제 기기 실행, Firebase 초기화, 화면 회귀를 대신하지 않는다. 서명된 최종 IPA/AAB는 TestFlight·Play 내부 테스트에서 시작·재시작·로그인·주요 기능을 확인한 뒤 심사에 제출한다.

## 스토어 제출

- **iOS**: production 빌드 → `eas submit --platform ios --path ./build.ipa`(또는 `pnpm submit:production:ios`) 또는 Transporter(Mac App Store, `mas install 1450874784`)로 올린다 → TestFlight 확인 → App Store Connect에서 정보·가격·지역을 입력하고 심사 제출한다.
- **Android**: production AAB → `eas submit --platform android --path ./build.aab`(또는 `pnpm submit:production:android`) 또는 Play Console(프로덕션 → .aab 업로드) → 앱 콘텐츠·배포 국가를 입력하고 프로덕션 트랙으로 출시한다.
- 스토어 문구·스크린샷 순서·체크리스트의 준비본은 `store-metadata/{버전}/release.json`이고 변경해도 외부 스토어에 자동 게시되지 않는다. 한·영 등록 정보는 `store-metadata/listing/`에 있고 `pnpm store:check`로 검사한다(`store:export`, `store:art`, `store:screens`).
- API URL이 프로덕션 서버인지, 버전 번호(`app.config.ts`), 앱 아이콘·스플래시를 제출 전에 확인한다.

## Play Console: Android 15 edge-to-edge deprecated API 경고

Play Console은 AAB에서 Android 15(API 35)가 지원 중단한 시스템 바 색·컷아웃 API 호출을 찾아 경고한다. 호출 위치는 R8로 줄인 라이브러리 프레임으로 보이고 앱 코드가 아니다.

| 출처                                                                                                                               | 호출                                                                                                                                                                                         | 하는 일                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React Native 0.88 `WindowUtil.kt`의 `Window.enableEdgeToEdge()`(시작 때 `ReactActivityDelegate`, 모달 창마다 `ReactModalHostView`) | `statusBarColor = TRANSPARENT`, `navigationBarColor`(API 29+ 투명, 그 아래 scrim 색), `layoutInDisplayCutoutMode`(API 30+ `ALWAYS`, 28~29 `SHORT_EDGES`), `setDecorFitsSystemWindows(false)` | Android 14 이하에서 바를 투명하게 하고 화면을 바 뒤까지 그린다                                                                                                                                                   |
| react-native-keyboard-controller 1.22.7 `StatusBarManagerCompatModuleImpl`                                                         | `setColor`의 `window.statusBarColor`                                                                                                                                                         | 같은 이름(`StatusBarManager`)으로 RN 모듈을 대신한다. RN 0.88 JS는 색 메서드를 부르지 않고, `KeyboardProvider` 아래 edge-to-edge 빌드(`IS_EDGE_TO_EDGE_ENABLED`)는 색을 쓰기 전에 돌아가지만 바이트코드에 남는다 |

- **Android 15에서는 효과가 없다.** [Android 15 동작 변경](https://developer.android.com/about/versions/15/behavior-changes-15#edge-to-edge): "`setStatusBarColor` and `R.attr#statusBarColor` are deprecated and have no effect on Android 15." 내비게이션 바 색은 "deprecated and don't affect gesture navigation"이고 3버튼 내비게이션에만 남는다. 컷아웃은 "`SHORT_EDGES`, `NEVER`, and `DEFAULT` are interpreted as `ALWAYS`"다. RN이 넣는 값(투명·`ALWAYS`)이 Android 15 기본과 같아 화면은 그대로이고, Android 14 이하는 이 호출로 edge-to-edge가 된다.
- **앱 코드 호출은 0건이다.** `git grep -nE 'statusBarColor|statusBarBackgroundColor|navigationBarColor|statusBarTranslucent|navigationBarTranslucent|setBackgroundColorAsync|setBorderColorAsync|StatusBar\.set|androidStatusBar|androidNavigationBar|expo-navigation-bar|expo-status-bar' -- apps/mobile/src apps/mobile/app apps/mobile/app.config.ts apps/mobile/plugins apps/mobile/package.json`가 아무것도 찾지 않는다(1.15.2 [21/32]). RN 0.88 `StatusBar`에는 `backgroundColor`·`translucent`·`setBackgroundColor`·`setTranslucent`가 없고, react-native-screens 4.30은 화면 옵션 `statusBarColor`·`navigationBarColor` setter를 Android에서 빈 함수로 둔다.
- **빌드 설정.** targetSdk는 Expo SDK 58 기본 36이고 prebuild 템플릿의 `android/gradle.properties`가 `edgeToEdgeEnabled=true`다. Expo는 이 값을 끄는 설정을 없앴다(`withEdgeToEdge`: Android 16은 edge-to-edge가 의무).
- **앱에서 고칠 것은 없다.** 경고에 답할 때 이 절을 근거로 쓴다. 새 앱 코드가 같은 API를 부르지 않도록 `aido/no-system-bar-color`가 `src`·`app`·`app.config.ts`·`plugins`를 본다(1.15.2 [32]에서 켠다).
- **RN·네이티브 라이브러리를 올린 뒤 다시 확인한다.** `apps/mobile`에서 `grep -rlE 'setStatusBarColor|setNavigationBarColor|statusBarColor *=|navigationBarColor *=|LAYOUT_IN_DISPLAY_CUTOUT_MODE_(SHORT_EDGES|DEFAULT)' node_modules/*/android/src node_modules/@*/*/android/src node_modules/react-native/ReactAndroid/src/main`이 지금은 위 두 파일과 react-native-screens `ScreenViewManager.kt`(빈 setter)만 찾는다. 결과가 바뀌면 이 표를 고친다.

## 배포 전 체크리스트

- [ ] 서버: 프로덕션 DB·환경 변수(OAuth 키 포함)·HTTPS, `pnpm db:migrate`, `curl https://api.aido.kr/health`
- [ ] 앱: `.env.production`(`APP_ENV`, `EXPO_PUBLIC_API_URL`), Google Services Secrets, 버전 번호
- [ ] 실기기: 소셜 로그인(Google·Apple·Kakao·Naver), API 호출, 푸시 알림, 오류 처리
- [ ] 보안: 민감 정보는 환경 변수, OAuth 콜백 URL은 프로덕션 도메인(API 서버 설정), HTTPS

## 트러블슈팅

- **빌드 실패**: `eas secret:list`로 Secret을 확인하고 `eas build --clear-cache --profile production --platform ios`로 캐시를 지우고 다시 빌드한다.
- **OAuth 로그인 실패**: 공급자 콘솔의 redirect URI는 앱의 `redirectUri`가 아니라 서버 콜백(`*_CALLBACK_URL`, `apps/api/src/platform/config/schemas/oauth.schema.ts`)이다. Apple은 App ID에 Sign In with Apple을 켠다. 앱이 쓰는 `ENV.API_URL`과 API 서버 로그의 콜백 도착을 확인한다.
- **실기기에서 API 연결 실패**: 개발은 같은 Wi-Fi와 API URL 자동 감지 로그를, 프로덕션은 도메인과 HTTPS 인증서를 확인한다.

## 스크립트

| 명령                                                                     | 설명                                                                                    |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `pnpm dev` · `dev:android` · `dev:ios`                                   | Metro(Android는 `adb reverse` 포함)                                                     |
| `pnpm check`(루트)                                                       | 형식·이름·lint·경계·안 쓰는 코드·타입([가드레일](./architecture/structure.md#가드레일)) |
| `pnpm check:ipa-linkage` · `check:native-icons` · `check:revenuecat-env` | 빌드 산출물·자산·RevenueCat 환경 검사                                                   |
| `pnpm test:node`                                                         | 설정·스크립트 테스트(node:test, [testing](./testing.md#파일-위치와-이름))               |

참고: [EAS Build](https://docs.expo.dev/build/introduction/) · [EAS Submit](https://docs.expo.dev/submit/introduction/) · [App Store Connect](https://appstoreconnect.apple.com/) · [Play Console](https://play.google.com/console)
