# @aido/api

## 1.15.0

### Minor Changes

- 3d19ee9: 말·글을 할 일 계획으로 바꾸는 voice 컨텍스트를 더한다. `POST /v1/quick-plans`(AI 할 일 만들기 횟수)·`POST /v1/voice-notes/digest`(말로 메모하기 횟수)는 호출 전에 예약하고 실패·빈 결과면 정확히 한 번 환불하며(빠른 계획은 할 일 0개도 환불, 녹음 정리는 요약이나 핵심 내용을 돌려주면 할 일 0개여도 차감), 같은 `Idempotency-Key`는 한 번만 차감한다. `POST /v1/action-plans/apply`는 차감 없이 사용자가 확인한 행동만 손으로 만든 할 일과 같은 경로로 한 트랜잭션에 저장하고, 메모에서 만든 계획이면 원본 메모를 지운다. 서버는 녹음도 전사 글자도 저장하지 않고 사용량과 요청 해시·만든 id만 남긴다(`PlanApplication` 테이블, `QuotaCharge.requestHash` 열 추가, 7일 정리 작업). 새 오류 코드 AI_1312·1315·1316·1318. `QuotaLedger`는 같은 키의 다른 요청을 AI_1318로 거절하고, 달을 넘겨 이어받은 예약을 새 달 한도로 다시 잡는다. 녹음 정리 라우트 본문 256KB, 분당 4회·하루 30회 제한.
- f64ca65: AI 생성을 포트 하나(`AiGeneratorPort`)와 업체별 어댑터(Anthropic Claude·Google Gemini·OpenAI)로 바꾸고, 설정 순서(`AI_PROVIDER_ORDER`, 기본 Claude→Gemini→OpenAI)·사용자가 동의한 안내 버전·회로 상태로 업체를 골라 차례로 시도한다. Claude 크레딧 소진(402)·인증 실패는 결제 회로를 15분 열고 Sentry로 알리며, 연속 장애는 30초 건너뛴다. AI 데이터 처리 동의에 새 안내 버전 2026-11-04(글자만 세 업체로 전송, 녹음 파일은 서버로 보내지 않음)를 더하고 업체 표 `AI_DATA_SHARING_CONSENT_PROVIDERS`를 공유한다. 1.13·1.14 앱의 2026-10-26 동의는 다시 묻지 않고 Gemini만 쓴다. 환불한 AI 실패(AI_1301·AI_1302·AI_1310)는 공개 상세 `{ charged: false }`를 싣고 문구를 사용자 말로 고쳤다(코드·상태는 그대로). `ai-fallback`과 `AI_MODEL_<TASK>`·`AI_FALLBACK_MODEL` env를 지우고 업체별 키·모델·작업별 제한 시간·회로 env를 더한다.
- 22c7b54: 플랜·한도 숫자를 `PLAN_CATALOG` 한 곳으로 모으고(출시 앱용 `PREMIUM_FEATURES`는 그 부분집합), 무료 AI 정리를 월 10회로 늘리며 프리미엄에는 공정 사용 상한(월 1,000회)을 둔다. 무료·프리미엄 판단은 서버 `hasPaidAccess` 하나로 tier·`isPremium`·SQL 조건이 함께 따른다.
- 1784102: AI 프롬프트를 작업마다 `PromptDefinition`(id·버전·Zod 출력 schema·build·normalize) 하나로 정리하고, 캐시 친화 순서(고정 system → 동적 context → 맨 끝 사용자 입력)와 공용 보안 규칙·언어 정책(할 일 제목은 말한 언어, 요약은 앱 언어)을 kit으로 묶는다. v1 프롬프트 폴더와 `AI_PROMPT_VERSION_*` 전환 env를 지우고 버전 이름을 `parse-todo@3`처럼 바꾼다(출시 응답의 선택 `meta.promptVersion` 값만 달라진다). 빠른 계획·녹음 정리 프롬프트와 격주·매월 반복 표현을 미리 정의하고 `ACTION_PLAN_LIMITS`를 `@aido/api/vocabulary`에 더하며, 쓰지 않던 `llmParsedResultSchema`·`llmParsedMemoResultSchema`를 지운다. golden(ko·en·혼합)과 `pnpm ai:eval --task --provider` 수동 평가를 더한다.
- d26b3d0: AI처럼 돈이 드는 사용 횟수를 Access의 `QuotaLedger` 원장 하나로 센다. AI 호출 전에 원자적으로 예약하고 실패·빈 결과면 정확히 한 번 환불하며, 같은 `Idempotency-Key`는 두 번 차감하지 않는다(`QuotaCharge`·`QuotaUsage` 테이블 추가). 서버가 계산한 `featureQuota`·`entitlementSnapshot` 계약과 `GET /v1/entitlements`를 더하고, parse-todo·parse-memo 성공 응답에 선택 `featureQuota`를, 한도 오류(AI_1303·새 AI_1313 녹음 정리 한도·새 AI_1314 처리 중 충돌)에 공개 상세 `{ charged: false, featureQuota }`를 싣는다. 응원·콕 찌르기 일간 한도(CHEER_1201·NUDGE_1101)와 카테고리 한도(TODO_CATEGORY_0857)도 같은 공개 상세를 싣고, 친구 한도(FOLLOW_0909)는 기존 `current`·`limit`에 `charged`·`featureQuota`를 더한 `friendQuotaErrorDetailsSchema`로 내보낸다. 출시 앱의 `/v1/ai/usage`·`/me`·AI_1303 동작은 그대로다.
- 8142c45: 1.15.0 서버 리뷰 수정. 리마인더 재예약이 실제로 등록되도록 작업을 지우고 다시 넣으며 회차 알림을 행과 함께 커밋한다. 할 일 PATCH를 한 트랜잭션(`EditTodo`)으로 묶고, 유효한 유료 사용자의 반복 알림은 멈추지 않으며 무료 사용자에겐 멈출 때 한 번 안내한다. 분할된 규칙을 `TodoSeries.originSeriesId`로 묶어 전체 삭제가 앞 구간까지 지우고 `TodoSeries.sortOrder`를 지운다. 새 반복의 지난 회차는 366개까지다(넘으면 `TODO_0845`, `field: "startDate"`). 결과를 잃은 같은 `Idempotency-Key`는 추가 차감 없이 다시 만들어 200으로 답한다. 앱이 연결을 끊으면 AI 호출을 멈추고 환불한다.
- 049ca21: 할 일 생성 포트를 커밋 후 실행 `StagedTodoCreatorPort.stage` 하나로 통일한다. 메모 전환과 AI 제안 수락이 같은 경로를 쓰므로 롤백되면 알림·캐시 효과가 남지 않는다. `TodoSchedule`이 종일과 시간을 맞춘다(시간이 있으면 시간 일정, 없으면 종일). 출시 앱이 종일과 시간을 함께 보내도 서버가 맞춰 저장한다. 반복 할 일 오류 코드 `TODO_0841`~`TODO_0846`과 공개 상세, 시스템 상한 `TODO_SERIES_LIMITS`를 더하고, 반복에 맞는 날짜가 없으면 `SYS_0002` 대신 `TODO_0843`을 돌려준다.
- ce63b19: `POST /v1/todos`가 선택 필드 `repeat`로 반복 할 일을 만든다. 규칙을 저장하고 앞으로 90일 치 회차를 실제 행으로 만들며, 응답 `todo`는 첫 회차, 새 선택 필드 `series`는 규칙이다(`todoSeriesResponseSchema`). 진행 중 반복은 등급과 상관없이 30개까지(`TODO_0842`), 카테고리 한도는 진행 중 규칙 1개당 1로 센다. `POST /v1/todos/recurring`은 지원 마지막 앱 1.14.x의 호환 경로로 남아 같은 경로를 쓰고, 이전에 `TODO_0812`로 거절하던 긴 범위도 성공한다. 메모 변환 요청에 선택 `repeat`, AI 파싱 응답에 선택 `repeat`를 더하고 출시 앱용 `recurrence`는 그대로 둔다. 회차 리마인더는 커밋 뒤 일괄 등록한다. 추가한 필드는 모두 optional이며 생략 시 동작은 같고, 출시 앱 지문은 `preTodoRepeatSchemasFingerprint`에 이전 값과 사유를 남겼다.
- 4c33c2c: 반복 할 일의 범위 수정·삭제와 반복 끝내기를 더한다. `PATCH /v1/todos/:id`에 선택 `scope`(`THIS_ONLY`·`THIS_AND_FOLLOWING`), `repeat`(생략은 변경 없음, null은 이 회차 뒤로 끝내기, 값은 단일 할 일 전환 또는 규칙 변경), `checklist`, `DELETE /v1/todos/:id`에 선택 `scope`(`THIS_ONLY`·`THIS_AND_FOLLOWING`·`ALL`), 새 `GET /v1/todo-series/:seriesId`를 연다. 규칙을 바꾸면 이 회차부터 나누되 맞는 회차의 id·댓글을 유지하고, 완료한 회차의 내용은 바꾸지 않으며(`ALL` 삭제만 지움), 첫 회차에서 고치면 나누지 않는다. 체크리스트만 바꾸면 나누지 않고 앞으로 만들 회차에 쓰는 규칙의 체크리스트만 바꾼다(`THIS_AND_FOLLOWING`에서만 받는다). 시간을 바꾸면 회차 날짜마다 규칙 시간대로 다시 계산해 리마인더를 재등록한다. 모든 필드는 optional이고 생략하면 동작이 같다. 출시 앱 지문은 `preTodoSeriesScope…Fingerprint`에 이전 값과 사유를 남겼다.
- d1507da: 반복 할 일의 기반을 더한다. `TodoSeries` 테이블과 `Todo.occurrenceDate`, `(recurrenceGroupId, occurrenceDate)` 부분 유니크 인덱스를 만들고 기존 묶음을 끝난 규칙으로 이관한다(같은 날짜 중복은 최소 id만 남기고 묶음 해제). 서버 코드 이름은 `seriesId`이고 DB 열과 응답 필드 `recurrenceGroupId`는 출시 앱·1.14.2 롤백 호환을 위해 그대로 둔다. 공유 계약에 `todoRepeatSchema`·`TodoRepeat`와 `TODO_REPEAT_FREQUENCIES`·`TODO_REPEAT_INTERVALS`·`TODO_REPEAT_END_TYPES`·`TODO_EDIT_SCOPES`를 더한다.

## 1.14.2

### Minor Changes

- b020d1f: 푸시를 보내지 않은 이유를 기기 권한으로 나눈다. 활성 토큰이 없을 때 최근 90일 안에 보고한 기기가 거절이면 `PUSH_PERMISSION_DENIED`, 아직 묻지 않았으면 `PUSH_PERMISSION_NOT_REQUESTED`, 그 밖에는 `NO_ACTIVE_TOKEN`으로 기록한다. v2 관리자 캠페인 조회의 `dispatches`에 사유별 수 `skippedByReason`을 더한다(추가 필드).

## 1.14.1

### Minor Changes

- e888ac5: 관리자 브로드캐스트를 비동기 캠페인으로 접수하는 `POST /v2/admin/notifications/broadcasts`(202, 요청 ID 멱등)와 분배·발송·전달 결과를 집계하는 `GET /v2/admin/notifications/broadcasts/{campaignId}`를 더한다. 오류 코드 `ADMIN_1404`·`ADMIN_1405`와 `BROADCAST_CAMPAIGN_STATUS`를 추가한다. v1 broadcast는 같은 캠페인으로 접수하는 deprecated 경로가 된다.
- 772fd2c: 푸시 data에 kind별 판별 유니온 `navigation`을 더한다. 기존 type·action·context·routing은 구 앱 호환용으로 그대로 싣고, 마케팅 배치 푸시도 단건처럼 `MARKETING` category를 싣는다.
- 079dd9f: 소셜 로그인·OAuth 코드 교환 응답에 `isNewUser`를 더한다. 이번 요청에서 계정을 새로 만들었을 때만 true이고, 기존 계정·이메일 자동 연결·탈퇴 유예 복구는 false다. 선택 필드라 구 앱은 무시한다.
- 2d35228: 할 일 댓글을 댓글·답글 2단계 묶음으로 바꾸고 v2 읽기 API를 추가한다.

  - `GET /v2/todos/{todoId}/comments`: 댓글 묶음(대표 답글·답글 요약)과 `anchorCommentId` 위치. 계약 `todoCommentThreadsResponseSchema`·`getTodoCommentThreadsQuerySchema`
  - `GET /v2/todos/{todoId}/comments/{commentId}/replies`: 묶음 답글을 작성 순으로, `aroundReplyId` 페이지. 계약 `todoCommentRepliesResponseSchema`·`getTodoCommentRepliesQuerySchema`
  - v1 개요·대화는 응답 모양을 유지하고 2단계 값만 내려간다(Swagger deprecated, 1.14.0 이하 앱 전용). 답글에 답해도 같은 묶음에 붙고 `replyTo`가 대상을 알려 준다.
  - 댓글 작성·수정·삭제·좋아요에 사용자별 요청 한도(429 `SYS_0001`)를 둔다.
  - `TODO_COMMENT_LIMITS.REPLY_PAGE_DEFAULT_SIZE`를 추가한다.

- dc7defe: 할 일 댓글을 댓글·답글 2단계 묶음으로 저장한다. 답글에 답해도 같은 묶음에 붙고 `replyToCommentId`가 @대상을 남긴다. v1 개요·대화는 응답 모양을 유지하고 2단계 값만 내려가며 재귀 SQL을 쓰지 않는다. 기존 답글은 마이그레이션에서 묶음 머리 아래로 옮긴다. 재시도 응답의 알림 수신자 기록과 삭제된 글 focus가 null이던 문제를 고친다. 답글에 단 답글 알림은 "내 답글에" 문구를 쓴다. `TODO_COMMENT_KIND`를 추가한다.

## 1.14.0

### Minor Changes

- b4aa0e6: 유료 기능을 `PREMIUM_FEATURES` 카탈로그와 FREE/PREMIUM/ADMIN 접근 단계로 판단한다. 인증 응답에 `isPremium`·`entitlements`(선택 필드)를 더하고, 스토어 결제 유예·환불·TRANSFER와 친구 초대 보상 기간을 같은 권한으로 처리한다.
- a0e0ff8: 1.14.0 앱을 위한 날씨 v2(`/v2/weather`, WeatherKit)를 추가하고, 모든 REST 계약과 컨트롤러를 `v1/` 폴더로 정리한다. 기존 `/v1` 경로와 응답은 그대로다.
