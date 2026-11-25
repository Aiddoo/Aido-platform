# 권한

OS 권한(알림, 위치, 마이크·음성 인식, 캘린더)을 읽고 묻는 기능을 만들거나 고칠 때 읽는다. 알림 권한의 단계·퍼널은 [push-notifications](./push-notifications.md), 쿼리 키 규칙은 [data](./architecture/data.md#쿼리-키), 포트·어댑터는 [structure](./architecture/structure.md#di포트수명)가 원본이다.

## 값

- OS 권한 하나의 읽기·요청 결과는 `OsPermission`(`core/ports/os-permission.ts`의 `status`·`canAskAgain`)이다. 어댑터가 Expo 권한 값을 `toOsPermission`(`shared/infra/permission/to-os-permission.ts`)으로 바꿔 돌려준다. 포트마다 다른 결과 모양(`isGranted` 불리언 등)을 만들지 않는다.
- OS가 값을 더 주면 `OsPermission`을 넓힌다. 알림은 iOS 임시 허용을 담은 `PushPermissionResponse`, 두 권한을 함께 묻는 음성 인식은 빠진 권한을 담은 `SpeechPermission`이다.
- 알림은 서버에 보고하는 권한 모델 `PushPermission`(`GRANTED`·`PROVISIONAL`·`DENIED`·`NOT_DETERMINED`)을 mapper(`toPushPermission`)가 만든다. 임시 허용을 허용으로 보내야 해 `OsPermission`으로 줄이지 않는다.
- 권한으로 정하는 앱의 판단(다음 단계, 안내를 다시 보일 때)은 모델 Policy다(`PushPermissionPolicy`).

| 권한             | 포트·결과                                            | 읽기                                                                           | 요청                                                      |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| 알림             | `PushNotificationGateway` → `PushPermissionResponse` | `useGetPushPermissionQueryOptions`(`['device', 'push-permission', 'current']`) | `useRequestPushPermissionMutationOptions`                 |
| 캘린더           | `TodoImportSource` → `OsPermission`                  | `useGetCalendarPermissionQueryOptions`(`['device', 'calendar-permission']`)    | `useRequestCalendarPermissionMutationOptions`             |
| 위치             | `LocationGateway` → `OsPermission`                   | 날씨 위치 쿼리(`['device', 'location']`)가 함께 읽는다                         | `useRequestWeatherLocationPermissionMutationOptions`      |
| 마이크·음성 인식 | `SpeechRecognizer` → `SpeechPermission`              | 쿼리 없이 누를 때 포트 `getPermission`                                         | 포트 `requestPermission`(`useEnsureMicrophonePermission`) |

## 읽기와 요청

- 화면이 상태를 보여 주는 권한(알림·캘린더·위치)은 `['device', …]` 쿼리로 읽고 mutation으로 요청한다. 기능 무효화에 휩쓸려 OS를 다시 묻지 않는다. 캐시 정책은 `OS_PERMISSION_QUERY_OPTIONS`(`networkMode: 'always'`, `staleTime: 0`) 하나라, 화면을 열거나 앱으로 돌아오면(설정 앱에서 바꾸고 돌아온 경우) 다시 읽는다. 위치는 권한이 위치를 읽을지 정해 날씨 위치 쿼리가 함께 읽고, 그 쿼리의 포커스 재조회가 같은 일을 한다.
- 누르는 순간에만 확인하는 권한(마이크·음성 인식)은 쿼리 없이 포트를 읽고 요청한다. 보여 줄 상태가 없어 캐시할 것이 없고, 누를 때마다 OS에 다시 묻는다.
- 시스템 창은 사용자가 버튼(`계속`·듣기)을 눌러야 띄운다. 요청 mutation은 `onSuccess`에서 결과를 같은 키에 쓰고(위치는 위치 쿼리를 다시 읽는다) `networkMode: 'always'`다([오프라인](./error-handling.md#오프라인)).
- 화면을 열 때는 상태만 읽는다. 예외는 Mac(Designed for iPad)의 위치다. 앱을 다시 켠 직후 허용이 남아 있어도 상태 읽기가 응답하지 않는 경우가 있어, 이 기기에서 허용한 적이 있으면 위치 쿼리가 요청 API로 다시 확인한다(`recheckPermission`). 이미 허용한 앱에는 창 없이 허용을 돌려준다.
- 권한 요청과 그 추적은 기능마다 입구 하나다(알림은 `usePushPermissionAction`, 음성은 `useEnsureMicrophonePermission`).

## 거절과 설정

- 다시 물을 수 있는지는 `getOsPermissionAccess(permission)`(`shared/utils/get-os-permission-access.ts`) 하나로 정한다. `granted`·`ask`(시스템 창)·`settings`(OS가 다시 묻지 않아 설정 앱에서만 켠다)다. 알림은 서버 어휘 모델이라 `PushPermissionPolicy.getDeviceStep`이 같은 기준으로 정한다.
- `settings`면 시스템 창을 다시 띄우지 않고 설정 열기를 보인다. 방금 거절했으면 다시 물을 수 있어도 같은 화면에서 다시 조르지 않는다(캘린더 `getCalendarPermissionView`).
- 설정 앱 열기는 `useOpenAppSettings()`(`shared/hooks/use-open-app-settings.ts`) 하나다. `{ canOpen, open }`을 돌려주고 `open()`은 reject하지 않는다. 실패는 그 훅이 로그로 남기고 결과(`{ isOpened: false, error }`)로 알려, 토스트로 알리는 알림 설정 mutation은 그 오류를 다시 던진다.
- Mac(Designed for iPad)은 이 앱의 설정 화면이 열리지 않는다. 어댑터가 `ExternalLinkGateway.canOpenSettings`로 알리고 `canOpen`이 false인 화면은 버튼 대신 시스템 설정으로 가는 길을 글로 보인다(캘린더 가져오기). 알림·위치·음성은 아직 `canOpen`을 보지 않고 `open()`을 부른다. 기능은 문구와 배치만 정한다. 앱이 바로 열 수 없는 설정(캘린더 계정 추가)으로 가는 길은 `ExternalLinkGateway.settingsApp`(기기 종류, 설정의 앱 메뉴 유무)으로 고르고 기기 상수를 직접 읽지 않는다(캘린더 가져오기의 계정 안내).
