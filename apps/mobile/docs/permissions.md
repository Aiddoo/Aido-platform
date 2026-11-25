# 권한

OS 권한(알림, 위치, 마이크·음성 인식, 캘린더)을 읽고 묻는 기능을 만들거나 고칠 때 읽는다. 알림 권한의 단계·퍼널은 [push-notifications](./push-notifications.md), 쿼리 키 규칙은 [data](./architecture/data.md#쿼리-키), 포트·어댑터는 [structure](./architecture/structure.md#di포트수명)가 원본이다.

## 값

- OS 권한 하나의 읽기·요청 결과는 `OsPermission`(`core/ports/os-permission.ts`의 `status`·`canAskAgain`)이다. 포트가 SDK 값을 이 모양으로 바꿔 돌려주고, 허용은 `status === 'granted'`로 판정한다. 포트마다 다른 결과 모양(`isGranted` 불리언 등)을 만들지 않는다.
- OS가 값을 더 주면 `OsPermission`을 넓힌다(iOS 임시 허용을 담은 `PushPermissionResponse`). 두 권한을 함께 묻는 받아쓰기는 빠진 권한을 담은 `SpeechPermission`이다.
- 권한으로 정하는 앱의 판단(다음 단계, 안내를 다시 보일 때)은 모델 Policy다(`PushPermissionPolicy`).

## 읽기와 요청

- 화면에 그리는 권한 상태는 Query로 읽고 키 루트는 `['device', …]`다(`['device', 'push-permission']`, `['device', 'calendar-permission']`). 기능 무효화에 휩쓸려 OS를 다시 묻지 않는다.
- 요청은 mutation 옵션이 부르고 `onSuccess`에서 결과를 같은 키에 쓴다. 기기 안의 일이라 `networkMode: 'always'`다([오프라인](./error-handling.md#오프라인)).
- 권한 요청과 그 추적은 기능마다 입구 하나다(알림은 `usePushPermissionAction`).

## 거절과 설정

- `canAskAgain`이 `false`면 시스템 대화상자를 다시 띄우지 않고 설정 열기를 보인다.
- 설정 앱 열기는 `useOpenAppSettings()`(`shared/hooks/use-open-app-settings.ts`) 하나다. 실패는 그 훅이 로그로 남긴다.
