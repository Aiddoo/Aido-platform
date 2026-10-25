# 홈 화면 위젯 가이드 — Expo SDK 58

**Version**: 3.2.0 · **Last Updated**: 2026-10-26 · **Owner**: Aido Mobile Team

iOS는 `expo-widgets`, Android는 `react-native-android-widget`의 공식 Expo config plugin과
HeadlessJS API를 사용한다. 앱에서 Kotlin·Swift source나 dependency patch를 생성하지 않는다.
두 플랫폼은 `WidgetSnapshot` v2(오늘·내일 day), mapper, Policy, `WidgetSyncService`, `WidgetBridge`를 공유한다.

Android를 `expo-widgets`로 옮기지 않는 이유: SDK 58 `expo-widgets`의 Android 구현에는 timeline이 없어
자정 전환을 미리 예약할 수 없고, AppWidget provider class가 바뀌면 사용자가 홈 화면에 둔 위젯이
사라진다. 그래서 기존 provider 이름을 유지하는 `react-native-android-widget`을 계속 사용한다.

## 데이터 흐름과 소유권

```text
useWidgetSnapshotSync(authState)
  → 현재 계정·로컬 날짜의 오늘·내일 TodoSummary(`?date=`) / daily completions Query
  → WidgetSyncService (직렬 쓰기·generation·내용/소유자 중복 제거)
  → 순수 snapshot / props mapper
  → 플랫폼별 WidgetBridge
      iOS: Expo Widgets timeline (지금: 오늘 · 다음 자정: 내일 · 그다음 자정: stale)
      Android: 기존 MMKV widget-storage snapshot + 공식 requestWidgetUpdate
```

- Query는 인증과 현재 계정 식별자가 준비될 때 활성화하고 `throwOnError: false`를 유지한다.
- 인증 판정 중에는 이전 snapshot을 유지한다. 로그아웃이 확정되면 loggedOut과 소유자 제거를 기록한다.
- 계정 식별자는 Android 저장소의 별도 metadata다. 공유 snapshot과 iOS timeline payload에 추가하지 않는다.
- 내일 요약은 서버가 그 날짜 기준으로 계산한 잠정 값이다(통계·스트릭). 서버 날짜가 요청과 다르거나
  거부되면 내일 day 없이 쓰고, Query가 5s→10s→20s→40s로 4번만 다시 묻는다.
- 렌더러는 전달받은 props만 사용한다. 토큰·네트워크·앱 Provider·현재 시각을 읽지 않는다.
- native 쓰기와 오류 관측 실패는 앱 인증·startup을 reject하지 않는다.
- 공식 `requestWidgetUpdate`의 완료는 launcher가 bitmap을 표시한 시점까지 보장하지 않는다.
  실제 화면의 갱신은 native QA에서 확인한다.

## 플랫폼 경계와 identity

`create-widget-bridge.ios.ts` / `.android.ts`, `widget-navigation-storage.android.ts`와 noop
fallback, `register-widget-task-handler.android.ts`와 noop fallback을 사용한다. iOS Metro graph에
Android renderer·HeadlessJS·MMKV widget adapter가 들어가지 않도록 platform module로 분리한다.

| 이름             | iOS                    | Android | 내용                                     |
| ---------------- | ---------------------- | ------- | ---------------------------------------- |
| AidoTodaySummary | 별도 등록 없음         | 2×2     | 완료 수·진행률·연속 기록·두 발자국       |
| AidoTodayList    | small / medium / large | 4×2     | iOS family별 0/2/4행, Android 2행·만들기 |
| AidoTodayLarge   | 별도 등록 없음         | 4×4     | 주간 달력·오늘 할 일 4행·만들기          |

Android 공식 plugin은 기존 `${android.package}.widget` 아래 같은 세 provider 이름을 생성한다.
기존 AppWidgetHost ID·배치·크기를 지우거나 위젯을 재등록하지 않는다. iOS `AidoTodayList` 이름,
extension bundle identifier와 App Group도 유지한다.

### 위젯 갤러리 이름·설명 다국어

OS 위젯 갤러리의 이름·설명은 앱 i18n이 아니라 Expo `locales`(`native-locales/{ko,en}.json`)가 만든다.
ko 기기는 한국어, 그 밖의 언어는 영어로 표시한다. 영어는 앱 카탈로그의 위젯 용어(`Today's to-dos`)를 따른다.

- iOS: `expo-widgets`는 `configurationDisplayName("오늘 할 일")`처럼 한국어 원문을 `LocalizedStringKey`로
  생성하고, 앱의 `Localizable.strings`를 위젯 확장 리소스에 넣는다. 키(원문)와 번역은 각 파일의
  `ios["Localizable.strings"]`에 두고 `app.config.ts`의 `displayName`·`description`과 글자까지 같게 유지한다.
  ko 파일에도 같은 키를 둬야 위젯 번들에 `ko.lproj`가 생겨 한국어 기기가 영어로 떨어지지 않는다.
- Android: provider `android:label`은 `@string/widget_{name}_label`, `android:description`은 공식 plugin이
  만드는 `@string/widget_{name}_description`이다. 번역은 각 파일의 `android` 항목(`values-b+{lang}`)이다.
  `plugins/withAndroidFallbackLocaleStrings`가 finalized 단계에서 en 항목을 기본 `values/`에 써서
  ko·en이 아닌 기기의 리소스 누락과 plugin의 `translatable="false"` 한국어 기본값을 함께 대체한다.

기존 `widget-storage`의 `aido_widget_snapshot_v1` key를 그대로 쓴다. 값은 v2 JSON이며, 이미 저장된
v1 JSON은 `storedWidgetSnapshotSchema`가 하루짜리 v2로 읽는다. 기존 Expo
SharedPreferences만 있고 MMKV snapshot이 없거나 현재 소유자를 알 수 없으면 개인 목록을
추측하지 않고 앱 열기 안내를 표시한다. 앱이 현재 계정 요약을 동기화한 뒤 정상 표시한다.
이 범위는 로그인·계정·할 일 데이터 호환성과 다르며, 업그레이드 전 위젯 표시 내용을 앱 실행
전에 완전히 복원한다고 주장하지 않는다.

## 날짜와 OS 갱신

LocalDateProvider가 자정 timer, foreground, `useCalendars()`(시간대·significant time change)의
날짜 재평가를 소유한다. 자정은 Intl 기기 시간대로 계산한다(`getNextLocalMidnight`). Provider 밖의
위젯 경계도 같은 `readDeviceLocalDateState()`로 오늘 key를 계산하고 dayjs 로컬 날짜를 쓰지 않는다.

- iOS: `toWidgetTimelineEntries`가 [지금: 오늘] → [다음 자정: 내일] → [그다음 자정: stale]을
  `updateTimeline`에 넣는다. 내일 day가 없으면 다음 자정부터 stale이다.
- Android: renderer가 저장된 days에서 오늘 key와 같은 day를 고른다(`WidgetSnapshotPolicy.selectDay`).
  세 provider는 공식 plugin의 `updatePeriodMillis: 1800000`을 사용한다. Doze·launcher 갱신 정책 때문에
  정확한 자정 또는 최대 30분 이내의 갱신을 보장하지 않는다.

## 디자인과 렌더링

같은 WidgetProps, 브랜드 #FF6B43, 밝은 배경 #FFFFFF, 어두운 배경 #171310을 사용한다.
작은 위젯 0/1·진행률·연속 기록은 유지하고 두 발자국을 밝은 주황색으로 표시한다.
중간은 오늘 할 일 2개와 만들기, 큰 위젯은 7일 달력·4개 할 일·초과 개수와 만들기다.

- iOS는 공식 SwiftUI primitive와 SF pawprint.fill을 사용한다.
- Android는 공식 FlexWidget / TextWidget / SvgWidget을 사용한다. 기존 paw SVG path를 재사용한다.
- 완성된 카드 한 개를 공식 ListWidget의 단일 항목으로 감싼다. 모든 날짜·할 일·생성 버튼은
  collection의 안정적인 PendingIntent template / fill-in 경로로 전달한다. 라이브러리의 clock 기반
  direct 클릭 충돌을 피하기 위해 native source나 vendor patch를 수정하지 않는다.
- Android renderer는 hooks 없이 props로만 tree를 만든다. library의 tree collector와 맞추기 위해
  `use no memo`를 선언한다.
- 실제 WidgetInfo.width/height로 카드 비율 small 1, medium 2.05, large .97을 맞추고 launcher의
  여유 slot 안에서 가운데 배치한다. 긴 제목은 한 줄 말줄임, 개수는 자리수에 따라 축소한다.
- Android TextWidget는 취소선을 제공하지 않는다. 완료는 색이 흐려진 제목과 체크 표시로 나타낸다.
  글자 폭을 추측해 선을 그리거나 native API를 패치하지 않는다.
- 첫 snapshot 부재는 카탈로그의 한국어 로그인 안내로 렌더링하고 현재 Expo scheme을 사용한다.

## Android 위젯에서 앱으로 이동

```text
실제 widget custom click
  → 공식 WIDGET_CLICK HeadlessJS handler
  → 허용 URI·widget 소유자 검증
  → MMKV pending command 저장
  → background/cold: Expo Linking으로 일반 feed만 깨움 / active: command 소비만
  → auth + me Query + (app) route 준비
  → useWidgetAppEntry
  → Expo Router.navigate(withAnchor) → command 조건부 삭제
```

종료된 process와 recents task가 함께 남은 Android에서 Expo의 startup onNewIntent 처리 전에
URI가 유실되는 경우를 실제 재현했다. launchMode 변경이나 OTA 비활성화로 회피하지 않는다.
공식 widget custom action과 기존 저장소 포트로 정확한 목적지를 먼저 저장하고 앱 준비 후 소비한다.

- domain model은 허용 scheme/feed date/action/todo id만 해석한다. Router Href 변환은 presentation mapper다.
- command는 5분 TTL, 미래 timestamp 거부, 현재 me.id와 소유자 일치 검사를 통과해야 한다.
- 로그아웃·계정 불일치·만료·손상 명령은 개인 화면 이동 없이 제거한다.
- 정확한 목적지와 생성 action은 native wake URI에 넣지 않는다. 이전 계정의 위젯이어도
  현재 계정 가드를 통과하기 전 개인 화면으로 자동 이동하지 않는다.
- 최신 명령만 소비한다. 이전 frame의 cleanup·조건부 삭제로 연속 탭의 최신 요청을 지우지 않는다.
- 실제 현재 pathname/search가 목적지와 같으면 다시 이동하지 않는다.
- 할 일은 기존 `/todo/:todoId`, 날짜는 feed, 만들기는 기존 AddTodoBottomSheet와 categories Query를 재사용한다.
- iOS는 기존 공식 SwiftUI Link/widgetURL와 최초 URL 복원 경로를 유지한다.

## 검증과 관측

테스트는 한국어 설명과 Given / When / Then을 사용한다. 모델·mapper·저장소·sync·entry hook·handler·
renderer·timeline에서 손상 JSON, 이전 v1, 자정 직전/정각 day 선택, 계정 전환, 로그아웃 경합, 최신 탭, TTL, unmount cleanup을 검증한다.

```sh
pnpm --filter @aido/mobile exec jest --runInBand src/features/widget src/bootstrap/hooks/use-widget-app-entry.test.tsx
pnpm lint && pnpm format:check && pnpm typecheck
```

실제 native QA는 release 문서의 최신 증거를 기준으로 한다. 종료 process + retained recents task는
force-stop/fresh task와 따로 확인하며 실제 launcher tap 뒤 Activity/목적 화면과 뒤로가기를 검증한다.
세 크기·라이트/다크·긴 문구·빈 상태·계정 전환·오프라인·생성 반복을 확인한다. OEM launcher,
실물 기기 push, 실제 결제 영수증을 에뮬레이터 검증으로 대체해 통과했다고 주장하지 않는다.
관측은 기존 ErrorReporter 포트를 사용하고 feature widget breadcrumb/error로 응집한다.

## 공식 근거

- [Expo 플랫폼 파일](https://docs.expo.dev/router/advanced/platform-specific-modules/)
- [Expo Widgets](https://docs.expo.dev/versions/v58.0.0/sdk/widgets/)
- [Expo Linking](https://docs.expo.dev/versions/v58.0.0/sdk/linking/)
- [Android widget Expo 등록](https://saleksovski.github.io/react-native-android-widget/docs/tutorial/register-widget-expo)
- [공식 custom click 처리](https://saleksovski.github.io/react-native-android-widget/docs/handling-clicks)
- [위젯 렌더 제한](https://saleksovski.github.io/react-native-android-widget/docs/limitations)
- [Android background Activity launch](https://developer.android.com/guide/components/activities/secure-bal)
