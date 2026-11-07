# 푸시 알림 클라이언트

앱이 이 기기의 알림 권한·푸시 토큰을 서버에 맞추고, 사용자에게 권한을 묻는 방식이다.
서버가 언제 누구에게 보내는지는 [apps/api/docs/push-notifications.md](../../api/docs/push-notifications.md)를 본다. 여기서 반복하지 않는다.

## 구성

```
PushNotificationGateway (core/ports) ← expoPushNotificationGateway (shared/infra/notification)
                    ↓
        PushDeviceService (features/notification/apis) → PUT /v1/notifications/push-devices/{deviceId}
```

| 조각                                          | 역할                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------- |
| `domains/push-permission.model.ts`            | 권한 모델 + `PushPermissionPolicy`(다음 단계·14일 숨김 판정)          |
| `apis/push-permission.mapper.ts`              | OS 값 → 모델, 모델·토큰 → 보고 입력                                   |
| `apis/push-device.service.ts`                 | 권한 읽기·요청, 채널 → 토큰 → 보고, 로그아웃 해제                     |
| `apis/push-prompt.{repository,service}.ts`    | 홈 안내를 닫은 시각을 계정마다 MMKV에 저장                            |
| `hooks/use-push-device-sync.ts`               | 로그인한 동안 보고 시점을 모은다(`NotificationProvider`가 한 번 호출) |
| `hooks/use-notification-response-observer.ts` | 눌린 푸시의 입구 하나. `AuthGateLayout`이 호출한다                    |
| `hooks/use-notification-entry.ts`             | 콜드 스타트에서 첫 화면을 정하는 진입 상태(레이아웃, `app/index.tsx`) |
| `apis/notification-entry.store.ts`            | 눌린 응답 슬롯. 경계가 다시 그려도 남도록 DI가 소유한다               |
| `utils/notification-destination.ts`           | 푸시 `navigation`과 구 필드를 앱 목적지로 바꾼다                      |

## 클라이언트가 하는 일

1. OS 권한을 읽는다. iOS 임시 허용(`PROVISIONAL`·`EPHEMERAL`)은 모두 `PROVISIONAL`로 바꾼다. 알림이 조용히 도착하므로 허용으로 본다.
2. Android 알림 채널을 먼저 만든다. Android 13+는 채널이 있어야 권한 창과 토큰 발급이 동작한다. 실패해도 권한은 읽고 보고한다.
3. 허용 상태(`GRANTED`·`PROVISIONAL`)면 Expo 푸시 토큰을 받는다. `Device.isDevice`로 막지 않는다. Expo SDK 58에서는 시뮬레이터·에뮬레이터도 토큰을 받을 수 있다. 오프라인·APNs 없음·Play 서비스 없음으로 실패하면 토큰 없이 권한만 보고한다.
4. `PUT /v1/notifications/push-devices/{deviceId}`로 `{ permission, token, payloadVersion }`을 보낸다. 같은 값을 이번 세션에 이미 보냈으면 요청하지 않는다(`force`로 무시). 웹은 보내지 않는다.

## 보고 시점

| 시점                       | 방식                                                                   |
| -------------------------- | ---------------------------------------------------------------------- |
| 콜드 스타트 후 로그인 확인 | `force` 보고. 다른 계정이 쓰던 기기일 수 있어 같은 값이어도 보낸다     |
| 앱이 active로 돌아옴       | 1초 debounce 후 보고. 권한 창·제어 센터 왕복을 한 번으로 묶는다        |
| 푸시 탭                    | 1초 debounce 후 보고. 앞에 떠 있는 동안 누르면 복귀 이벤트가 없다      |
| 기기 시간대 변경           | `force` 보고. 서버는 시간대를 `X-Timezone`에서 읽는다                  |
| 푸시 토큰 변경 리스너      | 보고. 토큰 값이 바뀔 때만 알려 보고 → 토큰 발급 → 이벤트 루프를 막는다 |
| 앱 언어 변경               | `force` 보고. 서버는 푸시 문구 언어를 `Accept-Language`에서 읽는다     |
| 권한 요청 직후             | 바뀐 권한을 바로 보고한다. 실패해도 요청 결과는 그대로 돌려준다        |

- 보고 중에 다시 불리면 끝난 뒤 한 번만 더 보낸다.
- 권한·토큰이 같아도 시간대가 다르면 다시 보낸다. 요청이 없는 화면에 돌아와도 서버 시간대가 바로 바뀐다. 보고가 성공하면 `useTimezoneChangeNotice`가 처음 알아챈 변경을 한 번 안내한다.
- 요청 헤더(`X-Request-Id`·`X-Timezone`·`Accept-Language`)는 `shared/infra/http/request-headers.ts`가 요청마다 붙인다.

## 권한 묻기

시스템 권한 창은 iOS에서 한 번만 뜬다. 그래서 먼저 앱 안 안내(`PushPermissionDialog`)로 묻고, 허용하면 시스템 창을 띄운다.

| 위치               | 컴포넌트                                                                        | 동작                                                          |
| ------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 홈 피드 카드       | `PushPermissionNotice` (`.Ask`·`.RequestSystem`·`.OpenSettings`·`.EnableInApp`) | 다음 단계에 맞는 카드 한 장. 닫으면 계정마다 14일 동안 숨긴다 |
| 활성화 시점        | `ActivationPushPermissionDialog` + `usePushPermissionAskMoment`                 | 아직 묻지 않은 사용자에게 계정·활성화 시점마다 한 번 안내     |
| 설정 > 알림 > 푸시 | `PushPermissionStatusRow`                                                       | 현재 OS 권한 상태와 바로 할 행동을 항상 보여 준다             |

다음 단계는 `PushPermissionPolicy.nextStep(permission, { pushEnabled })`가 정한다.

| 단계             | 조건                           | 행동                   |
| ---------------- | ------------------------------ | ---------------------- |
| `ASK`            | 아직 묻지 않음                 | 앱 안 안내 → 시스템 창 |
| `REQUEST_SYSTEM` | 거부됐지만 다시 물을 수 있음   | 시스템 창              |
| `OPEN_SETTINGS`  | 거부됐고 다시 물을 수 없음     | OS 설정 열기           |
| `ENABLE_IN_APP`  | OS는 허용, 앱 푸시 설정이 꺼짐 | 설정 화면으로 이동     |
| `NONE`           | OS 허용 + 앱 설정 켜짐         | 안내 없음              |

- 활성화 시점 안내는 신규 코호트가 활성화하기 전에는 열지 않는다(`ActivationPolicy.shouldRegisterPushAutomatically`).
- 앱 푸시 설정을 켜면 이어서 OS 권한을 묻는다(`useUpdatePushEnabledMutationOptions`).
- 분석 이벤트는 [observability.md](../.claude/observability.md#푸시-권한-퍼널)를 본다.

## 로그아웃과 배지

- 로그아웃은 `PushDeviceService.unregister()`로 `DELETE v1/notifications/token?deviceId=`를 보낸다. 진행 중인 보고가 있으면 먼저 끝나기를 기다린다. 늦게 도착한 보고가 해제된 기기를 되살리지 않게 하기 위해서다. 해제가 실패하거나 오프라인이어도 로컬 세션은 항상 지운다(`logOutDevice`).
- 오프라인 로그아웃은 온라인이 되면 `POST v1/auth/logout`으로 서버 세션을 풀고, 서버가 `releaseSessions`로 그 세션의 기기를 함께 푼다([오프라인 로그아웃](authentication_guide.md#오프라인-로그아웃)). 기록이 만료되면(24시간) refresh 만료 또는 다음 로그인의 소유권 이전까지 이전 계정 알림이 올 수 있다.
- 탈퇴는 앱이 해제하지 않는다. 서버 탈퇴가 전 세션과 기기를 함께 푼다. 탈퇴 전에 풀면 비밀번호 오류에도 이 기기의 알림이 끊긴다.
- 앱 아이콘 배지는 읽지 않은 알림 수에 맞춘다. 콜드 스타트의 인증 확인 중(`loading`·`locked`)에는 지우지 않는다. 로그아웃(`unauthenticated`)일 때만 지운다(`syncNotificationBadge`).

## 눌린 푸시 처리

Expo Router 권장대로 루트 레이아웃의 관찰 훅 하나가 `getLastNotificationResponse`와 응답 리스너를 받아 슬롯에 넣고, 처리 뒤 `clearLastNotificationResponse`로 재시작 중복을 막는다. 푸시는 URL을 싣지 않으므로 `+native-intent`는 관여하지 않는다.

| 상황                             | 동작                                                                                                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 인증 확인 중(`loading`·`locked`) | 슬롯에 둔다. `locked`는 스피너로 넘기고 잠금이 풀리면 이어간다                                                                                                        |
| 로그아웃 상태                    | 슬롯에 둔다(10분). 로그인 뒤 같은 Index 경로로 한 번만 연다                                                                                                           |
| 연속 두 탭                       | 슬롯이 하나라 마지막 탭만 연다. 앞 탭의 늦은 읽음 응답은 버린다                                                                                                       |
| 로그아웃·세션 만료               | 슬롯과 마지막 응답을 지운다. 진행 중 응답은 `SessionEpoch`와 슬롯 id로 버린다                                                                                         |
| 다른 계정 알림·없는 대상         | 읽음이 403·404면 버리고 머문다. 페이로드에 수신자 id가 없어 이것이 유일한 방어다                                                                                      |
| 오프라인·5xx·읽음 지연           | `NOTIFICATION_READ_BUDGET_MS`(800ms, 초깃값, Release 측정 뒤 확정) 안에 끝내고 연다. 서버의 `opened`가 읽음도 처리하므로 mutation이 연결될 때까지 멈췄다가 재시도한다 |
| 모르는 타입, `navigation` 있음   | `navigation`을 따른다. Analytics `type`은 `UNKNOWN`이다                                                                                                               |
| 모르는 타입, `navigation` 없음   | 알림 목록으로 연다                                                                                                                                                    |
| 서버의 새 kind, 틀린 모양        | 계약이 `navigation`만 버려 구 필드로 간다                                                                                                                             |
| 수신 거부 버튼                   | 인증 없이 공개 API로 보낸다. 다음 탭에 밀리지 않게 슬롯을 따로 두고 실패하면 포그라운드 복귀 때 다시 보낸다(10분)                                                     |
| 알림함 항목                      | DTO에 `navigation`이 없어 영구히 구 필드로 간다                                                                                                                       |

### 목적지 대조

구 필드 경로는 알림함이 영구히 쓰므로 지우지 않는다. `packages/api/test-fixtures/notification-navigation.cases.json`(`dist`에 들어가지 않음)을 서버 spec과 앱 test가 함께 읽어 31개 타입과 19개 kind를 묶는다. 앱은 compact·medium·expanded와 보는 사람 없음·주인·다른 사람 조합에서 두 경로가 같은 곳으로 가는지 본다.

서버가 만들지 않는 입력에서만 나는 차이는 `knownDifference`로 적고, 실제로 다른지 테스트한다.

| 입력                           | 구 필드              | 서버 `navigation`   |
| ------------------------------ | -------------------- | ------------------- |
| `routing`에 `commentId`만 있음 | 댓글 위치            | `TODO`, 댓글 없음   |
| 옮기기 링크의 모르는 `reason`  | 비로 옮기기 화면     | `WEATHER`           |
| `todoIds=1e2`                  | 거부, `WEATHER` 화면 | `Number`로 읽어 100 |
| `todoIds=0012`                 | 거부, `WEATHER` 화면 | `Number`로 읽어 12  |

### 콜드 스타트 순서

| 순서 | 이전                                            | 지금                                               |
| ---- | ----------------------------------------------- | -------------------------------------------------- |
| 1    | 스플래시 유지, 글꼴·암호화 저장소 대기          | 같음                                               |
| 2    | 응답 보류, `/` → `/loading`                     | 슬롯에 받음, `/` → `/loading`                      |
| 3    | 인증 확정 → **스플래시 hide**                   | 인증과 복원 확정. 스플래시와 로딩 가드 유지        |
| 4    | `/` → `/feed` (피드 focus, 안내 가능)           | 읽음 확인(최대 800ms)                              |
| 5    | `me` 왕복 대기                                  | 가드 해제 → Index가 목적지로 `Redirect withAnchor` |
| 6    | **`markAsRead` 왕복** (오프라인이면 이동 안 함) | 다음 프레임에 스플래시 hide                        |
| 7    | `router.navigate`, 피드 위로 슬라이드           | `clearLastResponse`, `opened` 기록                 |

- 피드는 anchor로 아래에 있고 focus되지 않아 안내와 화면 기록이 생기지 않는다. 뒤로 가기는 피드다.
- 외부 링크와 이동 없음은 경로가 없어 피드로 간 뒤 처리한다.
- 스플래시에 갇히지 않는다. 읽음은 예산으로 항상 끝나고, 진입 대기는 3초 상한(`NOTIFICATION_ENTRY_HOLD_MAX_MS`) 뒤 내리며, Index가 이동하지 못하면 슬롯을 비워 피드로 보낸다. 루트 오류 경계와 `AppProviders`의 조회 오류 경계도 내린다.
- 이 순서(1안)로 확정했다. iOS 시뮬레이터 Release에서 앱 종료 상태의 알림 탭이 스플래시 다음 바로 목적지로 가고(약 2.2초) 뒤로 가기는 탭 바가 있는 피드로 돌아감을 확인했다(2026-11-07). Android 폴드 Release는 로컬 알림 탭으로 피드와 상세 칸을 확인했다. 실제 APNs·FCM 경유와 배지는 실기기 체크리스트에 남겼다. 안 되면 Index 진입 커밋만 되돌리면 2안(피드로 간 뒤 이동까지 스플래시 유지)이 남는다.

### 기기별 동작 (코드 확인, expo-notifications 58.1.8)

| 항목             | iOS                                                  | Android                                                                                                                                                      |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| data 위치        | `userInfo["body"]` (`NotificationRecords.swift:331`) | 앱이 꺼졌거나 뒤에 있으면 extras의 `body` JSON(`toResponseBundleFromExtras`)                                                                                 |
| 응답 id          | 요청 identifier                                      | FCM `google.message_id`                                                                                                                                      |
| 꺼진 앱에서 누름 | 마지막 응답으로 읽음                                 | 리스너가 없어 보류됐다가 모듈이 만들어질 때 마지막 응답으로 넘어온다(`NotificationManager.addListener`)                                                      |
| `MARKETING` 버튼 | 카테고리로 표시                                      | `ExpoNotificationBuilder`가 그릴 때만 붙는다. 앱이 앞에 있을 때 표시와 로컬 알림이 해당하고, 뒤에 있을 때 FCM이 직접 그린 알림에는 없다(추정, 실기기 미확인) |
| 수신 거부 누름   | `opensAppToForeground: true`로 앱이 열린다           | 같음. Android 12+는 전용 Activity PendingIntent                                                                                                              |

### 시뮬레이터 재현

iOS 개발 빌드 번들은 `com.aido.mobile.dev`다. 알림 권한은 앱에서 미리 허용한다. 시간 측정은 Release로 한다(개발 빌드는 Metro와 launcher가 시간을 늘린다).

```json
{
  "Simulator Target Bundle": "com.aido.mobile.dev",
  "aps": { "alert": { "title": "댓글", "body": "새 댓글이 있어요" }, "sound": "default" },
  "body": {
    "notificationId": 0,
    "type": "TODO_SHARED",
    "action": { "type": "DEEP_LINK" },
    "context": { "todoId": 42 },
    "navigation": { "kind": "TODO", "todoId": 42 }
  }
}
```

```bash
xcrun simctl terminate booted com.aido.mobile.dev
xcrun simctl io booted recordVideo coldstart.mp4   # 다른 터미널에서
xcrun simctl push booted com.aido.mobile.dev payload.apns
# 배너를 손으로 탭하고 영상을 프레임 단위로 본다
```

Android 에뮬레이터는 FCM 없이 로컬 알림으로 본다. 임시 코드로 `Notifications.scheduleNotificationAsync`에 같은 `data`를 넣어 예약하고, 커밋하지 않는다. 앱을 끌 때는 예약이 지워지는 `am force-stop` 대신 최근 앱에서 밀어 끈다.

## 테스트

포트를 구현한 `createPushNotificationGatewayStub`을 DI로 넣는다. 예시는 `push-permission-card.test.tsx`, `use-push-device-sync.test.tsx`, `expo-push-notification-gateway.test.ts`(어댑터 경계)다. 눌린 푸시의 진입 순서는 실제 라우터로 도는 `auth-gate-layout.push-entry.test.tsx`다. 자세한 규칙은 [testing-guide](../.claude/testing-guide.md)를 본다.
