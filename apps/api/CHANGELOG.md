# @aido/server

## 1.14.2

### Minor Changes

- a5b4352: 푸시 기기와 토큰을 보고한 로그인 세션에 묶는다. 로그아웃·전체 로그아웃·비밀번호 변경·재설정·원격 세션 종료·토큰 재사용 감지·탈퇴로 세션을 폐기하면 그 세션의 기기와 토큰을 바로 지우고, 만료돼 정리되는 세션은 FK CASCADE로 함께 지운다. 앱이 해제 요청을 보내지 못한 오프라인 로그아웃·세션 만료 뒤에도 로그아웃한 기기로 알림이 가지 않는다. 세션이 없는 구 등록(1.14.1 이하)은 그대로 둔다.
- b020d1f: 푸시를 보내지 않은 이유를 기기 권한으로 나눈다. 활성 토큰이 없을 때 최근 90일 안에 보고한 기기가 거절이면 `PUSH_PERMISSION_DENIED`, 아직 묻지 않았으면 `PUSH_PERMISSION_NOT_REQUESTED`, 그 밖에는 `NO_ACTIVE_TOKEN`으로 기록한다. v2 관리자 캠페인 조회의 `dispatches`에 사유별 수 `skippedByReason`을 더한다(추가 필드).

### Patch Changes

- 22db28c: 1.14.1 전환용으로 남겨 둔 레거시를 지운다. migration `drop_legacy_comment_path_and_retention_outbox`가 `TodoComment.path`·`depth`·`rootId` 열과 `RetentionPushOutbox` 테이블·`RetentionOutboxStatus` enum을 지운다. Redis/BullMQ 작업 runtime, `JOB_BACKEND`·`JOB_REDIS_DRAIN_ENABLED` 설정, `.v1` 없는 이전 이름 queue worker, deprecated `jobKey`, 만료된 이전 캐시 키 삭제도 지운다. REST 계약은 그대로라 배포된 앱에는 영향이 없다. 1.14.1 이하 API 이미지는 지운 열에 쓰므로 이 migration 뒤 이미지만 롤백하면 댓글 작성이 실패한다.
- 518a14e: 앱 요청 헤더를 요청마다 한 번 `RequestClient`로 정규화해 컨트롤러·guard·interceptor가 같은 값을 읽는다. 시간대 해석 규칙(UTC 폴백·보낸 값만 사용)을 한 곳의 함수로 모았고 엔드포인트별 동작과 응답 형태는 그대로다. 요청마다 `X-Request-Id`(앱이 보낸 UUID 또는 새 UUID)를 정해 응답 헤더·로그 `reqId`·Sentry `request_id` 태그로 남기고, CORS에서 `X-Request-Id`를 받고 노출하며 쓰지 않던 `X-Requested-With`는 뺀다.
- Updated dependencies [b020d1f]
  - @aido/api@1.14.2

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
