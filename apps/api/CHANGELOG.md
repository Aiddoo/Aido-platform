# @aido/server

## 1.15.3

### Patch Changes

- 운영 관측을 다듬는다. AI 업체 health 회로(시간 초과·5xx·과부하)가 열리면 `ai.provider.health-circuit-opened`, 키가 설정된 AI 업체가 하나도 없으면 `ai.provider.none-available` 경보를 올린다(동의 범위 때문에 없는 경우는 경보 없이 `AI_1301`). 경로·큐가 없는 루트 span은 추적 표본에서 빼고, 빈 `SENTRY_TRACES_SAMPLE_RATE`는 기본값으로 읽는다. 운영 경보 Sentry 이슈의 부제는 경보 key다.
- 자주 도는 조회의 DB 비용을 줄인다. 카테고리 할 일 개수 join에 소유자를 걸어 인덱스를 타고, 완료 묶음·연속 기록의 날짜 겹침 조건을 목록과 같은 두 갈래로 나눈다. 완료 토글은 오늘 현황을 한 번만 세고 마일스톤 집계를 101에서 멈추며, 캐시 세대를 바꾼 뒤 키 전체 SCAN을 기다리지 않는다(옛 값은 TTL 1분·10분 안에 만료). 할 일 순서는 1024 간격 정수로 두어 순서 바꾸기가 한 행만 쓰고, 간격이 없을 때만 그 사용자 범위를 다시 번호 매긴다. 응답의 `sortOrder`는 여전히 정수이고 순서 의미는 같지만 숫자 값은 달라진다(새 할 일은 1024부터). 콕·응원 안 읽음 수에 부분 인덱스(추가 마이그레이션 `social_unread_count_indexes`)와 60초 캐시를 두고, 사용자 검색 다음 쪽은 커서에 실은 총수를 써 다시 세지 않는다(옛 커서도 받는다). 댓글 이어 쓰기는 한 INSERT, 공지 발송 등록은 `enqueueMany` 한 번, 리텐션 조회는 `pg_timezone_names`를 하루 캐시한다. 응답 모양·오류 코드·큐 이름은 그대로다.
- 매분 도는 시간대 리마인더(`timezone-reminder.v1`)가 시간대마다 같은 쿼리를 따로 보내던 것을 같은 현지 시각(날짜·시·분·요일)인 시간대 묶음마다 한 번(`timezone IN (...)`)으로 줄인다. 날씨 문구와 오늘 할 일은 행에 실은 사용자 시간대로 계산하고, 소셜 다이제스트 큐 payload는 시간대마다 그대로 보낸다. 윈백 단계 확인·기록은 Redis pipeline 한 번이다. 할 일 리마인더 큐는 묶음을 한 번에 읽고 알림을 한 번에 넣되 발송은 단건 경로라 설정 행이 없는 사용자도 전처럼 기본값으로 받는다. 서버 로그의 `timezone` 필드는 `timezones`(배열)가 된다. 큐 이름·잡 키·payload·응답 모양은 그대로다.
- @aido/api@1.15.3

## 1.15.2

### Minor Changes

- 30801bb: 콕 답장·감사 기능이 서버 설정으로 꺼진 경우를 새 오류 코드 `NUDGE_1111`(404, "지금은 콕 답장과 감사를 사용할 수 없습니다.")로 알린다. 전에는 "없는 콕"과 같은 `NUDGE_1105`였다. 출시 앱(1.15.1 이하, `X-App-Version`이 없거나 1.15.2 미만)은 보낸 콕 목록이 `NUDGE_1105`로 꺼진 상태를 알아 같은 경우에 계속 `NUDGE_1105`를 받는다. "없는 콕·내 콕이 아님"은 모든 앱에 `NUDGE_1105` 그대로다. 답장·감사 API 5개의 404 문서에 `NUDGE_1111`을 더한다.
- b19194d: 서버와 앱이 함께 지키는 한도·값 목록·알림 스키마를 `@aido/api`에 한 번만 선언한다. `notificationTypeSchema`·`notificationActionTypeSchema`·`notificationContextSchema`·`notificationActionSchema`는 `contracts/notification`에서 `common`으로, `appStoreVersionPattern`은 `contracts/app-config`에서 `vocabulary`로 옮기며(`APP_STORE_VERSION_PATTERN`) 루트 import는 그대로 쓸 수 있다.
- 796eb98: 할 일 개요 `GET /v1/todos/overview`(`getTodoOverview`, `TodoOverviewResponseDto`)를 더한다. 할 일·완료한 할 일·진행 중인 반복이 있는지(`hasTodo`·`hasCompletedTodo`·`hasActiveRepeat`)를 서버가 계산해 한 번에 준다. `hasActiveRepeat`은 진행 중 반복 상한과 같은 기준(다음 회차가 남은 규칙)이고 휴면으로 멈춘 규칙도 센다. 기존 목록·요약 API는 그대로다.
- c1ef3fd: 인증 코드 재발송 대기(`VERIFY_0753`, 429)의 `details.remainingSeconds`를 운영 응답에도 싣는다. 전에는 서버가 값을 만들었지만 `PUBLIC_ERROR_DETAILS`에 등록되지 않아 운영 필터가 지웠고, 값도 남은 시간이 아니라 상수 60초였다. 이제 같은 종류 코드의 마지막 발급 시각에서 남은 초(1~60, 정수)를 계산한다. `@aido/api/errors`에 `verificationResendCooldownErrorDetailsSchema`와 `hasPublicErrorDetails`를 더한다. 상태·코드·문구는 그대로이고 `details`만 새로 실린다. 출시 앱(1.15.1 이하)도 이 값을 읽어 다시 보내기 타이머를 켠다.

### Patch Changes

- 1b6e970: 가입 이름·프로필 이름·카테고리 이름(생성·수정)을 앞뒤 공백을 지운 뒤 검사한다. 공백만 쓴 이름은 빈 이름으로 보고 400 `SYS_0002`로 거절한다(전에는 빈 이름으로 저장됐다). 길이 상한(이름 20자, 카테고리 50자)도 공백을 지운 뒤 세므로 앞뒤 공백을 더해 넘던 이름(" 가×20 ")은 이제 통과한다. 출시 앱은 `SYS_0002`를 알아 앱 카탈로그 문구("잘못된 요청이에요"/"Invalid request")를 보인다.
- 3a0a36a: `ApplicationException`·`DomainException`이 감싼 원본 오류를 `cause`로 받는다(세 번째 인자 `{ message?, cause? }`). AI 생성 실패(`AI_1301`·`AI_1302`·`AI_1310`), 날씨 리포트 공급자 실패(`WEATHER_1901`), 사용자 태그 충돌(`SYS_0001`)이 원본을 넘겨 Sentry에서 원인 오류가 이어진다. 응답의 코드·상태·문구·details는 그대로다.
- 2bddbcc: 오류 기본 문구의 앞으로의 시점을 "후"에서 "뒤"로 바꾼다(`VERIFY_0753` "인증 코드는 1분 뒤에 다시 보낼 수 있습니다.", `NUDGE_1102`·`CHEER_1202` "… 24시간 뒤에 다시 시도해주세요.", `NUDGE_1108` "… 1시간 뒤에 다시 시도해주세요."). `Errors`와 서버 `ko/errors.json`이 함께 바뀌고 코드·HTTP 상태·응답 모양은 그대로다. 출시 앱은 앱 카탈로그 문구를 먼저 보여 화면이 바뀌지 않는다.
- e5fbe50: Swagger OAuth 엔드포인트 설명의 앱 구현 가이드 경로를 새 문서(`apps/mobile/docs/auth.md`)로 고친다.
- 1d44bf6: 마이그레이션 `drop_push_daily_budget`이 1.15.1·1.15.2 어느 코드도 쿼리하지 않는 `PushDailyBudget` 테이블을 지운다. 행이 하나라도 있으면 지우지 않고 migrate 전체를 되돌린다(API는 바뀌지 않는다). FK 때문에 `User`를 잠깐 배타 잠금하므로 잠금 대기를 0.5초로 줄여 앱 요청이 밀리지 않게 한다. `User.twoFactorEnabled`·`twoFactorSecret`, `Subscription.dataRetentionUntil`은 1.15.1 이미지가 아직 이름으로 읽고 써서 이번에는 스키마에서만 빼고(`retire_unused_columns`, 실행 SQL 없음) DB 칸은 1.16.0에 값이 비었는지 확인한 뒤 지운다. 1.15.1 CHANGELOG의 "1.15.2에서 지운다" 가운데 이 셋은 1.16.0으로 미룬 것이다. `RetentionExperimentAssignment.assignedAt`은 다른 칸에 없는 배정 시각이라 지우지 않는다. 응답 모양과 출시 계약 지문은 그대로다.
- c996b87: 서버가 바로 만들던 `ApplicationException`·`DomainException` 265곳을 slice `<slice>.errors.ts`의 이름 있는 생성 함수로 옮기고(거부는 `application/`, 불변식은 `domain/`), 그 밖에서 바로 만드는 것을 Oxlint `aido/no-inline-coded-exception`으로 막는다. 응답의 코드·HTTP 상태·문구·details는 그대로다.
- 30b7963: 날씨 v2 리포트 응답에서 서버가 앞으로 더할 열거 값을 그 칸만 대체값으로 읽는다(`.catch`). 날씨 상태는 `CLOUDY`, 강수 형태는 `MIXED`(분 단위 구간은 `null`), 기압 추세는 `STEADY`, 달 위상은 `NEW`, 특보 심각도는 `UNKNOWN`, 옮기기 이유는 `null`, 모르는 대기질 출처는 대기질 칸째 `null`이다. 서버가 보내는 값과 필수 칸은 같고 OpenAPI에는 해당 속성의 `default`만 더해진다.
- 4a276ac: 주간 리포트의 `periodLabel`을 주간 성취 `weekLabel`과 같은 "11월 2주차"/"Week 2 of Nov"(주의 목요일이 속한 달의 몇째 주)로 만든다. 주차 달의 해가 사용자 저장 시간대의 올해가 아니면 연도를 붙인다("2025년 12월 1주차"/"Week 1 of Dec 2025"). 두 라벨은 `shared/domain/time/week-of-month.ts`의 `formatIsoWeekLabel` 하나에서 나오고 앱과 같은 표(`packages/api/test/fixtures/week-of-month-cases.json`)로 테스트한다. 응답 모양은 그대로(문자열)다. 주간 성취 라벨은 올해 주가 그대로이고 다른 해 주만 연도가 붙는다. 월간 라벨("2026년 3월")도 그대로다.
- Updated dependencies [1b6e970]
- Updated dependencies [1e28572]
- Updated dependencies [2bddbcc]
- Updated dependencies [30801bb]
- Updated dependencies [b19194d]
- Updated dependencies [796eb98]
- Updated dependencies [c1ef3fd]
- Updated dependencies [30b7963]
- Updated dependencies [7d2622e]
  - @aido/api@1.15.2

## 1.15.1

### Patch Changes

- 6c6d1b5: ADMIN 역할은 이제 무제한이 아니라 프리미엄과 같은 기능·한도를 받는다. 카테고리는 30개까지(이미 더 가진 카테고리는 그대로 두고 새로 만들기만 `TODO_CATEGORY_0857`로 막는다), AI 할 일 만들기·녹음 정리는 프리미엄 공정 사용 상한(월 1,000회·100회)에서 프리미엄과 같은 오류로 막히고, AI 사용자 일 비용 예산도 모두와 같다. `GET /v1/entitlements`·`/me.entitlements`는 ADMIN에게 프리미엄 한도를 보여 주고 `tier`는 계속 `ADMIN`이라 출시 앱의 관리자 표시는 그대로다. 응답 모양과 계약 fingerprint는 바뀌지 않는다.
- b9d5d2c: AI 제안·리포트 디스패치가 Drizzle 1.0 RC에서 첫 페이지의 `id: undefined` 조건으로 실패해 아무도 등록하지 못하던 문제를 고친다(1.15.0부터). 매일 AI 제안은 07:30 KST 한 번 대신 매시 정각 디스패치가 사용자 현지 07시대(10시 전까지 따라잡기)인 사용자를 고르고, 같은 현지 날짜에는 한 번만 분석한다(서울 외 사용자는 전환하는 날 하루를 건너뛸 수 있다). 제안 알림은 `copyKey`·`copyFacts`를 실어 알림함이 요청 언어로 그린다. 메모 나누기의 "이번 주말 X"는 새 앱이 읽는 `repeat`에서 토요일 한 번(`repeat`·`endDate` null)이고 출시 앱의 `isRecurring`·`recurrence`는 그대로다. Sentry AI span에 입력·지시·응답 문장을 싣지 않고(Sentry 11 기본값은 싣는다) 릴리스를 `aido-server@<version>`으로 남긴다. AI 동의 확인은 동의 시각이 지금 이전인지도 본다. 리포트·제안 목록은 같은 시각이면 id 내림차순이다. 리포트 매시 스케줄은 배포로 빠진 실행을 한 번만 보정한다. parse-todo·parse-memo의 남은 횟수 선검사는 access `@RequireQuota("AI_PLAN")`로 옮겼고 동의 확인이 먼저이며 오류 코드·상세는 같다. HTTP 계약·오류 코드·큐 이름·잡 키는 그대로다.
- 74fa75a: 구독·보상·역할이 바뀌는 순간 동시에 들어온 요청이 이전 권한과 프로필을 다시 캐시에 남겨 최대 10분 동안 바뀌기 전 상태가 보이던 경합을 막았다. 탈퇴 유예 중인 계정을 로그인으로 되살리면 권한도 바로 다시 읽어 프리미엄 사용자가 무료로 보이지 않는다. 한 사용자가 위치를 옮겨도 같은 격자의 다른 사용자가 쓰는 날씨 캐시를 지우지 않아 공급자를 다시 부르지 않는다. 운영자가 DB에서 ADMIN을 USER로 내리면 토큰을 갱신할 때 현재 역할로 발급해 갱신을 이어 가도 관리자로 남지 않는다(access token 수명 15분 안에 반영). 역할을 못 읽어도 갱신은 막지 않는다.
- 26dcb4a: 친구 할 일 첫 페이지 캐시와 일간 완료 캐시는 저장 모양·집계 규칙이 바뀌어 배포 직후 옛 값을 한 번 미스로 보고 다시 읽는다. 캐시 key는 그대로다.
- 3a4ca7f: 카테고리를 지울 때 안의 할 일을 다른 카테고리로 옮길지, 카테고리와 함께 지울지 고를 수 있다. 삭제 요청에 선택 값 `todoHandling`(`move`·`delete`)을 더했고, `move`는 옮길 카테고리가 꼭 필요하고 `delete`는 옮길 카테고리를 받지 않는다(어기면 `SYS_0002`). 함께 지우면 하위 항목·댓글·반복 규칙·예약된 알림까지 한 번에 지우고, 완료한 할 일도 사라져 날짜별 완료 기록에서 빠진다(연속 기록과 지난 주간 성취는 그대로다). 지우기 전에 `GET /v1/todo-categories/:id/deletion-preview`로 할 일·완료·진행 중 반복 수와 마지막 카테고리인지를 볼 수 있고, 삭제 응답에는 실제로 한 일(`result`)이 함께 온다. `todoHandling`을 보내지 않는 출시 앱(1.15.0까지)은 전과 같이 할 일이 있으면 옮길 카테고리를 요구하고 같은 오류 코드를 받는다. 옮기기는 사용자 인덱스를 타도록 바꿔 할 일 5,000개도 0.1초 안에 끝난다.
- 8e85eb8: 카테고리 이름·색을 바꾸거나 순서를 바꾸거나 할 일을 다른 카테고리로 옮겨 지우면 친구가 보는 할 일 목록에도 바로 반영된다. 전에는 친구 화면 캐시가 최대 60초 동안 이전 카테고리 이름·색·순서를 보여 줬다.
- 26dcb4a: 일간 완료 응답의 카테고리 색을 앱과 같은 문자열 오름차순으로 내려주고, 카테고리 목록은 같은 순서 값이면 id 순으로 정렬한다. DB `GROUP BY` 결과 순서에 기대던 응답 순서를 명시한 것이다.
- 2993fbe: 같은 메모의 재정렬과 내용 수정·고정이 동시에 와도 한쪽 변경이 사라지지 않게, 있는 메모를 바꾸는 요청은 모두 메모·순서 잠금을 함께 잡는다. 콕 읽음 처리는 답장과 같은 할 일 행 잠금 뒤에 다시 읽어, 답장과 겹쳐도 답장을 지우지 않는다(읽은 시각은 처음 한 번만 남는다). 같은 공급자 계정의 첫 소셜 로그인(신규 가입·이메일 자동 연결)이 동시에 오면 사용자·계정은 하나만 만들고 두 요청 모두 그 사용자로 로그인한다. 다른 사용자에게 연결됐거나 같은 공급자의 다른 계정이 이미 있으면 지금처럼 공급자별 이미 연결된 계정 오류를, 그사이 다른 가입이 이메일을 가져갔으면 1.15.0과 같은 `EMAIL_0501`을 낸다.
- 26dcb4a: DB 연결에 `application_name=aido-api`와 세션 제한(statement 15초, lock 5초, idle in transaction 60초)을 두고, 풀 연결 대기 기본값을 5초로 한다(`DATABASE_POOL_CONNECTION_TIMEOUT_MS`, 0이면 무제한). DB가 아예 답하지 않을 때를 위해 클라이언트 쿼리 상한 20초를 앱 풀과 pg-boss 풀에 함께 두고, 유휴 연결이 끊겨도 프로세스가 죽지 않는다. 15초를 넘을 수 있는 배치 작업은 자기 트랜잭션에서만 시간 제한을 늘린다.
- 26dcb4a: `sslmode`가 있는 DB 연결은 서버 인증서를 검증한다(이미지에 든 RDS CA 사용). 비상시에만 `DATABASE_SSL_ALLOW_UNVERIFIED=true`로 검증을 끌 수 있고 기본값은 false다.
- 26dcb4a: DB 연결 끊김·풀 대기 초과·쿼리 시간 초과(57014, 클라이언트 쿼리 상한 초과 포함)·잠금 대기 실패(55P03)를 새 오류 코드 `SYS_0005`(503, 잠시 뒤 다시 시도)로 응답하고 `@aido/api` 오류 계약과 ko·en 문구에 더한다. 알 수 없는 unique 제약 위반은 지금처럼 409 `SYS_0004`이고 운영 경보를 올린다.
- 26dcb4a: 추가 마이그레이션 `db_performance`가 FK 인덱스 2개(`PushDeliveryAttempt.pushTokenId`, `TodoComment.replyToCommentId`)와 `pg_stat_statements` 확장을 만들고 DB 기본 `timezone`을 UTC로 둔다. 코드에서 쓰지 않는 컬럼·테이블은 롤백 호환을 위해 1.15.1에 남기고 1.15.2에서 지운다.
- ba9b111: 런타임 판단을 `NODE_ENV` 대신 배포 환경(`APP_ENV`, 없으면 `NODE_ENV=production`이면 production) 하나로 읽는다. 개발 전용 동작(오류 상세·Swagger UI·OAuth 개발 복귀 주소·localhost CORS)은 로컬 실행(development이고 production 빌드가 아님)에서만 켜지고 production 빌드로 도는 개발서버(`APP_ENV=development`)·staging·production·테스트 실행에서는 꺼진다(개발서버의 노출은 1.15.0과 같다). 응답 계약 검사는 운영 밖(테스트·개발서버·staging)에서 켠다. RevenueCat 웹훅 서명은 비밀이 있으면 모든 환경에서 검증하고, 비밀이 없으면 개발 환경만 건너뛰며 staging·production은 모두 거절한다. 초대 해시 비밀 요구도 staging까지 같은 기준이다. 운영에서 `EMAIL_PROVIDER`·`ADMIN_NOTIFIER_PROVIDER`가 `log`이거나, `RESEND_API_KEY`·`REVENUECAT_WEBHOOK_SECRET`이 없거나, 로그인 공급자·WeatherKit 자격이 빠지면 키 이름만 적고 시작을 거부한다(값은 싣지 않는다). `SENTRY_DSN`이 없으면 경고만 남긴다. 운영의 공개 `/health`는 큐 이름·실패 수·런타임 수치 없이 `{ status }`와 200/503만 준다(개발·스테이징은 상세를 그대로 준다). 비워 둔 `EMAIL_PROVIDER`·`ADMIN_NOTIFIER_PROVIDER`는 staging·production에서 `resend`·`discord`, 개발에서는 키·웹훅이 있을 때만 실제 공급자다. pg-boss client가 검증을 거친 env를 다시 파싱하다 `DATABASE_SSL_ALLOW_UNVERIFIED`에서 실패하던 경로를 없앴다. env 이름·HTTP 계약은 그대로다. 배포 전 운영 서버 env에 `REVENUECAT_WEBHOOK_SECRET`이 있는지 확인한다.
- 26dcb4a: 오류 응답의 코드 기본 문구를 요청 언어로 고른다(`Accept-Language`가 없으면 ko, 지원하지 않는 언어는 en). 한국어 응답은 지금과 바이트 단위로 같고, 던진 곳에서 정한 문구는 바꾸지 않는다.
- 26dcb4a: `/health`가 60초마다 잰 루프 지연 p99·힙·RSS·DB 풀 수치를 `runtime`에 싣고, 빠져 있던 큐 8개와 새 큐 정의의 DLQ도 함께 본다(운영의 공개 `/health`는 이 상세 없이 전체 상태만 준다). 풀 대기 30초 지속, 루프 p99 200ms 초과, 힙 85% 초과는 운영 경보로 알린다.
- 26dcb4a: 알림함 응답 항목에 푸시와 같은 계산으로 정한 선택 필드 `navigation`을 더한다. 출시 앱은 새 필드를 무시하므로 동작이 같다.
- 26dcb4a: 알림함 목록(`GET /v1/notifications`, `GET /v1/notifications/inbox`)이 새로 저장한 알림부터 요청 `Accept-Language`로 문구를 다시 렌더한다. `Notification`에 nullable `copyKey`·`copyFacts` 컬럼을 더하는 추가 마이그레이션이 있고, 옛 알림과 `Accept-Language`가 없는 요청은 저장한 문구를 그대로 쓴다.
- 26dcb4a: 큐 작업을 소비할 때 큐 정의의 payload schema로 검사해 모양이 틀린 작업은 완료 대신 실패(DLQ)로 남긴다(예: 시간대 재계산 작업은 전에는 경고 뒤 완료했다). 큐 이름·job key·옛 payload 모양은 그대로이고, 쓰지 않던 `JOB_POLLING_INTERVAL_SECONDS` env를 지운다.
- 26dcb4a: 초대받은 친구의 활동 기록을 프로세스 안 이벤트 대신 할 일 완료와 같은 트랜잭션에 쌓이는 구독 작업(`social.invitee-activity.v1`)으로 남긴다. 커밋 직후 서버가 멈춰도 잃지 않고, 활동일은 처리 시각이 아니라 완료 시각으로 정하며 실패하면 큐가 다시 시도한다.
- d39134e: 배경 작업 실패를 사람에게 알린다. 작업이 재시도를 모두 쓰고 실패하면(DLQ 이동·잘못된 payload 포함) `job.failed:<queue>:<errorType>` 운영 경보를 올리고, 재시도가 남은 실패는 로그만 남긴다. 15분마다 도는 `schedule-watchdog.v1`이 pg-boss에 등록된 모든 스케줄을 실제 예정 시각으로 보고 마지막 두 예정 실행 안에 끝난 실행이 없으면 `schedule.overdue`, 실패만 있으면 `schedule.failing`, 최근 15분 DLQ 유입이 있으면 `queue.dead-letter` 경보를 올린다. 감시 작업은 실행마다 Sentry Crons 모니터 `aido-job-worker`(코드 상수)에 check-in해 worker·pg-boss가 통째로 멈추면 Sentry가 알린다(production·DSN이 있을 때만). 모든 운영 경보는 key의 첫 경보를 늘 보내고 같은 key는 시간당 한 번, 다시 보내는 경보는 프로세스 전체에서 시간당 2건까지만 보내 Sentry 무료 플랜 오류 한도(월 5,000건)를 지킨다. 경보 태그에는 큐·작업 종류·시도 횟수·오류 클래스만 싣는다. HTTP 계약·DB 스키마·기존 큐 이름·잡 키·env는 그대로다.
- 26dcb4a: access·refresh 토큰 검증을 HS256만 받게 고정하고(`none`·HS512·RS256 거절) 새로 발급하는 토큰에 `iss`·`aud`를 싣는다. 배포 전에 받은 토큰이 계속 통하도록 `iss`·`aud` 검증은 아직 강제하지 않는다.
- 26dcb4a: 의도한 발송 시각보다 15분 넘게 늦은 리마인더(할 일 리마인더 작업과 시간대 리마인더 sweep의 분)는 보내지 않고 `late-over-15m` 사유와 건너뛴 분 수를 남긴다. 긴 장애 뒤 지난 알림이 한꺼번에 가지 않는다.
- 26dcb4a: 메모 목록 Swagger의 정렬 설명을 실제 순서(내림차순)로 고친다. 응답 순서는 그대로다.
- 26dcb4a: 여러 날에 걸친 할 일을 시작일만이 아니라 기간 안의 모든 날에 센다. 연속 기록, 일간 완료(`totalTodos`·`completedTodos`·`completionRate`·`totalCompleteDays`), 주간 성취가 같은 겹침 규칙을 쓰므로 여러 날 할 일이 있는 사용자의 숫자가 바뀔 수 있다(응답 모양은 그대로이고, `multiDayTodos`는 1.15.0 앱이 두 번 더하지 않게 늘 빈 배열이다).
- 26dcb4a: 서버 런타임을 Node 26.13.0 LTS(Docker 기본 이미지·`.nvmrc`)와 NestJS 12.4로 올리고 서버 날짜 계산을 내장 Temporal로 바꾼다. 모바일 EAS 빌드는 Node 24.22.2를 유지한다.
- c1122b0: 운영 경보를 slice `*.alerts.ts`의 `defineAlerts` 카탈로그(39개, key·심각도·한 줄 요약·첫 대응) 하나로 모으고, Sentry 이슈에 고정 태그 `alert_key`·`alert_context`·`severity`와 extra `runbook`을 싣는다(fingerprint는 key, 큐·스케줄처럼 원인을 나누면 `key:subject`). 새 경보는 계정 영구 삭제 일부 실패, 푸시 receipt 공급자 실패 비율 20% 이상(20건 이상), AI 인증 회로·모든 업체 회로 열림·비용 배경·전체 중단 기준선 분리, 늦어서 버린 리마인더 1시간 20건, 시간대 sweep 15분 상한 초과, refresh token 재사용(warning)이고, 런타임 포화 경보는 넘기 시작한 표본에서 한 번만 올린다. 운영(APP_ENV)에 DSN이 있을 때만 Sentry 경보·예외·작업 heartbeat 어댑터를 쓰고 그 밖의 환경은 경보·5xx를 콘솔 로그로 남기며 heartbeat는 no-op이다(경보 중복 제거는 모든 환경). 배포 환경 판정은 `appConfig` 한 곳이고 작업 모니터 slug는 env 없이 `aido-job-worker` 상수다. Sentry 11 기본 수집(요청·응답 본문, DB 바인딩 값, 스택 지역 변수, 쿠키·쿼리)을 모두 끄고, 요청에는 `request_id`·`app_version`·`app_platform`·경로 템플릿·`user.id`만, 작업에는 큐·작업 이름·id·시도를 태그로 싣는다. 표본은 경로·큐별 비율(`tracesSampler`, 상태 확인·폴링 0, 결제 웹훅·계정 삭제 1, 기본 0.1)이고 앱이 보낸 `sentry-trace`·`baggage`를 CORS에서 받는다. 코드로 분류한 5xx는 코드별 한 이슈로 모으고 같은 경로·코드 예외는 시간당 10건까지만 보낸다. 4xx 업무 거부는 웹훅·`@OnEvent`·작업 경로에서도 Sentry 오류로 보내지 않는다(운영의 `SUBSCRIPTION_1602` 오류 이슈). HTTP 계약·오류 코드·큐 이름·잡 키는 그대로다.
- e598830: 관리자 브로드캐스트 캠페인(`POST /v2/admin/notifications/broadcasts`)에 선택 필드 `localizedContent`(언어별 제목·본문, 없는 언어는 `title`·`body`)와 `delivery`(`NOW` 기본, `RECIPIENT_LOCAL_TIME`은 수신자 저장 시간대의 날짜·시각, 이미 지났으면 다음 날)를 더하고, 마케팅 분배·발송 작업은 우선순위 0 차선에 올린다. 성장 지표 응답에 `stickiness`(DAU/MAU %)를 더한다. 관리자 API 추가 필드라 출시 앱 계약은 그대로다. `BroadcastCampaign`에 `localizedContent`·`delivery` 컬럼(nullable jsonb)을 더하는 추가 마이그레이션이 있다.
- f6e9f13: 알림 권한을 허용한 기기가 토큰 발급에 한 번 실패해 `token: null`로 보고해도 이미 등록된 푸시 토큰을 지우지 않는다(출시된 1.13~1.15.0 앱도 서버만으로 고쳐진다). 권한·보고 시각과 토큰의 세션·앱 버전만 이번 보고로 옮기고, 거절·미요청 보고는 지금처럼 토큰을 지운다. 로그아웃 해제를 보내지 못하고 세션이 끝난 기기(갱신 토큰 만료, 오프라인 로그아웃)는 계정 푸시를 계속 받았는데, 로그인 없이 기기 ID와 그 기기의 토큰이 모두 맞을 때만 지우는 `POST /v1/notifications/push-devices/unregister`를 더했다. 맞는 등록이 없어도 같은 200 `{ unregistered: true }`를 주고 IP마다 분당 20번까지 받는다. 오래 쉰 사용자의 재방문 알림을 막지 않으려 발송을 세션으로 거르지는 않는다. 푸시마다 알림 종류로 정한 보관 시간(할 일 리마인더 1시간, 아침·저녁 요약과 날씨 2시간, 그날 알림 3시간, 소셜 12시간, 나머지 24시간)과 우선순위(high)를 실어 꺼져 있던 기기에 지난 리마인더가 쌓이지 않는다. Android 채널은 출시 앱의 `default` 그대로다. 사용자가 시각을 정한 할 일 리마인더와 프리미엄 아침·저녁 리마인더는 날씨 알림처럼 야간 수신을 꺼도 보내고, 광고성 야간 금지와 소셜·재방문 알림의 야간 설정은 그대로다. 푸시 열람 로그 키는 `notification.push.opened`이고 알림마다 처음 열 때 한 번 남는다. 기존 operation의 계약 fingerprint와 DB는 바뀌지 않는다.
- 26dcb4a: 푸시 발송 작업에 우선순위 차선을 둔다. 리마인더 같은 거래성 발송은 priority 10, 광고성 발송(참여 유도·광고성 알림·관리자 브로드캐스트)은 0으로 넣고 거래성만 받는 worker(`minPriority` 10)를 따로 둬 대량 마케팅 발송이 리마인더를 밀어내지 않는다.
- 26dcb4a: 푸시 receipt 확인 주기를 매분에서 5분으로 바꾼다. Expo 권장대로 수락 15분 지난 ticket만 조회하는 규칙은 그대로라 결과는 같고 빈 작업 행만 줄어든다.
- 26dcb4a: 푸시·리마인더 문구 언어를 앱과 같은 규칙(`resolveRecipientLocale`)으로 정해 저장된 언어가 `ko`·`en`이 아니면(예: `ja`) 영어로 보낸다. 언어를 보고하지 않은 사용자는 지금처럼 한국어다. 출시 앱은 기기 언어 대신 앱 언어(`ko`·`en`)를 보고하고, 요청 헤더의 지원하지 않는 언어는 저장할 때 지금처럼 `ko`로 둔다.
- 26dcb4a: 시간대 리마인더 sweep(`tz-reminder-sweep`)이 배포·재시작으로 놓친 분을 마지막으로 끝낸 분부터 최대 15분까지 그 분의 시각으로 차례로 처리한다. 진행 위치를 남기는 `ScheduledSweepCursor` 테이블을 더하는 추가 마이그레이션이 있다.
- 26dcb4a: 메일을 공식 `@nestjs/mail`(Resend 전송)로 보내고 `resend` SDK를 지운다. 같은 발송은 발송 id를 멱등 키로 한 번만 나가며, 새 전송은 Resend 태그를 보내지 않아 Resend 대시보드의 태그 필터가 비게 된다.
- 26dcb4a: 메모·할 일·하위 항목·카테고리를 같은 값으로 고치거나 친구를 같은 자리로 옮기면 저장과 이벤트를 건너뛰어 `updatedAt`이 그대로다. 순서 이동으로 밀린 메모는 지금처럼 `updatedAt`을 바꾼다.
- 1e354d3: 서버 15개 Context를 한 가지 구조로 정리한다. 기능(slice)마다 Nest Module 하나·Aggregate Root 하나를 두고, 쓰기는 Entity·값 객체, 포트는 abstract class DI 토큰(`provideUseCase` 조립, Symbol 토큰·barrel 재수출 제거), 업무 오류는 slice의 이름 있는 생성 함수, 큐는 `defineQueue` 한 곳, 날짜는 `ClockPort`와 Temporal(`dayjs` 제거), 설정은 namespace config로 읽는다. 이름·경계·순환·미사용 코드는 ls-lint·dependency-cruiser·관례 검사·knip이 `pnpm check`에서 막는다. `@aido/api`는 엔티티 ID 규칙을 `ENTITY_ID_PATTERN`(`^c[0-9a-z]{8,63}$`) 하나로 두어 `z.cuid()`를 대신하고(운영 ID 모양과 출시 앱 요청은 그대로 통과한다), 표준 커서 목록 `cursorPageSchema`로 할 일·친구 할 일·메모·주간 성취 목록을 만들며(JSON Schema 출력은 바이트 단위로 같다), 쓰지 않는 follow 계약 별칭과 `weeklyAchievementSchema` export를 지운다. 출시 앱 OpenAPI 지문은 ID pattern만 갱신했고 HTTP 응답 모양·오류 코드·큐 이름·잡 키는 그대로다.
- 26dcb4a: 댓글 커서와 광고 수신 거부 링크의 서명을 JWT 비밀값에서 떼어 `kid`가 붙은 키 묶음(선택 env `CURSOR_SIGNING_KEYS`·`OPT_OUT_TOKEN_SIGNING_KEYS`)으로 할 수 있게 한다. 값을 비우면 지금과 같은 형식으로 서명하고, 값을 넣어도 이미 보낸 링크와 커서는 계속 검증된다.
- 37cadf3: 할 일을 완료하자마자 보낸 감사 미리보기(`GET /v1/nudges/todos/{todoId}/thanks`)가 완료 저장보다 먼저 서버에 닿으면 409 `NUDGE_1110`을 받아, 출시된 1.14~1.15.0 앱이 완료에 성공하고도 "고마움 현황을 불러오지 못했어요" 카드를 남기던 문제를 고친다. 아직 완료하지 않은 할 일의 미리보기는 이제 친구 없이 0명인 빈 미리보기(200)이고, 앱은 아무것도 그리지 않다가 완료 저장 뒤 다시 받은 미리보기로 카드를 보인다(출시 앱도 서버만으로 고쳐진다). 감사 전송(`PUT`)은 그대로 완료 전이면 409 `NUDGE_1110`, 비공개면 409 `NUDGE_1109`다. 응답 모양과 출시 앱 계약 fingerprint는 그대로이고, 이 GET의 Swagger 문서에서 409만 빠졌다.
- 569cce6: 같은 분에 울려야 하는 할 일 리마인더를 서버 전체에서 15초마다 한 건씩(분당 4건) 꺼내 10분 전 알림이 몇 분씩 늦고, 같은 분에 60건쯤을 넘으면 늦음 한도(15분)에 걸려 조용히 버려지던 문제를 고친다. `todo-reminder.v1` worker가 20건씩 꺼내고 묶음이 차면 쉬지 않고 다음을 꺼내며(연결 하나, 작업마다 끝냄) 로컬 Testcontainers PostgreSQL에서 200건이 0.3초, 2,000건이 2.9~7.5초에 빠진다. 단계는 할 일 시각이 되면 15분 안이어도 보내지 않아 "10분 뒤 시작" 알림이 시작 뒤에 오지 않는다(사유 `todo-started`). 사용자가 시각을 정한 할 일 리마인더는 일반 시간당 한도(1시간 15회)로 막지도 세지도 않아 한 시간에 할 일이 8개여도 16번째 알림이 빠지지 않는다. 광고성·소셜 알림의 한도와 야간 예외는 그대로다. 큐 이름·작업 key·HTTP 계약은 바뀌지 않는다.
- 26dcb4a: 할 일 리마인더 예약·취소를 커밋 뒤 이벤트가 아니라 할 일 변경과 같은 트랜잭션에서 한다. 커밋 직후 프로세스가 멈춰도 예약을 잃지 않고, 대신 예약 인프라가 실패하면 요청이 실패하고 할 일 변경도 롤백된다.
- 26dcb4a: `@aido/api/vocabulary`에 앱·서버가 함께 쓰는 규칙을 모은다: 언어 규칙(`SUPPORTED_LOCALES`·`resolveSupportedLocale`, 값 없음 ko·지원하지 않는 언어 en), SemVer 비교, 공유 enum 튜플, 날씨 시간대 경계·마케팅 푸시 카테고리·매월 반복 말일 기준. 기존 export 경로(`@aido/api/common` 포함)와 계약 값은 그대로다.
- 26dcb4a: 날씨 v2(`GET /v2/weather`) 응답에 선택 필드 `briefing`(`reason`·`affectedTodoIds`·`rescheduleOptions`)을 더해 비·더위에 영향받는 오늘 남은 할 일과 옮길 시각 후보를 서버가 고른다. 할 일을 읽지 못하면 `briefing`만 빠지고 리포트는 그대로 응답한다.
- Updated dependencies [3a4ca7f]
- Updated dependencies [26dcb4a]
- Updated dependencies [26dcb4a]
- Updated dependencies [e598830]
- Updated dependencies [f6e9f13]
- Updated dependencies [1e354d3]
- Updated dependencies [26dcb4a]
- Updated dependencies [26dcb4a]
  - @aido/api@1.15.1

## 1.15.0

### Minor Changes

- 3d19ee9: 말·글을 할 일 계획으로 바꾸는 voice 컨텍스트를 더한다. `POST /v1/quick-plans`(AI 할 일 만들기 횟수)·`POST /v1/voice-notes/digest`(말로 메모하기 횟수)는 호출 전에 예약하고 실패·빈 결과면 정확히 한 번 환불하며(빠른 계획은 할 일 0개도 환불, 녹음 정리는 요약이나 핵심 내용을 돌려주면 할 일 0개여도 차감), 같은 `Idempotency-Key`는 한 번만 차감한다. `POST /v1/action-plans/apply`는 차감 없이 사용자가 확인한 행동만 손으로 만든 할 일과 같은 경로로 한 트랜잭션에 저장하고, 메모에서 만든 계획이면 원본 메모를 지운다. 서버는 녹음도 전사 글자도 저장하지 않고 사용량과 요청 해시·만든 id만 남긴다(`PlanApplication` 테이블, `QuotaCharge.requestHash` 열 추가, 7일 정리 작업). 새 오류 코드 AI_1312·1315·1316·1318. `QuotaLedger`는 같은 키의 다른 요청을 AI_1318로 거절하고, 달을 넘겨 이어받은 예약을 새 달 한도로 다시 잡는다. 녹음 정리 라우트 본문 256KB, 분당 4회·하루 30회 제한.
- f64ca65: AI 생성을 포트 하나(`AiGeneratorPort`)와 업체별 어댑터(Anthropic Claude·Google Gemini·OpenAI)로 바꾸고, 설정 순서(`AI_PROVIDER_ORDER`, 기본 Claude→Gemini→OpenAI)·사용자가 동의한 안내 버전·회로 상태로 업체를 골라 차례로 시도한다. Claude 크레딧 소진(402)·인증 실패는 결제 회로를 15분 열고 Sentry로 알리며, 연속 장애는 30초 건너뛴다. AI 데이터 처리 동의에 새 안내 버전 2026-11-04(글자만 세 업체로 전송, 녹음 파일은 서버로 보내지 않음)를 더하고 업체 표 `AI_DATA_SHARING_CONSENT_PROVIDERS`를 공유한다. 1.13·1.14 앱의 2026-10-26 동의는 다시 묻지 않고 Gemini만 쓴다. 환불한 AI 실패(AI_1301·AI_1302·AI_1310)는 공개 상세 `{ charged: false }`를 싣고 문구를 사용자 말로 고쳤다(코드·상태는 그대로). `ai-fallback`과 `AI_MODEL_<TASK>`·`AI_FALLBACK_MODEL` env를 지우고 업체별 키·모델·작업별 제한 시간·회로 env를 더한다.
- 17a4106: AI 리뷰에서 찾은 결함을 고친다. Gemini의 일반 429("check your plan and billing details")를 결제 소진으로 잘못 봐 모든 동의자가 15분간 막히던 분류를 고치고, Claude 400 크레딧 소진·OpenAI 200 거절(refusal)·본문 없는 출력 상한 응답을 맞는 종류로 나눈다. 회로가 잠깐 열린 경우(`CIRCUIT_OPEN`)는 리포트·제안 잡이 다시 시도하고, 시험 호출이 끝나기를 기다리지 않으며, 앞 업체가 시간을 쓴 뒤의 `TIMEOUT`과 호출자 취소는 장애로 세지 않고, 결제 실패는 SDK 재시도에서 뺀다. 체인 제한 시간은 그대로 두고 남은 시간을 업체 몫(OpenAI 2, 나머지 1)대로 나눠 앞 두 업체가 멈춰도 세 번째 업체까지 시도한다. 프로세스가 죽어 남은 RESERVED는 10분 주기 잡(`quota-abandoned-refund.v1`)이 멱등하게 돌려주고, 환불이 저장되지 않으면 `charged:false`를 주장하지 않으며, 확정 뒤 한도 읽기 실패는 결과를 살리고 `featureQuota`만 뺀다. `/health`의 `outbound`는 `degraded`만 공개하고, ADMIN은 사용자 일 AI 예산에서 빠지며, 계정 영구 삭제 때 `OutboundUsage`의 사용자 행을 함께 지운다. 배열·객체 칸을 JSON 문자열로 보낸 LLM 응답을 풀어서 받고, 고유명사 교정·달 이름 월말·이어 하는 일 규칙을 고쳐 프롬프트 버전을 올린다(`parse-todo@5`·`parse-memo@5`·`quick-plan@4`·`voice-note-digest@4`). 계획 프롬프트의 모델 출력은 객체 유니온 대신 `todos`·`memo`로 나눈다. HTTP 계약과 오류 코드는 그대로다.
- 6c9c374: 이메일을 벤더 중립 `EmailSenderPort`(결과 유니온, 던지지 않음)와 어댑터(Resend·로그)로 나누고 `EMAIL_PROVIDER`로 고른다. 발송은 요청 안 재시도를 없애고 `email-delivery.v1` 큐(pg-boss 재시도 4회, 렌더된 메시지는 암호화해 저장)로 비동기 처리한다. 무료 한도를 넘지 않도록 하루 100통·한 달 3,000통 예산을 두고 일반 메일(문의·신고)은 하루 70통에서 멈춰 인증·비밀번호 코드 몫을 남기며, 한도에 가까워지면 운영 경보를 올린다. 문의는 DB에 남지 않아 요청 안에서 한 번만 보내고 실패하면 지금처럼 INQUIRY_1501로 알려 다시 보내게 한다(인증·신고 메일만 큐). 관리자 알림은 벤더 중립 `AdminNotifierPort`(등급·필드·링크)로 바꾸고 Discord 표시는 어댑터가 맡으며 `ADMIN_NOTIFIER_PROVIDER`로 고른다. 구독 웹훅 실패는 Discord로 원문을 직접 보내지 않고 Sentry 예외와 운영 경보로만 올린다. HTTP 계약과 오류 코드는 그대로다.
- b1189a4: 외부 호출 보호를 공용 `OutboundPolicy`(회로·bulkhead·시도별 timeout)로 모으고 AI 비용 장치를 더한다. AI 생성은 입력 상한·킬 스위치(`AI_GENERATION_MODE`)·전역·사용자 비용 예산(`AI_BUDGET_*`, `OutboundUsage` 테이블)을 업체 호출 전에 확인하고, 작업 분류별 동시 호출·요청당 모델 호출 상한·앞 업체 시도별 제한 시간·동시 같은 요청 합치기를 둔다. 예산·킬 스위치로 멈추면 AI_1301·AI_1310에 `{ charged: false }`로 응답한다. 제안 잡은 일시 장애만 다시 시도한다. WeatherKit의 직접 만든 장애 차단을 공용 회로로 바꾸고 월 호출을 계량하며, 기상청·에어코리아·KASI에 회로를 달고 단건 예보를 합치며, Expo 호출에 30초 제한을 둔다. 운영 경보는 `OperationalAlertPort` 하나로 합친다. 모든 LLM 출력 schema를 업체 공통 규칙(전 칸 required, 없으면 null)으로 바꾸고 OpenAI strict·Gemini structuredOutputs·Claude JSON 도구를 켜며, Claude 캐시 기준을 512토큰으로 낮추고 캐시 토큰·단가를 비용에 반영한다. HTTP 계약과 오류 코드는 그대로다.
- 22c7b54: 플랜·한도 숫자를 `PLAN_CATALOG` 한 곳으로 모으고(출시 앱용 `PREMIUM_FEATURES`는 그 부분집합), 무료 AI 정리를 월 10회로 늘리며 프리미엄에는 공정 사용 상한(월 1,000회)을 둔다. 무료·프리미엄 판단은 서버 `hasPaidAccess` 하나로 tier·`isPremium`·SQL 조건이 함께 따른다.
- 1784102: AI 프롬프트를 작업마다 `PromptDefinition`(id·버전·Zod 출력 schema·build·normalize) 하나로 정리하고, 캐시 친화 순서(고정 system → 동적 context → 맨 끝 사용자 입력)와 공용 보안 규칙·언어 정책(할 일 제목은 말한 언어, 요약은 앱 언어)을 kit으로 묶는다. v1 프롬프트 폴더와 `AI_PROMPT_VERSION_*` 전환 env를 지우고 버전 이름을 `parse-todo@3`처럼 바꾼다(출시 응답의 선택 `meta.promptVersion` 값만 달라진다). 빠른 계획·녹음 정리 프롬프트와 격주·매월 반복 표현을 미리 정의하고 `ACTION_PLAN_LIMITS`를 `@aido/api/vocabulary`에 더하며, 쓰지 않던 `llmParsedResultSchema`·`llmParsedMemoResultSchema`를 지운다. golden(ko·en·혼합)과 `pnpm ai:eval --task --provider` 수동 평가를 더한다.
- d26b3d0: AI처럼 돈이 드는 사용 횟수를 Access의 `QuotaLedger` 원장 하나로 센다. AI 호출 전에 원자적으로 예약하고 실패·빈 결과면 정확히 한 번 환불하며, 같은 `Idempotency-Key`는 두 번 차감하지 않는다(`QuotaCharge`·`QuotaUsage` 테이블 추가). 서버가 계산한 `featureQuota`·`entitlementSnapshot` 계약과 `GET /v1/entitlements`를 더하고, parse-todo·parse-memo 성공 응답에 선택 `featureQuota`를, 한도 오류(AI_1303·새 AI_1313 녹음 정리 한도·새 AI_1314 처리 중 충돌)에 공개 상세 `{ charged: false, featureQuota }`를 싣는다. 응원·콕 찌르기 일간 한도(CHEER_1201·NUDGE_1101)와 카테고리 한도(TODO_CATEGORY_0857)도 같은 공개 상세를 싣고, 친구 한도(FOLLOW_0909)는 기존 `current`·`limit`에 `charged`·`featureQuota`를 더한 `friendQuotaErrorDetailsSchema`로 내보낸다. 출시 앱의 `/v1/ai/usage`·`/me`·AI_1303 동작은 그대로다.
- 8142c45: 1.15.0 서버 리뷰 수정. 리마인더 재예약이 실제로 등록되도록 작업을 지우고 다시 넣으며 회차 알림을 행과 함께 커밋한다. 할 일 PATCH를 한 트랜잭션(`EditTodo`)으로 묶고, 유효한 유료 사용자의 반복 알림은 멈추지 않으며 무료 사용자에겐 멈출 때 한 번 안내한다. 분할된 규칙을 `TodoSeries.originSeriesId`로 묶어 전체 삭제가 앞 구간까지 지우고 `TodoSeries.sortOrder`를 지운다. 새 반복의 지난 회차는 366개까지다(넘으면 `TODO_0845`, `field: "startDate"`). 결과를 잃은 같은 `Idempotency-Key`는 추가 차감 없이 다시 만들어 200으로 답한다. 앱이 연결을 끊으면 AI 호출을 멈추고 환불한다.
- 049ca21: 할 일 생성 포트를 커밋 후 실행 `StagedTodoCreatorPort.stage` 하나로 통일한다. 메모 전환과 AI 제안 수락이 같은 경로를 쓰므로 롤백되면 알림·캐시 효과가 남지 않는다. `TodoSchedule`이 종일과 시간을 맞춘다(시간이 있으면 시간 일정, 없으면 종일). 출시 앱이 종일과 시간을 함께 보내도 서버가 맞춰 저장한다. 반복 할 일 오류 코드 `TODO_0841`~`TODO_0846`과 공개 상세, 시스템 상한 `TODO_SERIES_LIMITS`를 더하고, 반복에 맞는 날짜가 없으면 `SYS_0002` 대신 `TODO_0843`을 돌려준다.
- ce63b19: `POST /v1/todos`가 선택 필드 `repeat`로 반복 할 일을 만든다. 규칙을 저장하고 앞으로 90일 치 회차를 실제 행으로 만들며, 응답 `todo`는 첫 회차, 새 선택 필드 `series`는 규칙이다(`todoSeriesResponseSchema`). 진행 중 반복은 등급과 상관없이 30개까지(`TODO_0842`), 카테고리 한도는 진행 중 규칙 1개당 1로 센다. `POST /v1/todos/recurring`은 지원 마지막 앱 1.14.x의 호환 경로로 남아 같은 경로를 쓰고, 이전에 `TODO_0812`로 거절하던 긴 범위도 성공한다. 메모 변환 요청에 선택 `repeat`, AI 파싱 응답에 선택 `repeat`를 더하고 출시 앱용 `recurrence`는 그대로 둔다. 회차 리마인더는 커밋 뒤 일괄 등록한다. 추가한 필드는 모두 optional이며 생략 시 동작은 같고, 출시 앱 지문은 `preTodoRepeatSchemasFingerprint`에 이전 값과 사유를 남겼다.
- 4c33c2c: 반복 할 일의 범위 수정·삭제와 반복 끝내기를 더한다. `PATCH /v1/todos/:id`에 선택 `scope`(`THIS_ONLY`·`THIS_AND_FOLLOWING`), `repeat`(생략은 변경 없음, null은 이 회차 뒤로 끝내기, 값은 단일 할 일 전환 또는 규칙 변경), `checklist`, `DELETE /v1/todos/:id`에 선택 `scope`(`THIS_ONLY`·`THIS_AND_FOLLOWING`·`ALL`), 새 `GET /v1/todo-series/:seriesId`를 연다. 규칙을 바꾸면 이 회차부터 나누되 맞는 회차의 id·댓글을 유지하고, 완료한 회차의 내용은 바꾸지 않으며(`ALL` 삭제만 지움), 첫 회차에서 고치면 나누지 않는다. 체크리스트만 바꾸면 나누지 않고 앞으로 만들 회차에 쓰는 규칙의 체크리스트만 바꾼다(`THIS_AND_FOLLOWING`에서만 받는다). 시간을 바꾸면 회차 날짜마다 규칙 시간대로 다시 계산해 리마인더를 재등록한다. 모든 필드는 optional이고 생략하면 동작이 같다. 출시 앱 지문은 `preTodoSeriesScope…Fingerprint`에 이전 값과 사유를 남겼다.
- 2c6ec82: 매일 03:10 KST pg-boss 작업 `todo-series-materialization.v1`이 진행 중 반복 할 일의 회차를 앞으로 90일까지 채운다. 규칙당 트랜잭션(`FOR UPDATE SKIP LOCKED` → 정렬 잠금 → INSERT 한 번 → 커서 갱신)이고, 재실행·동시 실행은 `(seriesId, occurrenceDate)` 유니크로 멱등이다. 부팅 때 놓친 실행을 실행일 키로 따라잡고, 정지·탈퇴 대기 계정과 60일 넘게 쓰지 않은 무료 계정은 건너뛰며(돌아오면 오늘부터 이어 만든다, `docs/server/todo-series-dormancy.md`), 실패하거나 4분 상한을 넘으면 운영 경보를 올린다.
- d1507da: 반복 할 일의 기반을 더한다. `TodoSeries` 테이블과 `Todo.occurrenceDate`, `(recurrenceGroupId, occurrenceDate)` 부분 유니크 인덱스를 만들고 기존 묶음을 끝난 규칙으로 이관한다(같은 날짜 중복은 최소 id만 남기고 묶음 해제). 서버 코드 이름은 `seriesId`이고 DB 열과 응답 필드 `recurrenceGroupId`는 출시 앱·1.14.2 롤백 호환을 위해 그대로 둔다. 공유 계약에 `todoRepeatSchema`·`TodoRepeat`와 `TODO_REPEAT_FREQUENCIES`·`TODO_REPEAT_INTERVALS`·`TODO_REPEAT_END_TYPES`·`TODO_EDIT_SCOPES`를 더한다.
- 11882e8: 서비스·거래 알림을 광고성 동의와 분리한다. 온보딩 D0~D7 사용법 안내는 서비스 알림으로 바꿔 광고성 동의 없이 보내고, 광고성 푸시는 제목 앞 "(광고)"와 본문 끝 수신 거부 방법을 한 곳에서 붙인다. 광고성 수신 동의 2년 재확인 알림을 매월 보내고 `UserConsent.marketingReconfirmedAt`에 남긴다. 광고성 동의 변경 응답에 철회를 처리한 서버 시각(`marketingWithdrawnAt`·`marketingPushWithdrawnAt`)을 더했다. 이메일·소셜 가입이 동의한 약관 버전(`agreedTermsVersion`, 지금까지 늘 null)을 `TERMS_VERSION.CURRENT`로 남긴다. 소셜 가입은 지금처럼 가입 때 약관·개인정보 동의를 기록한다. `pushEnabled`·`nightPushEnabled`의 DB·어휘 기본값을 가입 seed와 같은 true로 맞췄다(기존 행은 그대로).
- a4fc198: 할 일 시간을 떠 있는 시각으로 바꾼다. `Todo.scheduledLocalTime`(HH:mm)이 진실이고 `scheduledTime`은 날짜 + 벽시계 + 사용자 시간대로 만든 파생값이다. 응답에 선택 칸 `scheduledLocalTime`을 더하고, 저장 시간대가 바뀌면 `todo-timezone-rebase.v1` 작업이 시간 있는 모든 할 일의 순간을 다시 계산하고 완료 전이고 앞으로 울릴 회차의 알림을 다시 잡는다. 이미 지난 알림 단계는 바로 보내지 않고 건너뛴다. 출시 앱의 옛 경로(`POST /v1/todos/recurring`, 메모 변환의 `isRecurring`, AI 제안 수락)에는 진행 중 반복 300개 상한을 두고 `TODO_0813`으로 거절한다.
- 19708b7: 일일 완료 조회 응답(`GET /v1/daily-completions`, 친구 조회 포함)에 선택 칸 `multiDayTodos`(시작일·끝 날짜·완료 여부·카테고리 색)를 더한다. `completions`는 출시 앱이 읽던 대로 시작일에만 세고, 새 앱이 달력에서 기간 안의 날에도 점을 그린다.
- 0750b0b: 메모 나누기(`parse-memo`)도 빠른 계획·녹음 정리처럼 다가오는 할 일을 맥락으로 받아 겹침을 판정한다. 응답 할 일에 선택 칸 `duplicateOfTodoId`를 더하고, 모델이 못 고른 겹침은 같은 정책(`findDuplicateTodoId`)이 제목과 날짜로 다시 찾는다. 출시 앱은 새 칸을 버리므로 동작이 같다.
- c93dcec: 메모 나누기(`POST /v1/ai/parse-memo`)에 선택 `Idempotency-Key` 헤더를 더해 재시도가 두 번 차감되지 않게 한다. 헤더가 없는 출시 앱은 지금처럼 요청마다 차감한다. 공통 헤더 이름 `IDEMPOTENCY_KEY_HEADER`를 vocabulary에 더한다.
- 5c5da5b: 1.15.0 호환 검증에서 나온 반복 할 일 결함을 고친다. 이후 모두로 시간을 고치면 요청 시간대로 해석하고 규칙 시간대도 바꾼다. 나뉜 반복의 앞 구간에서 이후 모두가 뒤 구간까지 닿는다. 이관은 묶음 전체에서 규칙을 유추한다. 규칙 없는 묶음의 전체 삭제가 동작하고, 출시 앱의 `POST /v1/todos/recurring`에는 진행 중 반복 상한을 적용하지 않는다.
- d6ea3c6: 구독 웹훅을 신호로 보고 스토어 상태를 다시 읽어 맞춘다. 처리 원장에 새로 기록된 웹훅마다 `store-subscription-reconcile.v1` 잡(1분 구간마다 사용자당 하나)을 같은 트랜잭션에 넣고, RevenueCat REST v2 구독 검색으로 체인 행의 만료·자동 갱신·체험·상품을 맞추며, 스토어가 접근을 주지 않는 행(놓친 환불·만료, Play 요금제 교체로 남은 옛 체인)은 끝낸다. 바뀐 것이 있을 때만 프리미엄을 다시 계산하고 캐시를 비운다. 새 선택 env `REVENUECAT_API_V2_SECRET_KEY`(읽기 전용 v2 키)와 `REVENUECAT_PROJECT_ID`가 있어야 켜진다.
- 68cc868: `/me`에 선택 칸 `premiumPlanType`(`ANNUAL`·`MONTHLY`, 모르면 null)을 더한다. 지금 프리미엄 기간을 정하는 스토어 구독의 상품 ID로 정하고 Play의 `상품:기본요금제`는 `:` 앞만 본다. 체험 종료 3일 전 알림의 자동 갱신 문구가 "연간 구독"을 하드코딩하지 않고 요금제로 고르며, 모르는 상품이면 "구독"이라고 쓴다. 어휘 `SUBSCRIPTION_PLAN_TYPES`·`STORE_SUBSCRIPTION_PRODUCTS`·`PREMIUM_RENEWAL_NOTICE_DAYS`를 더했다.
- c123a4c: 연간으로 자동 갱신될 구독에 결제 7일 전 기간마다 한 번 알린다(서버 전용 `PREMIUM_RENEWAL_UPCOMING`, 앱에는 `SYSTEM_NOTICE`와 구독 화면 경로). 월간·모르는 상품은 보내지 않고, Play에서 요금제를 바꿔 남은 옛 체인에도 보내지 않는다. `Subscription.renewalNoticeExpiresAt`에 알린 기간의 만료를 남겨 갱신으로 기간이 바뀌면 다음 기간에 다시 보낸다. RevenueCat `PRODUCT_CHANGE`는 정보성이라 상품·만료·상태를 바꾸지 않고 웹훅 `new_product_id`를 `Subscription.nextProductId`로 예약만 하며, `RENEWAL`·`INITIAL_PURCHASE`가 이벤트 상품을 지금 상품으로 맞춘다(지난 기간 `PRODUCT_CHANGE`가 만료를 앞당겨 쌓아 둔 보상을 시작하던 문제를 고친다). `premium-grant-sweep`의 안내 단계는 한 단계가 실패해도 나머지를 보낸 뒤 잡을 실패로 끝낸다.
- 113cf8a: 스토어 무료 체험을 저장하고 끝나기 3일 전에 한 번 알린다. RevenueCat 웹훅의 `period_type`을 `Subscription.periodType`에 남기고(`INITIAL_PURCHASE`·`RENEWAL`, 전환 갱신은 `NORMAL`), 체험 단계(시작·해지·전환·종료)는 billing 정책 하나가 판단한다. 계약은 추가만 했다: 웹훅 `is_trial_conversion`·`expiration_reason`, `/me`의 `premiumIsTrial`, 어휘 `STORE_PERIOD_TYPES`·`PREMIUM_TRIAL_ENDING_NOTICE_DAYS`. 체험 끝은 스토어 `expiration_at_ms` 그대로이고 체험 중 받은 초대 보상은 체험 뒤에 이어진다. 안내 알림 `PREMIUM_TRIAL_ENDING`은 서버 전용 타입이라 앱에는 `SYSTEM_NOTICE`와 구독 화면 경로로 보내며 기존 `premium-grant-sweep` 잡에 붙였다. 보상 종료 알림 `PREMIUM_GRANT_ENDING`은 거래 알림으로 바꿔 광고성 동의 없이 보낸다. 관리자 결제 알림은 체험 시작을 ₩0 구매 대신 "무료 체험 시작"과 체험 끝 날짜로 보여 준다. 전환 뒤 늦게 온 체험 해지와 지난 기간의 늦은 갱신은 상태를 되돌리지 않는다.
- 702e303: 출시 전 응답인 `POST /v1/quick-plans`, `POST /v1/voice-notes/digest`에서 `meta`(모델·토큰·프롬프트 버전)를 뺀다. 값은 서버 로그에만 남긴다. `parse-todo`, `parse-memo`의 응답은 그대로다.

### Patch Changes

- 93c40f8: AI 일정 해석이 지난 날짜를 만들지 않는다. 지난 요일은 다음 그 요일로, 이번 달 초·올해 초는 시기가 지났으면 다음 시기로 넘긴다.
- ac4c9d2: AI가 말하지 않은 반복 끝을 만들지 않게 한다. 시작일보다 뒤가 아닌 `until`·`forDuration`은 버리고, "30분 운동"의 걸리는 시간은 제목에 남기며 반복 기간으로 쓰지 않는다. 끝 없는 주말 반복은 "주말마다"·"매주 주말"·"weekends"일 때만이고, 계획에서 그냥 "주말에"·"이번 주말"·"다음 주말"은 그 주말 토요일 한 번이다. 녹음 정리의 제목·요약·핵심 포인트는 말한 언어와 상관없이 앱 언어로 쓴다. 프롬프트 버전은 `parse-todo@6`, `parse-memo@6`, `quick-plan@6`, `voice-note-digest@6`다.
- 0dc7ea7: 결제 문제(BILLING_ISSUE) 푸시 잡을 커밋 뒤가 아니라 구독 변경·처리 원장과 같은 트랜잭션에 기록한다. 커밋과 등록 사이에 프로세스가 멈춰도 알림을 잃지 않는다.
- ac1462c: 구독 웹훅의 실패 응답을 나눈다. 처리 대상이 없는 영구 실패(사용자·체인·필수 시각 없음)와 계약과 다른 원문만 200과 운영 경보로 닫고, DB 같은 일시 실패는 5xx로 응답해 RevenueCat 재전송에 맡긴다(처리 원장이 같은 트랜잭션이라 한 번만 반영된다). 영구 실패여도 사용자가 확인되면 스토어 상태 대조를 예약한다.
- 89fd262: 새로 가입할 때 기본 카테고리 이름을 요청의 `Accept-Language`로 정한다. `en`이면 `Important`·`To-do`, 없거나 그 밖이면 지금처럼 `중요한 일`·`할 일`이다. 사용자가 고칠 수 있는 데이터라 이미 있는 카테고리는 바꾸지 않는다.
- 9ab0246: 웹 흐름 소셜 가입의 관리자 알림을 앱 요청인 `POST /v1/auth/exchange`에서 보내 앱 버전·기기·시간대가 비지 않게 한다. 응답과 출시 앱 동작은 그대로다.
- c6d0d47: 빠른 말하기 AI 체인 제한 시간 기본값을 15초에서 24초로 늘린다. 실측 지연의 최댓값이 앞 업체 몫 3.75초를 넘어 정상 응답이 시간 초과와 폴백으로 처리되던 것을 줄인다.
- ed4713b: 완료한 할 일에 하위 항목을 추가하면 남은 일이 생긴 것이므로 할 일을 미완료로 되돌린다. 응답 모양은 그대로이고 `completed`만 `false`로 온다.
- b5283b4: `/me`의 `premiumPlanType`·`premiumIsTrial`·`premiumPeriodEndsAt`·`willRenew`를 현재 체인(유효한 스토어 체인 중 가장 늦게 시작한 체인)으로 정한다. Play에서 요금제를 바꿔 옛 체인이 원래 만료까지 남아 있어도 새 체인의 요금제·만료·갱신을 보인다. 프리미엄 끝(`premiumEndsAt`)과 쌓아 둔 보상의 시작은 지금처럼 유효한 모든 체인의 끝까지 본다. 연간 갱신 안내도 같은 규칙으로 현재 체인에만 보낸다.
- a0bc1fd: 할 일 알림 중복 방지를 "할 일 + 단계"에서 "할 일 + 단계 + 회차(날짜 + 벽시계)"로 바꾼다. 울린 할 일을 다른 날짜나 시각으로 옮기면 새 회차로 다시 울리고, 시간대를 왕복해도 같은 회차의 같은 단계는 한 번만 울린다. 응답·푸시 모양은 그대로다.
- Updated dependencies [3d19ee9]
- Updated dependencies [f64ca65]
- Updated dependencies [22c7b54]
- Updated dependencies [1784102]
- Updated dependencies [d26b3d0]
- Updated dependencies [8142c45]
- Updated dependencies [049ca21]
- Updated dependencies [ce63b19]
- Updated dependencies [4c33c2c]
- Updated dependencies [d1507da]
- Updated dependencies [11882e8]
- Updated dependencies [a4fc198]
- Updated dependencies [19708b7]
- Updated dependencies [0750b0b]
- Updated dependencies [c93dcec]
- Updated dependencies [5c5da5b]
- Updated dependencies [68cc868]
- Updated dependencies [c123a4c]
- Updated dependencies [113cf8a]
- Updated dependencies [702e303]
  - @aido/api@1.15.0

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
