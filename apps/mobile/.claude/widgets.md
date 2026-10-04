# 홈 화면 위젯 가이드 — Expo SDK 58

**Version**: 2.1.0 · **Last Updated**: 2026-10-04 · **Owner**: Aido Mobile Team

양 플랫폼 모두 `expo-widgets`를 사용한다. iOS의 기존 `AidoTodayList` identity와 App Group은
유지한다. Android는 이전 provider component를 Expo Widgets receiver로 연결하여 기존 위젯 ID와
배치를 유지한다. 이전 인증 토큰·SecureStore 계약은 변경하지 않는다.

## 데이터 흐름과 소유권

```text
AuthProvider
  → useWidgetSnapshotSync(authState)
  → 현재 계정·날짜로 scoped된 TodoSummary query + 기존 주간 daily completions query
  → WidgetSyncService
  → widget-snapshot.mapper / widget-props.mapper
  → WidgetBridge
      iOS: updateTimeline(현재, 다음 로컬 자정 stale)
      Android: updateSnapshot(3종 위젯)
```

- renderer는 토큰·SecureStore·네트워크·앱 Provider에 접근하지 않는다.
- locale·번역·카테고리 색은 앱에서 직렬화 가능한 props로 만든다.
- 인증 판정 중에는 이전 snapshot을 유지한다. 미인증이 확정되면 loggedOut을 기록한다.
- 요약은 현재 계정과 날짜가 맞을 때만 기록한다. languageChanged도 인증을 먼저 확인한다.
- native 쓰기를 직렬화하고 오래된 대기 작업을 건너뛰어 로그아웃이 최종 상태가 된다.
- 내용이 같으면 updatedAt만 바뀐 snapshot은 다시 쓰지 않는다. 실패한 쓰기는 다시 시도할 수 있다.
- WidgetSyncService는 native·관측 실패를 앱 인증 흐름으로 throw하지 않는다.
- query는 `throwOnError: false`를 유지한다. 위젯 조회 실패로 앱의 전역 boundary를 열지 않는다.

## 플랫폼 설정

`app.config.ts`에서 `expo-widgets`의 `enableAndroid: true`를 명시한다.
플랫폼 설정은 `widgets[].ios`와 `widgets[].android` 아래에 둔다.

| 이름             | iOS                                      | Android | 목록 행                  |
| ---------------- | ---------------------------------------- | ------- | ------------------------ |
| AidoTodaySummary | 등록하지 않음 (`ios: null`)              | 2×2     | 0                        |
| AidoTodayList    | systemSmall / systemMedium / systemLarge | 4×2     | 0 / 2 / 4 또는 Android 2 |
| AidoTodayLarge   | 등록하지 않음 (`ios: null`)              | 4×4     | 4 + 주간 달력            |

`presentations/widgets.ios.tsx`와 `widgets.android.tsx`는 같은 `WidgetProps`를 소비한다.
지원하지 않는 web의 `widgets.tsx`는 빈 목록을 제공한다. iOS bundle identifier와 환경별
`group.<bundleIdentifier>`를 변경하지 않는다.

## 날짜 경계와 OS 갱신

- 앱의 LocalDateProvider가 현재 로컬 날짜와 자정 timer를 소유한다.
- iOS에는 현재와 다음 로컬 자정의 stale 엔트리를 쓴다. WidgetKit 갱신은 OS 정책을 따른다.
- SDK 58의 Android `updateTimeline`은 no-op이다. Android에서는 `updateSnapshot`만 쓴다.
- Android WidgetEnvironment에는 entry date·family가 없다. renderer 실행 경계에서 현재 날짜를
  읽어 snapshot 날짜와 비교하고, 위젯별 `maxRows` prop으로 정보량을 결정한다.
- Expo의 Android XML은 updatePeriodMillis가 0이다. `withWidgetRefreshInterval`은 Expo의 `withFinalizedMod`에서 위젯 XML 생성이 끝난 뒤
  3개 XML에 최소 30분 갱신을 설정한다. 파일이나 갱신 속성이 없으면 prebuild를 실패시킨다.
- Doze·launcher 정책으로 지연될 수 있으므로 정확한 자정이나 최대 30분을 보장하지 않는다.

## 격리된 renderer와 디자인

`'widget'` 함수는 격리된 runtime에서 실행된다. 모듈 helper·React hook·앱 상태를 closure로
참조하지 않는다. 렌더에 필요한 helper와 palette는 함수 내부에 둔다.

- iOS: SwiftUI Text/HStack/VStack/Spacer/Gauge 등 지원 primitive 사용.
- Android: Expo UI Jetpack Compose의 Glance 변환이 지원하는 Box/Column/Row/Text/Spacer/Progress 사용.
- Android에서 `weight`, `alpha`, `spacedBy` 등을 지원한다고 가정하지 않는다. 명시적 Spacer 크기,
  지원되는 padding·size·Box alignment로 배치한다.
- 팔레트는 global.css의 고정 hex 값을 사용한다. 토큰 변경 시 양 renderer의 팔레트를 함께 갱신한다.
- 시스템 테마를 따르고 뉴트럴 배경·타이포 위계·브랜드 오렌지 포인트를 유지한다.
- Android 시스템 폰트와 Glance 제약을 따른다. 앱의 custom font와 동일 렌더링을 보장하지 않는다.
- iOS의 고정 row 슬롯은 기존 native renderer의 배열 child 제한 때문에 유지한다.
- Android Glance Column은 직접 child를 최대 10개만 표시한다. header·progress·Spacer를 포함해
  이 제한을 지키고, 큰 위젯은 주간 달력·오늘의 할 일 4행·생성 버튼을 각 Column으로 구분한다.
  각 Column의 child 수와 표시 행 수를 isolated widget runtime 회귀 테스트로 확인한다.

## 앱 열기와 compatibility patch

SDK 58.0.11의 Android JS interaction만으로는 종료된 앱의 Activity를 열 수 없다.
기존 compatibility patch인 `patches/expo-widgets@58.0.11.patch`에서 공식 Glance
`actionStartActivity`를 연결한다. `opensApp: true` root는 오늘 화면을 열고, 개별 버튼은
허용된 앱 scheme의 오늘·고정 날짜·할 일 상세·생성 URL만 연다. URL을 받지 못하는 이전
snapshot은 현재 package의 launch Activity를 연다. 인증 정보는 전달하지 않는다.

- iOS는 공식 SwiftUI `Link`와 root의 `widgetURL` 한 개를 사용한다.
- scheme은 Expo config에서 읽는다. development·preview·production 링크를 분리한다.
- 생성 링크는 `feed?date=today&action=add-todo`다. leaf route의 Zod search schema로 해석하고
  기존 categories query와 `AddTodoBottomSheet`를 재사용한다. 실패·카테고리 없음은 재시도와
  설정 안내를 제공한다. 예약한 frame은 cleanup에서 취소한다.
- provider identity, App Group, snapshot v1은 유지한다. 새 URL·주간 데이터·문구는 optional이라
  이전 props를 복원해도 앱 실행과 기존 진행률을 표시한다.
- patch는 provider 이름을 공식 manifest metadata로 조회한다. SDK snapshot 쓰기와 초기 이관은
  같은 SharedPreferences monitor에서 수행한다.
- 58.0.11의 공식 Android active Glance session 갱신 수정과 Expo UI 측정 크래시 수정을 반영한다.

작은 위젯의 개수·진행률·연속 기록 배치는 유지한다. 두 발자국은 브랜드 오렌지로 밝게 표시한다.
Android drawable은 `withWidgetAssets` Expo config plugin에서 기존 `ic_paw.svg`를 재사용해 생성한다.
중간 위젯은 오늘 할 일 2개와 생성 버튼, 큰 위젯은 주간 달력과 오늘 할 일 4개를 보여준다.
주간 완료 데이터가 없으면 완료 발자국을 추측하지 않으며 오늘은 최신 요약을 우선한다.

첫 설치의 snapshot 부재에는 기존 카탈로그의 한국어 initialProps를 사용한다. 앱 동기화 이후
현재 언어로 바뀐다. initialLayout 모듈은 build-time VM에서 실행되므로 native 모듈이나 policy의
runtime dependency를 import하지 않는다.
앱을 열어 동기화하기 전에도 앱 실행 버튼의 native 계약이 적용된다.

layout registry patch는 `initialLayout`의 상대 경로를 실제 파일 경로로 정규화한다.
macOS EAS local build의 `/tmp`·`/private/tmp` 또는 `/var`·`/private/var` alias가
Metro의 파일 경로와 달라져 기존 파일을 찾지 못하는 문제를 방지한다.

## 제거한 레거시와 관측

`react-native-android-widget`, 앱의 MMKV widget repository, headless task handler,
WorkManager 버전 정렬 plugin, 이전 renderer와 전용 색상 변환을 제거했다.
MMKV의 다른 feature 사용처는 유지한다. snapshot v1의 optional compactStreak 계약도 유지한다.

SDK 58은 이전 Android provider의 설치·삭제 lifecycle 이벤트를 제공하지 않는다.
`widget_added/widget_removed` 카탈로그는 제거하며, 지원하지 않는 지표를 추정하지 않는다.
동기화 성공은 기존 ErrorReporter breadcrumb, 실패는 `feature: widget`로 보고한다.

## 검증

모델·mapper·sync service를 단위 검증한다. 지연된 쓰기와 로그아웃 순서, 중복 snapshot,
실패 후 재시도, 이전 compactStreak props, 손상 색상 경계를 포함한다.

```sh
pnpm --filter @aido/mobile test --runInBand src/features/widget
```

실제 development/release native 빌드에서 다음을 확인한다. Expo Go로 검증하지 않는다.

- iOS 3 family와 Android 3 provider의 picker·크기·정렬.
- 앱 최초 실행 전 initialProps 및 종료 상태에서 위젯 탭 → 앱 실행.
- 할 일 변경·로그아웃·재로그인·계정 전환·언어 변경.
- 빈 목록·현재 데이터·로그아웃·날짜 만료.
- light/dark와 큰 글꼴, Samsung One UI/Pixel launcher.
- 자정·foreground 복귀·오프라인 상황의 snapshot 안전성.

## 공식 근거

- [Expo SDK 58](https://expo.dev/changelog/sdk-58-beta)
- [Expo Widgets](https://docs.expo.dev/versions/v58.0.0/sdk/widgets/)
- [SDK 구현](https://github.com/expo/expo/tree/main/packages/expo-widgets)
- [Android Glance Column 제한](https://developer.android.com/reference/kotlin/androidx/glance/layout/Column.composable)
- [Android Glance interaction](https://developer.android.com/develop/ui/compose/glance/user-interaction)
- [Android 주기 갱신](https://developer.android.com/develop/ui/views/appwidgets/advanced)

## 기존 Android 위젯 보존

`withAndroidWidgetCompatibility`는 Expo XML·receiver 생성 후 다음 component 이름을 유지한다.

- `com.aido.mobile.widget.AidoTodaySummary`
- `com.aido.mobile.widget.AidoTodayList`
- `com.aido.mobile.widget.AidoTodayLarge`

각 receiver는 SDK의 `ExpoWidgetsAppWidgetProvider`를 상속한다. 이전 `WIDGET_CLICK` action은
앱을 열고, 렌더링·갱신은 SDK에 위임한다. 이전 renderer나 collection service는 유지하지 않는다.
OS가 가진 widget ID·크기 옵션과 `${package}.WIDGET_SIZES` 설정은 삭제하지 않는다.

앱 실행 전 receiver가 읽는 snapshot은 기존 `files/mmkv/widget-storage`의
`aido_widget_snapshot_v1`이다. MMKV 2.4.1의 read-only API로 읽고 `finally`에서 닫는다.
동일 core 버전은 React Native MMKV 4.4.0의 native dependency와 맞춘다. 이 의존성을 올릴 때
`withAndroidWidgetCompatibility`의 명시 버전도 재검토한다.

SDK props가 없는 이름만 채우고, 새로운 계정·로그아웃 props가 먼저 기록됐으면 보존한다.
빈 값·손상 JSON·잘못된 타입은 `stale`과 앱 열기 안내로 처리한다. 토큰·계정 저장소를 읽거나
네트워크에 접근하지 않으며 이전 MMKV 파일을 수정하지 않는다.

### 재현 가능한 APK 업그레이드 검증

전용 `AidoWidgetUpgrade` AVD에서 실행한다. harness는 이 이름을 확인한 뒤 해당 QA 앱 데이터만
초기화한다. 현재 debug APK를 먼저 빌드하고 이전 APK의 절대 경로를 제공한다.

```sh
node apps/mobile/scripts/check-android-widget-upgrade.mjs \
  --device emulator-5556 \
  --legacy-apk /absolute/path/to/previous/app-debug.apk
```

2026-10-01 검증은 보관된 1.8.0 APK → 1.10.0 APK로 수행했다. 1.9.0 기준 revision의
provider 이름과 동일함도 확인했다. 실제 AppWidgetHost에 등록한 3개 ID·component가 유지됐고,
SDK RemoteViews의 제목·개수·목록이 현재 TypeScript mapper fixture와 일치했다. SDK updater의
3개 갱신, 손상·잘못된 타입 fallback, 50회 동시 계정 쓰기 경합을 통과했다. 이관 전후 이전
MMKV data·CRC의 SHA-256이 동일했다. 결과 JSON과 native instrumentation 로그는 실행 시
출력되는 임시 artifact 경로에 남는다. 실제 OEM launcher·release 빌드의 시각 검증은 별도로 수행한다.

### 2026-10-02 실제 홈 화면 검증

- iOS 27 Simulator: WidgetKit picker에서 small·medium·large를 실제 홈에 추가했다. 오늘 날짜,
  4건의 목록·완료 표시·진행률이 앱과 일치했다. 완료 1/4 → 2/4 → 1/4 변경을 large·medium에서
  확인하고, small도 원복된 1/4·25%를 표시했다. 위젯 탭으로 현재 앱을 열었다.
- Android API 36.1 Pixel Launcher: 기존 native QA host ID와 MMKV data·CRC를 유지한 상태에서
  APK를 업데이트했다. 실제 picker에서 2×2·4×2·4×4를 추가하고 날짜 만료 안내·loggedOut·
  로그인 후 목록과 진행률을 확인했다. 종료된 앱의 Activity를 위젯 탭으로 실행했다.
- Android 4×4 시각 검증에서 Glance child 제한에 따른 목록 누락을 발견하고 수정했다.
  SDK snapshot을 임시 QA fixture로 갱신해 실제 8행 전체·완료 표시·빈 안내도 확인하고 원래
  snapshot을 복원했다. 이 과정은 계정·API 데이터·기존 MMKV를 변경하지 않는다.

이는 development native build의 검증이다. 실제 iOS 이전 앱 binary 업그레이드, OEM launcher,
release 빌드, 시스템 큰 글꼴·dark 테마 및 정확한 자정 OS 갱신을 통과했다고 주장하지 않는다.

### 1.11.0 검증 진행 기록

- isolated Android/iOS renderer, model·mapper·sync service 36개 테스트 통과.
- Android API 36.1 debug APK와 iOS 26.5 Simulator 앱 빌드·설치 통과.
- Pixel Launcher에 실제 작은 위젯을 추가하고 1/5·20% 및 밝은 두 발자국 표시를 확인했다.
- 중간·큰 위젯의 실제 배치와 개별 링크, 다크 모드 검증 결과는 release 문서에서 관리한다.
