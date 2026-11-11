---
'@aido/api': minor
'@aido/server': minor
---

서버와 앱이 함께 지키는 한도·값 목록·알림 스키마를 `@aido/api`에 한 번만 선언한다. `notificationTypeSchema`·`notificationActionTypeSchema`·`notificationContextSchema`·`notificationActionSchema`는 `contracts/notification`에서 `common`으로, `appStoreVersionPattern`은 `contracts/app-config`에서 `vocabulary`로 옮기며(`APP_STORE_VERSION_PATTERN`) 루트 import는 그대로 쓸 수 있다.
