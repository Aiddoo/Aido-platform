# @aido/server

## 1.14.1

### Minor Changes

- e888ac5: 관리자 브로드캐스트를 비동기 캠페인으로 접수하는 `POST /v2/admin/notifications/broadcasts`(202, 요청 ID 멱등)와 분배·발송·전달 결과를 집계하는 `GET /v2/admin/notifications/broadcasts/{campaignId}`를 더한다. 오류 코드 `ADMIN_1404`·`ADMIN_1405`와 `BROADCAST_CAMPAIGN_STATUS`를 추가한다. v1 broadcast는 같은 캠페인으로 접수하는 deprecated 경로가 된다.
- 079dd9f: 소셜 로그인·OAuth 코드 교환 응답에 `isNewUser`를 더한다. 이번 요청에서 계정을 새로 만들었을 때만 true이고, 기존 계정·이메일 자동 연결·탈퇴 유예 복구는 false다. 선택 필드라 구 앱은 무시한다.
- 2d35228: 할 일 댓글을 댓글·답글 2단계 묶음으로 바꾸고 v2 읽기 API를 추가한다.

  - `GET /v2/todos/{todoId}/comments`: 댓글 묶음(대표 답글·답글 요약)과 `anchorCommentId` 위치. 계약 `todoCommentThreadsResponseSchema`·`getTodoCommentThreadsQuerySchema`
  - `GET /v2/todos/{todoId}/comments/{commentId}/replies`: 묶음 답글을 작성 순으로, `aroundReplyId` 페이지. 계약 `todoCommentRepliesResponseSchema`·`getTodoCommentRepliesQuerySchema`
  - v1 개요·대화는 응답 모양을 유지하고 2단계 값만 내려간다(Swagger deprecated, 1.14.0 이하 앱 전용). 답글에 답해도 같은 묶음에 붙고 `replyTo`가 대상을 알려 준다.
  - 댓글 작성·수정·삭제·좋아요에 사용자별 요청 한도(429 `SYS_0001`)를 둔다.
  - `TODO_COMMENT_LIMITS.REPLY_PAGE_DEFAULT_SIZE`를 추가한다.

- dc7defe: 할 일 댓글을 댓글·답글 2단계 묶음으로 저장한다. 답글에 답해도 같은 묶음에 붙고 `replyToCommentId`가 @대상을 남긴다. v1 개요·대화는 응답 모양을 유지하고 2단계 값만 내려가며 재귀 SQL을 쓰지 않는다. 기존 답글은 마이그레이션에서 묶음 머리 아래로 옮긴다. 재시도 응답의 알림 수신자 기록과 삭제된 글 focus가 null이던 문제를 고친다. 답글에 단 답글 알림은 "내 답글에" 문구를 쓴다. `TODO_COMMENT_KIND`를 추가한다.

### Patch Changes

- 260b462: 날짜 계산을 공용 helper와 하나의 시간대 출처로 모은다
- 83ea1c6: 푸시 공급자 오류를 `PushFailureKind`로 분류하고, 기기별 `MessageRateExceeded`는 그 메시지만 backoff 뒤 다시 보내며, 공급자 초당 한도를 넘지 않게 발송을 조절한다. receipt는 1분마다 밀린 ticket을 이어서 확인하고 24시간이 지나도 결과가 없으면 결과 미상으로 닫는다. 알림 이벤트는 원인 이벤트별 key로 한 번만 저장하고 재시도를 다 쓰면 dead-letter 큐에 남긴다. 리텐션 발송은 공용 push-delivery outbox를 쓴다.
- 772fd2c: 푸시 data에 kind별 판별 유니온 `navigation`을 더한다. 기존 type·action·context·routing은 구 앱 호환용으로 그대로 싣고, 마케팅 배치 푸시도 단건처럼 `MARKETING` category를 싣는다.
- 620fe8c: 날씨 푸시의 상태 이름을 앱 표기와 맞춘다: 연무 → 뿌연 하늘, 뇌우 → 천둥번개, en Frigid → Freezing
- Updated dependencies [e888ac5]
- Updated dependencies [772fd2c]
- Updated dependencies [079dd9f]
- Updated dependencies [2d35228]
- Updated dependencies [dc7defe]
  - @aido/api@1.14.1

## 1.14.0

### Minor Changes

- b263f12: 가입·결제 Discord 알림에 기기·OS·앱 버전·빌드, 스토어·금액·환경을 담는다. 값을 보내지 않는 구 앱은 "—"로 표시한다.
- b4aa0e6: 유료 기능을 `PREMIUM_FEATURES` 카탈로그와 FREE/PREMIUM/ADMIN 접근 단계로 판단한다. 인증 응답에 `isPremium`·`entitlements`(선택 필드)를 더하고, 스토어 결제 유예·환불·TRANSFER와 친구 초대 보상 기간을 같은 권한으로 처리한다.
- a0e0ff8: 1.14.0 앱을 위한 날씨 v2(`/v2/weather`, WeatherKit)를 추가하고, 모든 REST 계약과 컨트롤러를 `v1/` 폴더로 정리한다. 기존 `/v1` 경로와 응답은 그대로다.

### Patch Changes

- a197862: pg-boss 종료 중 작업 등록, 메모리 락, Discord·OAuth 호출 시간 제한, WeatherKit 장애 회로와 리포트 폴백을 정리한다.
- Updated dependencies [b4aa0e6]
- Updated dependencies [a0e0ff8]
  - @aido/api@1.14.0
