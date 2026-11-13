# @aido/api

## 1.15.3

### Patch Changes

- 0693b39: 웹 OAuth `start`·`web-callback` query와 `PATCH /follows/friends/{followId}/reorder` path를 공유 schema(`oauthStartQuerySchema`·`oauthWebCallbackQuerySchema`·`followIdParamSchema`)로 검증한다. 출시 앱이 보내는 `redirect_uri`·`mode`(login·link)와 서버가 준 followId는 그대로 받고, 정하지 않은 `mode`·형식이 틀린 `user_hint`·followId만 400 `SYS_0002`가 된다. 공급자 화면에서 취소해 code 없이 온 콜백은 공급자에 교환을 묻지 않고 지금과 같은 `USER_0602`로 앱 딥링크에 돌려보낸다.

## 1.15.2

### Minor Changes

- 30801bb: 콕 답장·감사 기능이 서버 설정으로 꺼진 경우를 새 오류 코드 `NUDGE_1111`(404, "지금은 콕 답장과 감사를 사용할 수 없습니다.")로 알린다. 전에는 "없는 콕"과 같은 `NUDGE_1105`였다. 출시 앱(1.15.1 이하, `X-App-Version`이 없거나 1.15.2 미만)은 보낸 콕 목록이 `NUDGE_1105`로 꺼진 상태를 알아 같은 경우에 계속 `NUDGE_1105`를 받는다. "없는 콕·내 콕이 아님"은 모든 앱에 `NUDGE_1105` 그대로다. 답장·감사 API 5개의 404 문서에 `NUDGE_1111`을 더한다.
- b19194d: 서버와 앱이 함께 지키는 한도·값 목록·알림 스키마를 `@aido/api`에 한 번만 선언한다. `notificationTypeSchema`·`notificationActionTypeSchema`·`notificationContextSchema`·`notificationActionSchema`는 `contracts/notification`에서 `common`으로, `appStoreVersionPattern`은 `contracts/app-config`에서 `vocabulary`로 옮기며(`APP_STORE_VERSION_PATTERN`) 루트 import는 그대로 쓸 수 있다.
- 796eb98: 할 일 개요 `GET /v1/todos/overview`(`getTodoOverview`, `TodoOverviewResponseDto`)를 더한다. 할 일·완료한 할 일·진행 중인 반복이 있는지(`hasTodo`·`hasCompletedTodo`·`hasActiveRepeat`)를 서버가 계산해 한 번에 준다. `hasActiveRepeat`은 진행 중 반복 상한과 같은 기준(다음 회차가 남은 규칙)이고 휴면으로 멈춘 규칙도 센다. 기존 목록·요약 API는 그대로다.
- c1ef3fd: 인증 코드 재발송 대기(`VERIFY_0753`, 429)의 `details.remainingSeconds`를 운영 응답에도 싣는다. 전에는 서버가 값을 만들었지만 `PUBLIC_ERROR_DETAILS`에 등록되지 않아 운영 필터가 지웠고, 값도 남은 시간이 아니라 상수 60초였다. 이제 같은 종류 코드의 마지막 발급 시각에서 남은 초(1~60, 정수)를 계산한다. `@aido/api/errors`에 `verificationResendCooldownErrorDetailsSchema`와 `hasPublicErrorDetails`를 더한다. 상태·코드·문구는 그대로이고 `details`만 새로 실린다. 출시 앱(1.15.1 이하)도 이 값을 읽어 다시 보내기 타이머를 켠다.
- 7d2622e: `@aido/api/vocabulary`에 비밀번호에 쓸 수 있는 특수문자 `PASSWORD_ALLOWED_SYMBOLS`(`@$!%*#?&`)와 그 밖의 문자가 섞였는지 보는 `hasDisallowedPasswordCharacter`를 더한다. `PASSWORD_RULES.PATTERN`도 이 특수문자로 만들어 목록의 원본이 하나이고, 정규식 원문은 전과 바이트 단위로 같아 가입·비밀번호 재설정·변경 요청의 검사와 OpenAPI pattern은 그대로다. 앱은 이것으로 쓸 수 없는 문자가 섞인 비밀번호에 이유를 보인다.

### Patch Changes

- 1b6e970: 가입 이름·프로필 이름·카테고리 이름(생성·수정)을 앞뒤 공백을 지운 뒤 검사한다. 공백만 쓴 이름은 빈 이름으로 보고 400 `SYS_0002`로 거절한다(전에는 빈 이름으로 저장됐다). 길이 상한(이름 20자, 카테고리 50자)도 공백을 지운 뒤 세므로 앞뒤 공백을 더해 넘던 이름(" 가×20 ")은 이제 통과한다. 출시 앱은 `SYS_0002`를 알아 앱 카탈로그 문구("잘못된 요청이에요"/"Invalid request")를 보인다.
- 1e28572: `@aido/api/errors`에서 패키지 테스트만 쓰던 옛 함수·타입을 지운다: `createErrorResponse`, `ErrorResponse`(description·path가 있던 옛 응답 모양), `getErrorsByDomain`(SUBSCRIPTION 이후 도메인이 빠져 있었다), `getErrorsByHttpStatus`, `getAllErrorCodes`, `getAllErrors`, `getError`. 서버·앱은 쓰지 않았고 실패 응답 모양은 `@aido/api/common`의 `errorEnvelopeSchema`·`RestErrorResponse` 그대로다. `ErrorCode`·`Errors`·`HttpStatus`·`isErrorCode`·공개 details는 그대로다.
- 2bddbcc: 오류 기본 문구의 앞으로의 시점을 "후"에서 "뒤"로 바꾼다(`VERIFY_0753` "인증 코드는 1분 뒤에 다시 보낼 수 있습니다.", `NUDGE_1102`·`CHEER_1202` "… 24시간 뒤에 다시 시도해주세요.", `NUDGE_1108` "… 1시간 뒤에 다시 시도해주세요."). `Errors`와 서버 `ko/errors.json`이 함께 바뀌고 코드·HTTP 상태·응답 모양은 그대로다. 출시 앱은 앱 카탈로그 문구를 먼저 보여 화면이 바뀌지 않는다.
- 30b7963: 날씨 v2 리포트 응답에서 서버가 앞으로 더할 열거 값을 그 칸만 대체값으로 읽는다(`.catch`). 날씨 상태는 `CLOUDY`, 강수 형태는 `MIXED`(분 단위 구간은 `null`), 기압 추세는 `STEADY`, 달 위상은 `NEW`, 특보 심각도는 `UNKNOWN`, 옮기기 이유는 `null`, 모르는 대기질 출처는 대기질 칸째 `null`이다. 서버가 보내는 값과 필수 칸은 같고 OpenAPI에는 해당 속성의 `default`만 더해진다.

## 1.15.1

### Patch Changes

- 3a4ca7f: 카테고리를 지울 때 안의 할 일을 다른 카테고리로 옮길지, 카테고리와 함께 지울지 고를 수 있다. 삭제 요청에 선택 값 `todoHandling`(`move`·`delete`)을 더했고, `move`는 옮길 카테고리가 꼭 필요하고 `delete`는 옮길 카테고리를 받지 않는다(어기면 `SYS_0002`). 함께 지우면 하위 항목·댓글·반복 규칙·예약된 알림까지 한 번에 지우고, 완료한 할 일도 사라져 날짜별 완료 기록에서 빠진다(연속 기록과 지난 주간 성취는 그대로다). 지우기 전에 `GET /v1/todo-categories/:id/deletion-preview`로 할 일·완료·진행 중 반복 수와 마지막 카테고리인지를 볼 수 있고, 삭제 응답에는 실제로 한 일(`result`)이 함께 온다. `todoHandling`을 보내지 않는 출시 앱(1.15.0까지)은 전과 같이 할 일이 있으면 옮길 카테고리를 요구하고 같은 오류 코드를 받는다. 옮기기는 사용자 인덱스를 타도록 바꿔 할 일 5,000개도 0.1초 안에 끝난다.
- 26dcb4a: DB 연결 끊김·풀 대기 초과·쿼리 시간 초과(57014, 클라이언트 쿼리 상한 초과 포함)·잠금 대기 실패(55P03)를 새 오류 코드 `SYS_0005`(503, 잠시 뒤 다시 시도)로 응답하고 `@aido/api` 오류 계약과 ko·en 문구에 더한다. 알 수 없는 unique 제약 위반은 지금처럼 409 `SYS_0004`이고 운영 경보를 올린다.
- 26dcb4a: 알림함 응답 항목에 푸시와 같은 계산으로 정한 선택 필드 `navigation`을 더한다. 출시 앱은 새 필드를 무시하므로 동작이 같다.
- e598830: 관리자 브로드캐스트 캠페인(`POST /v2/admin/notifications/broadcasts`)에 선택 필드 `localizedContent`(언어별 제목·본문, 없는 언어는 `title`·`body`)와 `delivery`(`NOW` 기본, `RECIPIENT_LOCAL_TIME`은 수신자 저장 시간대의 날짜·시각, 이미 지났으면 다음 날)를 더하고, 마케팅 분배·발송 작업은 우선순위 0 차선에 올린다. 성장 지표 응답에 `stickiness`(DAU/MAU %)를 더한다. 관리자 API 추가 필드라 출시 앱 계약은 그대로다. `BroadcastCampaign`에 `localizedContent`·`delivery` 컬럼(nullable jsonb)을 더하는 추가 마이그레이션이 있다.
- f6e9f13: 알림 권한을 허용한 기기가 토큰 발급에 한 번 실패해 `token: null`로 보고해도 이미 등록된 푸시 토큰을 지우지 않는다(출시된 1.13~1.15.0 앱도 서버만으로 고쳐진다). 권한·보고 시각과 토큰의 세션·앱 버전만 이번 보고로 옮기고, 거절·미요청 보고는 지금처럼 토큰을 지운다. 로그아웃 해제를 보내지 못하고 세션이 끝난 기기(갱신 토큰 만료, 오프라인 로그아웃)는 계정 푸시를 계속 받았는데, 로그인 없이 기기 ID와 그 기기의 토큰이 모두 맞을 때만 지우는 `POST /v1/notifications/push-devices/unregister`를 더했다. 맞는 등록이 없어도 같은 200 `{ unregistered: true }`를 주고 IP마다 분당 20번까지 받는다. 오래 쉰 사용자의 재방문 알림을 막지 않으려 발송을 세션으로 거르지는 않는다. 푸시마다 알림 종류로 정한 보관 시간(할 일 리마인더 1시간, 아침·저녁 요약과 날씨 2시간, 그날 알림 3시간, 소셜 12시간, 나머지 24시간)과 우선순위(high)를 실어 꺼져 있던 기기에 지난 리마인더가 쌓이지 않는다. Android 채널은 출시 앱의 `default` 그대로다. 사용자가 시각을 정한 할 일 리마인더와 프리미엄 아침·저녁 리마인더는 날씨 알림처럼 야간 수신을 꺼도 보내고, 광고성 야간 금지와 소셜·재방문 알림의 야간 설정은 그대로다. 푸시 열람 로그 키는 `notification.push.opened`이고 알림마다 처음 열 때 한 번 남는다. 기존 operation의 계약 fingerprint와 DB는 바뀌지 않는다.
- 1e354d3: 서버 15개 Context를 한 가지 구조로 정리한다. 기능(slice)마다 Nest Module 하나·Aggregate Root 하나를 두고, 쓰기는 Entity·값 객체, 포트는 abstract class DI 토큰(`provideUseCase` 조립, Symbol 토큰·barrel 재수출 제거), 업무 오류는 slice의 이름 있는 생성 함수, 큐는 `defineQueue` 한 곳, 날짜는 `ClockPort`와 Temporal(`dayjs` 제거), 설정은 namespace config로 읽는다. 이름·경계·순환·미사용 코드는 ls-lint·dependency-cruiser·관례 검사·knip이 `pnpm check`에서 막는다. `@aido/api`는 엔티티 ID 규칙을 `ENTITY_ID_PATTERN`(`^c[0-9a-z]{8,63}$`) 하나로 두어 `z.cuid()`를 대신하고(운영 ID 모양과 출시 앱 요청은 그대로 통과한다), 표준 커서 목록 `cursorPageSchema`로 할 일·친구 할 일·메모·주간 성취 목록을 만들며(JSON Schema 출력은 바이트 단위로 같다), 쓰지 않는 follow 계약 별칭과 `weeklyAchievementSchema` export를 지운다. 출시 앱 OpenAPI 지문은 ID pattern만 갱신했고 HTTP 응답 모양·오류 코드·큐 이름·잡 키는 그대로다.
- 26dcb4a: `@aido/api/vocabulary`에 앱·서버가 함께 쓰는 규칙을 모은다: 언어 규칙(`SUPPORTED_LOCALES`·`resolveSupportedLocale`, 값 없음 ko·지원하지 않는 언어 en), SemVer 비교, 공유 enum 튜플, 날씨 시간대 경계·마케팅 푸시 카테고리·매월 반복 말일 기준. 기존 export 경로(`@aido/api/common` 포함)와 계약 값은 그대로다.
- 26dcb4a: 날씨 v2(`GET /v2/weather`) 응답에 선택 필드 `briefing`(`reason`·`affectedTodoIds`·`rescheduleOptions`)을 더해 비·더위에 영향받는 오늘 남은 할 일과 옮길 시각 후보를 서버가 고른다. 할 일을 읽지 못하면 `briefing`만 빠지고 리포트는 그대로 응답한다.

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
- 11882e8: 서비스·거래 알림을 광고성 동의와 분리한다. 온보딩 D0~D7 사용법 안내는 서비스 알림으로 바꿔 광고성 동의 없이 보내고, 광고성 푸시는 제목 앞 "(광고)"와 본문 끝 수신 거부 방법을 한 곳에서 붙인다. 광고성 수신 동의 2년 재확인 알림을 매월 보내고 `UserConsent.marketingReconfirmedAt`에 남긴다. 광고성 동의 변경 응답에 철회를 처리한 서버 시각(`marketingWithdrawnAt`·`marketingPushWithdrawnAt`)을 더했다. 이메일·소셜 가입이 동의한 약관 버전(`agreedTermsVersion`, 지금까지 늘 null)을 `TERMS_VERSION.CURRENT`로 남긴다. 소셜 가입은 지금처럼 가입 때 약관·개인정보 동의를 기록한다. `pushEnabled`·`nightPushEnabled`의 DB·어휘 기본값을 가입 seed와 같은 true로 맞췄다(기존 행은 그대로).
- a4fc198: 할 일 시간을 떠 있는 시각으로 바꾼다. `Todo.scheduledLocalTime`(HH:mm)이 진실이고 `scheduledTime`은 날짜 + 벽시계 + 사용자 시간대로 만든 파생값이다. 응답에 선택 칸 `scheduledLocalTime`을 더하고, 저장 시간대가 바뀌면 `todo-timezone-rebase.v1` 작업이 시간 있는 모든 할 일의 순간을 다시 계산하고 완료 전이고 앞으로 울릴 회차의 알림을 다시 잡는다. 이미 지난 알림 단계는 바로 보내지 않고 건너뛴다. 출시 앱의 옛 경로(`POST /v1/todos/recurring`, 메모 변환의 `isRecurring`, AI 제안 수락)에는 진행 중 반복 300개 상한을 두고 `TODO_0813`으로 거절한다.
- 19708b7: 일일 완료 조회 응답(`GET /v1/daily-completions`, 친구 조회 포함)에 선택 칸 `multiDayTodos`(시작일·끝 날짜·완료 여부·카테고리 색)를 더한다. `completions`는 출시 앱이 읽던 대로 시작일에만 세고, 새 앱이 달력에서 기간 안의 날에도 점을 그린다.
- 0750b0b: 메모 나누기(`parse-memo`)도 빠른 계획·녹음 정리처럼 다가오는 할 일을 맥락으로 받아 겹침을 판정한다. 응답 할 일에 선택 칸 `duplicateOfTodoId`를 더하고, 모델이 못 고른 겹침은 같은 정책(`findDuplicateTodoId`)이 제목과 날짜로 다시 찾는다. 출시 앱은 새 칸을 버리므로 동작이 같다.
- c93dcec: 메모 나누기(`POST /v1/ai/parse-memo`)에 선택 `Idempotency-Key` 헤더를 더해 재시도가 두 번 차감되지 않게 한다. 헤더가 없는 출시 앱은 지금처럼 요청마다 차감한다. 공통 헤더 이름 `IDEMPOTENCY_KEY_HEADER`를 vocabulary에 더한다.
- 5c5da5b: 1.15.0 호환 검증에서 나온 반복 할 일 결함을 고친다. 이후 모두로 시간을 고치면 요청 시간대로 해석하고 규칙 시간대도 바꾼다. 나뉜 반복의 앞 구간에서 이후 모두가 뒤 구간까지 닿는다. 이관은 묶음 전체에서 규칙을 유추한다. 규칙 없는 묶음의 전체 삭제가 동작하고, 출시 앱의 `POST /v1/todos/recurring`에는 진행 중 반복 상한을 적용하지 않는다.
- 68cc868: `/me`에 선택 칸 `premiumPlanType`(`ANNUAL`·`MONTHLY`, 모르면 null)을 더한다. 지금 프리미엄 기간을 정하는 스토어 구독의 상품 ID로 정하고 Play의 `상품:기본요금제`는 `:` 앞만 본다. 체험 종료 3일 전 알림의 자동 갱신 문구가 "연간 구독"을 하드코딩하지 않고 요금제로 고르며, 모르는 상품이면 "구독"이라고 쓴다. 어휘 `SUBSCRIPTION_PLAN_TYPES`·`STORE_SUBSCRIPTION_PRODUCTS`·`PREMIUM_RENEWAL_NOTICE_DAYS`를 더했다.
- c123a4c: 연간으로 자동 갱신될 구독에 결제 7일 전 기간마다 한 번 알린다(서버 전용 `PREMIUM_RENEWAL_UPCOMING`, 앱에는 `SYSTEM_NOTICE`와 구독 화면 경로). 월간·모르는 상품은 보내지 않고, Play에서 요금제를 바꿔 남은 옛 체인에도 보내지 않는다. `Subscription.renewalNoticeExpiresAt`에 알린 기간의 만료를 남겨 갱신으로 기간이 바뀌면 다음 기간에 다시 보낸다. RevenueCat `PRODUCT_CHANGE`는 정보성이라 상품·만료·상태를 바꾸지 않고 웹훅 `new_product_id`를 `Subscription.nextProductId`로 예약만 하며, `RENEWAL`·`INITIAL_PURCHASE`가 이벤트 상품을 지금 상품으로 맞춘다(지난 기간 `PRODUCT_CHANGE`가 만료를 앞당겨 쌓아 둔 보상을 시작하던 문제를 고친다). `premium-grant-sweep`의 안내 단계는 한 단계가 실패해도 나머지를 보낸 뒤 잡을 실패로 끝낸다.
- 113cf8a: 스토어 무료 체험을 저장하고 끝나기 3일 전에 한 번 알린다. RevenueCat 웹훅의 `period_type`을 `Subscription.periodType`에 남기고(`INITIAL_PURCHASE`·`RENEWAL`, 전환 갱신은 `NORMAL`), 체험 단계(시작·해지·전환·종료)는 billing 정책 하나가 판단한다. 계약은 추가만 했다: 웹훅 `is_trial_conversion`·`expiration_reason`, `/me`의 `premiumIsTrial`, 어휘 `STORE_PERIOD_TYPES`·`PREMIUM_TRIAL_ENDING_NOTICE_DAYS`. 체험 끝은 스토어 `expiration_at_ms` 그대로이고 체험 중 받은 초대 보상은 체험 뒤에 이어진다. 안내 알림 `PREMIUM_TRIAL_ENDING`은 서버 전용 타입이라 앱에는 `SYSTEM_NOTICE`와 구독 화면 경로로 보내며 기존 `premium-grant-sweep` 잡에 붙였다. 보상 종료 알림 `PREMIUM_GRANT_ENDING`은 거래 알림으로 바꿔 광고성 동의 없이 보낸다. 관리자 결제 알림은 체험 시작을 ₩0 구매 대신 "무료 체험 시작"과 체험 끝 날짜로 보여 준다. 전환 뒤 늦게 온 체험 해지와 지난 기간의 늦은 갱신은 상태를 되돌리지 않는다.
- 702e303: 출시 전 응답인 `POST /v1/quick-plans`, `POST /v1/voice-notes/digest`에서 `meta`(모델·토큰·프롬프트 버전)를 뺀다. 값은 서버 로그에만 남긴다. `parse-todo`, `parse-memo`의 응답은 그대로다.

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
