# 푸시 알림 클라이언트

앱이 이 기기의 알림 권한·푸시 토큰을 서버에 맞추고, 사용자에게 권한을 묻는 방식이다.
서버가 언제 누구에게 보내는지는 [apps/api/docs/push-notifications.md](../../api/docs/push-notifications.md)를 본다. 여기서 반복하지 않는다.

## 구성

```
PushNotificationGateway (core/ports) ← createExpoPushNotificationGateway (shared/infra/notification)
                    ↓
PushRegistrationService (features/notification/services) → PushDeviceApi (apis) → PUT /v1/notifications/push-devices/{deviceId}
```

| 조각                                                                                                 | 역할                                                                                                        |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `domains/push-permission.model.ts`                                                                   | 권한 모델 + `PushPermissionPolicy`(다음 단계·14일 숨김 판정)                                                |
| `apis/push-permission.mapper.ts`                                                                     | OS 권한 → 모델                                                                                              |
| `apis/push-device.mapper.ts`                                                                         | 권한·토큰 → 서버 보고 요청, 서버 기기 응답 → 모델                                                           |
| `apis/push-notification.mapper.ts`                                                                   | `parsePushNotification(data: unknown)`: 푸시 data → 모델 또는 `null`                                        |
| `apis/push-device.api.ts`                                                                            | `PushDeviceApi`: 기기 보고(PUT)·해제(DELETE)·인증 없는 해제(POST unregister) 요청                           |
| `services/push-registration.service.ts`                                                              | `PushRegistrationService`: 권한 읽기·요청, 토큰 → 보고, 로그아웃 해제와 해제 기록                           |
| `schemas/push-permission-deferred-at-storage.schema.ts`·`push-notice-dismissed-at-storage.schema.ts` | 알림 화면·피드 안내를 닫은 시각을 계정마다 저장하는 저장 값 정의                                            |
| `queries/push-permission.{queries,mutations}.ts`, `push-permission-cache.ts`                         | 권한 조회와 요청·설정 열기·앱 푸시 켜기. 쿼리 키 루트는 `['device', 'push-permission']`                     |
| `hooks/use-push-permission-action.ts`                                                                | `usePushPermissionAction({ source })` → `{ runStep(step), isPending }`. 권한 단계 실행과 추적의 유일한 입구 |
| `hooks/use-push-device-sync.ts`                                                                      | 로그인한 동안 보고 시점을 모은다(`NotificationProvider`가 한 번 호출)                                       |
| `hooks/use-push-notification-response.ts`                                                            | 눌린 푸시의 입구 하나. `AuthGateLayout`이 호출한다                                                          |
| `hooks/use-push-notification-entry.ts`                                                               | 콜드 스타트에서 첫 화면을 정하는 진입 상태(레이아웃, `app/index.tsx`)                                       |
| `stores/push-notification-entry.store.ts`                                                            | 눌린 응답 슬롯. 경계가 다시 그려도 남도록 DI가 소유한다                                                     |
| `stores/push-onboarding-guard.store.ts`                                                              | 앱 화면 묶음이 그린 알림 화면 guard 값. 피드가 열 차례를 이 값으로 읽고 DI가 소유한다                       |
| `apis/notification.mapper.ts`                                                                        | `toNotificationTarget`: 서버 `navigation` → 앱 `NotificationTarget`. 알림함 항목도 같은 길이다              |
| `domains/push-notification.model.ts`·`push-notification-response.model.ts`                           | 받은 푸시(`{ notificationId, type, target, … }`)와 누른 응답, 각자의 Policy                                 |
| `utils/notification-destination.ts`                                                                  | `toNotificationDestination(target, { windowSizeClass, viewerId })`: target → 앱 경로·외부 링크              |

## 클라이언트가 하는 일

1. OS 권한을 읽는다. iOS 임시 허용(`PROVISIONAL`·`EPHEMERAL`)은 모두 `PROVISIONAL`로 바꾼다. 알림이 조용히 도착하므로 허용으로 본다.
2. Android 알림 채널은 어댑터가 권한 창을 띄우기 전과 토큰을 받기 전에 만든다. Android 13+는 채널이 있어야 권한 창과 토큰 발급이 동작한다. 실패해도 권한은 읽고 보고한다.
3. 허용 상태(`GRANTED`·`PROVISIONAL`)면 Expo 푸시 토큰을 받는다. `Device.isDevice`로 막지 않는다. Expo SDK 58에서는 시뮬레이터·에뮬레이터도 토큰을 받을 수 있다. 오프라인·APNs 없음·Play 서비스 없음·15초 초과로 실패하면 마지막으로 보고에 성공한 토큰(키체인 `pushRegistration`)으로 보고해 등록을 지키면서 권한·시간대·언어를 맞춘다. 한 번도 토큰을 받지 못한 허용 기기는 `token: null`로 보고한다. 지울 토큰이 없고, 1.15.1 서버는 허용 상태의 `null`에 저장된 토큰을 지킨다(이 앱은 그 서버 뒤에 나간다). 다음 복귀·토큰 변경·권한 요청 때 토큰을 다시 받는다. 거절·미결정이면 토큰 없이 권한만 보고한다. 판단은 `PushRegistrationPolicy.getReportToken`이다.
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
- 권한·토큰이 같아도 마지막으로 보고한 시간대·언어와 다르면 다시 보낸다. 앱이 뒤에 있는 사이 바뀐 언어의 보고가 실패해도 다음 복귀 때 한 번 다시 보낸다. 시간대·언어는 계정 하나에 마지막으로 보고한 기기 값을 쓴다. 요청이 없는 화면에 돌아와도 서버 시간대가 바로 바뀐다. 보고가 성공하면 `useTimezoneChangeNotice`가 처음 알아챈 변경을 한 번 안내한다.
- 요청 헤더(`X-Request-Id`·`X-Timezone`·`Accept-Language`)는 `shared/infra/http/request-headers.ts`가 요청마다 붙인다.

## 권한 묻기

시스템 권한 창은 iOS에서 한 번만 뜬다. 그래서 묻는 순간을 `PushPermissionPolicy.getAskMoment(permission, context)` 한 곳이 정한다. 허용(`GRANTED`·`PROVISIONAL`)이면 어디서도 묻지 않는다.

| 곳(`surface`)          | 조건                                                   | 결과(`PUSH_ASK_MOMENT`)                                                                  |
| ---------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| 가입 직후 `onboarding` | 아직 묻지 않음 + 가입 1일 안 + 화면을 닫지 않음        | `ONBOARDING_SCREEN`: `/onboarding/notifications` 한 장. [계속] → 시스템 창, 헤더 닫기    |
| 할 일 시간 `todo-time` | 아직 묻지 않음 / 거절                                  | `SYSTEM_DIALOG`: 그 자리에서 시스템 창 / `DENIED_NOTICE`: 칩 아래 한 줄 "설정 열기"      |
| 피드 `feed`            | 거절 + 오늘 알림이 갈 할 일이 남음 + 닫은 지 14일 지남 | `DENIED_NOTICE`: `PushPermissionNotice`(다시 물을 수 있으면 시스템 창, 아니면 설정 열기) |

- 알림 화면은 `(app)/_layout`의 `Stack.Protected guard={usePushOnboardingGuard()} redirectTo=".."` 안에 있다. 판정은 이 guard 한 곳에서 하고 그린 값을 `PushOnboardingGuardStore`에 남긴다. 피드가 앞에 자리 잡으면(`useOpenPushOnboarding`) guard가 열린 채 그려진 뒤에만 연다. 피드가 따로 판정하면 다시 연 앱에서 권한을 읽은 순간 피드가 guard보다 먼저 `true`를 보고 열어, 화면이 곧바로 guard에 막혀 피드로 돌아간다. 권한이 정해지거나 닫기가 남으면 조건이 풀려 화면이 빠지고 연 화면(피드)으로 돌아간다.
  - 본문 버튼은 시스템 창을 여는 [계속] 하나다. 나가는 길은 흐름형 화면처럼 네이티브 헤더 오른쪽 닫기이고, Android 뒤로 가기도 닫기다.
  - 시스템 창을 바로 여는 버튼은 알림 화면·피드 안내·설정 줄 모두 `permission.continue`([계속])다. HIG가 권한 전 버튼에 "허용" 대신 Continue·Next를 쓰라고 해서 날씨 위치 안내(`locationPrompt.continue`)와 같은 규칙을 따른다.
  - `redirectTo`를 비우면 열린 화면의 guard가 풀릴 때 anchor 그룹 `/(app)/(tabs)`로 replace한다. 탭이 없는 그룹 경로라 탭 묶음이 새로 생기고 글자 순 첫 탭 `(mypage)`가 열린다. `..`는 뒤로 가기라 있던 탭 묶음과 탭이 그대로 남는다.
- 알림 화면 닫기와 피드 안내 닫기는 저장 값 정의 2개(`pushPermissionDeferredAtStoredValue`·`pushNoticeDismissedAtStoredValue`, `useStoredValue`)로 계정마다 남긴다. 로그아웃은 남기고 탈퇴는 `UserDeviceDataService.clearForUser`가 지운다.
- 설정 > 알림 > 푸시 맨 위 `PushPermissionSettings`는 기기 알림 한 줄이다. 꺼져 있으면 줄을 눌러 다음 단계(시스템 창 또는 설정 열기)를 하고 아래 토글을 흐리게 둔다. 허용했으면 `허용됨`을 보이고 누르면 기기 설정을 연다.
- 앱 푸시 설정을 켜면 이어서 OS 권한을 묻는다(`useUpdatePushEnabledAndAskPermissionMutationOptions`).
- 할 일 목록 시간 옆 종 꺼짐 표시는 OS 권한과 앱 푸시 설정(`PushPermissionPolicy.canReceivePush`)으로 정한다. 피드가 한 번 읽어 목록에 넘긴다.
- 혜택·소식(광고성) 제안은 첫 할 일 완료 뒤 시트 한 번이다(`useOfferMarketingPushAfterCompletion`). 기기 알림과 앱 푸시가 켜져 있을 때만 띄우고, 거절하면 계정마다 90일 뒤 다시 제안한다.
- 분석 이벤트는 [observability.md](./observability.md#푸시-권한-퍼널)를 본다. 권한 mutation은 `source`를 변수로 받아 `onSuccess`에서 한 번 추적하고 실패는 전역 오류 피드백(`meta.errorFeedback`)이 처리한다.

## 앱이 앞에 있을 때 받은 알림

`registerForegroundNotificationPresentation`이 앱이 그려지기 전에(`composition-root`가 기기 포트를 만들 때 프로세스에 한 번) `setNotificationHandler`를 걸고, `NotificationProvider`의 `useForegroundPushPresentation`이 지금 화면에 맞춘 판단을 `PushNotificationGateway.setForegroundPresentation`으로 넘긴다. 판단 규칙은 `utils/get-foreground-push-presentation.ts`의 `getForegroundPushPresentation` 하나다(배너·조용히는 표시 방식이라 모델에 두지 않는다).

| 지금 화면                                                         | 보이는 방식                           | 이유                                                                     |
| ----------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------ |
| 알림함(`/notifications`)                                          | `quiet`: 배너·소리 없이 알림 센터에만 | 받을 때마다 알림함을 다시 받아 맨 위에 바로 보인다                       |
| 알림이 여는 화면 + 받을 때 다시 받는 타입(친구·초대·콕·혜택 종료) | `quiet`                               | `invalidateOnNotificationReceived`가 그 화면을 다시 받는다               |
| 알림이 여는 화면 + 다시 받지 않는 타입(리마인드·댓글·날씨 등)     | `banner`                              | 화면에 새 내용이 보이지 않는다                                           |
| 그 밖의 화면, 모르는 타입, 계약에 맞지 않는 data, 판단 실패       | `banner`: 배너·목록·소리              | 앱이 뒤에 있을 때와 같게 알린다. 판단 전(그려지기 전)에 온 알림도 배너다 |

- "여는 화면"은 경로와 보는 대상 id(할 일·친구·콕)가 모두 같을 때다. 날짜·진입 경로·댓글 위치(`date`·`entry`·`comment`)는 비교하지 않는다(`isViewingNotificationDestination`).
- 어느 쪽이든 받은 즉시 알림함·안 읽은 수와 그 타입의 화면을 다시 받는다(`useForegroundNotificationSync`). 배지는 그 수를 따른다.
- `shouldSetBadge`는 끈다. 배지는 안 읽은 수 조회 하나가 맞춘다.

## 로그아웃과 배지

- 로그아웃은 `PushRegistrationService.unregister()`가 `PushDeviceApi`로 `DELETE v1/notifications/token?deviceId=`를 보낸다. 진행 중인 보고를 모두 제한 시간 안에서 기다리고, 해제가 시작되면 늦은 보고는 보내지 않는다. 늦게 도착한 보고가 해제된 기기를 되살리지 않게 하기 위해서다. 해제가 실패하거나 오프라인이어도 로컬 세션은 항상 지운다(`logOutDevice`).
- 오프라인 로그아웃은 온라인이 되면 `POST v1/auth/logout`으로 서버 세션을 풀고, 서버가 `releaseSessions`로 그 세션의 기기를 함께 푼다([오프라인 로그아웃](./auth.md#오프라인-로그아웃)).
- 온라인 로그아웃 없이 세션이 끝나면 서버는 끝난 세션의 토큰을 지우지 않아 이전 계정의 푸시가 계속 온다. 그래서 refresh 만료·거절(`reason: 'expired'`), 오프라인 로그아웃, 인증 해제(`DELETE`)가 실패한 로그아웃은 `PushRegistrationService.requestRelease()`로 기기에 해제 기록을 남기고 `POST v1/notifications/push-devices/unregister`(인증 없음, `{ deviceId, token }`, 항상 200)로 푼다. 토큰은 마지막으로 보고한 토큰과 지금 Expo 토큰이고, 보고한 뒤 바뀌었으면 둘 다 보낸다(`PushRegistrationPolicy.getReleaseTokens`).
  - 연결·서버 장애·429·토큰 발급 실패면 기록을 남겨 로그아웃 상태에서 연결될 때와 앱이 앞으로 올 때 다시 보낸다(`usePushDeviceReleaseFlush`). 앱을 다시 켜도 기록(키체인 `pushRegistration`, 토큰을 담아 평문 MMKV에 두지 않는다)이 남는다. 화면을 막지 않는다.
  - 다시 로그인해 보고하면 해제 기록을 버리고, 가는 중인 해제가 있으면 끝난 뒤에 보고해 새 등록이 지워지지 않는다. 같은 값도 다시 보고하도록 보고 기록을 비운다.
  - 로그인한 적 없는 시작(`none`)과 판정 실패(`boot-failed`)는 등록을 건드리지 않는다. 잠긴 키체인처럼 세션이 살아 있을 수 있어서다.
- 탈퇴는 앱이 해제하지 않는다. 서버 탈퇴가 전 세션과 기기를 함께 푼다. 탈퇴 전에 풀면 비밀번호 오류에도 이 기기의 알림이 끊긴다.
- 앱 아이콘 배지는 알림함의 안 읽은 수 조회(`useGetUnreadCountQueryOptions`) 하나를 따른다. `NotificationProvider`의 `useNotificationBadgeSync`가 로그인한 동안 이 조회를 구독해, 앱이 앞으로 올 때(`focusManager`, `staleTime: 0`)·다시 연결될 때·푸시 수신과 읽음 처리의 무효화·낙관적 수정 때마다 배지를 그 수로 맞춘다. 그래서 다른 기기에서 읽거나 받은 알림도 이 기기를 열면 배지에 반영된다. 배지만 따로 서버에 묻지 않는다. 읽음 처리(`NOTIFICATION_MUTATION_KEYS.writes()`)는 실패하면 그 알림만 안 읽음으로 되돌리고, 마지막 처리가 끝날 때만 다시 받아 배지가 앞 처리의 값으로 깜빡이지 않는다.
- 콜드 스타트의 인증 확인 중(`loading`·`locked`)에는 배지를 건드리지 않고, 로그아웃(`unauthenticated`)일 때만 지운다(`NotificationBadgePolicy.getBadgeCount`).

## 눌린 푸시 처리

탭은 읽음(`markAsReadAndCheckOwnership`)과 열림(`POST …/opened`, 읽음 포함)을 기존 API로 남기고, 이동한 뒤 `push_notification_opened`를 한 번 보낸다. `app_state`는 `PushNotificationResponsePolicy.getOpenAppState`가 정한다. 시작할 때 읽은 마지막 응답은 `cold`, 앱이 뒤에 있었거나 앞으로 온 지 1초 안이면 `background`(응답과 복귀 이벤트의 순서가 플랫폼마다 다르다), 그 밖은 `foreground`다. 개인 정보는 보내지 않는다.

Expo Router 권장대로 루트 레이아웃의 관찰 훅 하나가 `getLastNotificationResponse`와 응답 리스너를 받아 슬롯에 넣고, 처리 뒤 `clearLastNotificationResponse`로 재시작 중복을 막는다. 푸시는 URL을 싣지 않으므로 `+native-intent`는 관여하지 않는다.

| 상황                                      | 동작                                                                                                                                                                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 인증 확인 중(`loading`·`locked`)          | 슬롯에 둔다. `locked`는 스피너로 넘기고 잠금이 풀리면 이어간다                                                                                                                                             |
| 로그아웃 상태                             | 슬롯에 둔다(10분). 로그인 뒤 같은 Index 경로로 한 번만 연다                                                                                                                                                |
| 연속 두 탭                                | 슬롯이 하나라 마지막 탭만 연다. 앞 탭의 늦은 읽음 응답은 버린다                                                                                                                                            |
| 같은 탭이 다시 옴                         | 처리한 응답 id를 최근 20개 기억해(`rememberHandledResponse`) 콜드 스타트의 마지막 응답·리스너 중복·다시 그린 레이아웃에도 한 번만 연다                                                                     |
| 로그아웃·세션 만료                        | 슬롯과 마지막 응답을 지운다. 진행 중 응답은 `SessionEpoch`와 슬롯 id로 버린다                                                                                                                              |
| 다른 계정 알림·없는 대상                  | 읽음이 403·404면 버리고 머문다. 페이로드에 수신자 id가 없어 이것이 유일한 방어다                                                                                                                           |
| 오프라인·5xx·읽음 지연                    | `NOTIFICATION_READ_BUDGET_MS`(800ms, 초깃값, Release 측정 뒤 확정) 안에 끝내고 연다. 서버의 `opened`가 읽음도 처리하므로 mutation이 연결될 때까지 멈췄다가 재시도한다                                      |
| 모르는 타입, `navigation` 있음            | `navigation`을 따른다. Analytics `type`은 `UNKNOWN`이다                                                                                                                                                    |
| `navigation` 없음·모르는 kind·틀린 모양   | 그 칸만 버리고 `toNotificationTarget`이 알림함 target을 만든다(버린 칸의 경로를 `notification.push.parse-dropped`로 남긴다). 서버는 모든 푸시·알림함 행에 `navigation`을 계산해 싣는다                     |
| 모르는 종류·분석 칸·수신 거부 토큰이 틀림 | 그 칸만 버리고(`null`) 종류·목적지는 그대로 연다(로그를 남긴다)                                                                                                                                            |
| data를 읽지 못함                          | `parsePushNotification`의 `notification`이 `null`이면 로그를 남기고 버리지 않은 채 알림함으로 연다(`createUnreadablePushNotification`)                                                                     |
| 수신 거부 버튼                            | 인증 없이 공개 API로 보낸다. 다음 탭에 밀리지 않게 슬롯을 따로 두고 실패하면 포그라운드 복귀 때 다시 보낸다(10분)                                                                                          |
| 알림함 항목                               | 서버가 푸시와 같은 계산으로 싣는 `navigation`을 따른다(서버 1.15.1+, [배포 순서](../../../docs/conventions/compatibility.md#2-외부-계약-바꾸지-않는다)). 알림함을 여는 항목은 같은 화면을 다시 열지 않는다 |

### 목적지 대조

서버가 푸시·알림함 행에 싣는 `navigation`이 유일한 목적지 입력이다. 앱은 옛 type·action·context·routing 필드를 읽지 않는다(서버가 호환용으로 함께 싣는 옛 필드는 출시된 구 앱의 몫이다). 알림함 행의 `navigation`은 서버 1.15.1부터 실리므로 서버 1.15.1 이상을 앱 1.15.2보다 먼저 배포하고 그 아래로 되돌리지 않는다. 이번 릴리스는 서버 1.15.2를 앱과 함께 배포한다. 길은 하나다.

```text
navigation ─(toNotificationTarget, mapper)→ NotificationTarget ─(toNotificationDestination)→ 경로·외부 링크·이동 없음
```

`packages/api/test-fixtures/notification-navigation.cases.json`(`dist`에 들어가지 않음)을 서버 spec과 앱 test가 함께 읽는다. 앱은 navigation이 있는 줄마다 접힌 화면이 여는 곳을 적어 두고(`notification-destination.navigation.test.ts`), 서버가 줄을 더하면 앱 테스트가 먼저 깨진다. 할 일이 아닌 목적지는 medium·expanded와 보는 사람 없음·주인·다른 사람 조합에서도 같은지, 할 일 목적지는 펼친 화면의 목록 pane(주인·날짜)을 따로 확인한다.

### 콜드 스타트 순서

| 순서 | 동작                                               |
| ---- | -------------------------------------------------- |
| 1    | 스플래시 유지, 글꼴·암호화 저장소 대기             |
| 2    | 응답을 슬롯에 받음, `/` → `/loading`               |
| 3    | 인증과 복원 확정. 스플래시와 로딩 가드 유지        |
| 4    | 읽음 확인(최대 800ms)                              |
| 5    | 가드 해제 → Index가 목적지로 `Redirect withAnchor` |
| 6    | 다음 프레임에 스플래시 hide                        |
| 7    | `clearLastResponse`, `opened` 기록                 |

- 피드는 anchor로 아래에 있고 focus되지 않아 안내와 화면 기록이 생기지 않는다. 뒤로 가기는 피드다.
- 외부 링크와 이동 없음은 경로가 없어 피드로 간 뒤 처리한다.
- 스플래시에 갇히지 않는다. 읽음은 예산으로 항상 끝나고, 진입 대기는 3초 상한(`NOTIFICATION_ENTRY_HOLD_MAX_MS`) 뒤 내리며, Index가 이동하지 못하면 슬롯을 비워 피드로 보낸다. 루트 오류 경계와 `AppProviders`의 조회 오류 경계도 내린다.
- 앱 종료 상태의 알림 탭이 스플래시 다음 바로 목적지로 가고 뒤로 가기가 탭 바가 있는 피드로 돌아오는 것을 iOS 시뮬레이터 Release(약 2.2초)와 Android 폴드 Release(로컬 알림)에서 확인했다. 실제 APNs·FCM 경유와 배지는 실기기 체크리스트로 확인한다.

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

포트를 구현한 `createPushNotificationGatewayStub`을 DI로 넣는다. 예시는 `push-permission-notice.test.tsx`, `use-push-device-sync.test.tsx`, `expo-push-notification-gateway.test.ts`(어댑터 경계)다. 눌린 푸시의 진입 순서는 실제 라우터로 도는 `auth-gate-layout.push-entry.test.tsx`다. 자세한 규칙은 [testing.md](./testing.md)를 본다.
