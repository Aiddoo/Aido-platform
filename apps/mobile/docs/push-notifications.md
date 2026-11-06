# 푸시 알림 클라이언트

앱이 이 기기의 알림 권한·푸시 토큰을 서버에 맞추고, 사용자에게 권한을 묻는 방식이다.
서버가 언제 누구에게 보내는지는 [apps/api/docs/push-notifications.md](../../api/docs/push-notifications.md)를 본다. 여기서 반복하지 않는다.

## 구성

```
PushNotificationGateway (core/ports) ← expoPushNotificationGateway (shared/infra/notification)
                    ↓
        PushDeviceService (features/notification/apis) → PUT /v1/notifications/push-devices/{deviceId}
```

| 조각                                       | 역할                                                                  |
| ------------------------------------------ | --------------------------------------------------------------------- |
| `domains/push-permission.model.ts`         | 권한 모델 + `PushPermissionPolicy`(다음 단계·14일 숨김 판정)          |
| `apis/push-permission.mapper.ts`           | OS 값 → 모델, 모델·토큰 → 보고 입력                                   |
| `apis/push-device.service.ts`              | 권한 읽기·요청, 채널 → 토큰 → 보고, 로그아웃 해제                     |
| `apis/push-prompt.{repository,service}.ts` | 홈 안내를 닫은 시각을 계정마다 MMKV에 저장                            |
| `hooks/use-push-device-sync.ts`            | 로그인한 동안 보고 시점을 모은다(`NotificationProvider`가 한 번 호출) |

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

| 위치               | 컴포넌트                                                                      | 동작                                                          |
| ------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 홈 피드 카드       | `PushPermissionCard` (`.Ask`·`.RequestSystem`·`.OpenSettings`·`.EnableInApp`) | 다음 단계에 맞는 카드 한 장. 닫으면 계정마다 14일 동안 숨긴다 |
| 활성화 시점        | `ActivationPushPermissionDialog` + `usePushPermissionAskMoment`               | 아직 묻지 않은 사용자에게 계정·활성화 시점마다 한 번 안내     |
| 설정 > 알림 > 푸시 | `PushPermissionStatusRow`                                                     | 현재 OS 권한 상태와 바로 할 행동을 항상 보여 준다             |

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

## 테스트

포트를 구현한 `createPushNotificationGatewayStub`을 DI로 넣는다. 예시는 `push-permission-card.test.tsx`, `use-push-device-sync.test.tsx`, `expo-push-notification.gateway.test.ts`(어댑터 경계)다. 자세한 규칙은 [testing-guide](../.claude/testing-guide.md)를 본다.
