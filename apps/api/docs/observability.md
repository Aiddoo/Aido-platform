# 관측 (로그·경보·지연·포화도)

로그 이벤트·경보·예외 보고·성능 신호·Sentry 설정을 더하거나 바꿀 때 읽는다. 실행 연결은 `src/platform/logging`(nestjs-pino)과 `src/platform/observability`다. 새 Logger wrapper나 자체 마스킹을 만들지 않는다.

## 소유

- Domain은 로그를 남기지 않는다.
- Application은 `ApplicationLoggerPort`를 `Pick`으로 받는다(조립은 `loggerFor(UseCase)`). 이벤트 상수는 slice의 `<slice>.log-events.ts`, platform 이벤트는 [platform.log-events.ts](../src/platform/logging/platform.log-events.ts), 경보 정의는 `<slice>.alerts.ts`([경보 카탈로그](alerts.md))다.
- Infrastructure는 공급자 결과·재시도·작업 실패를, HTTP middleware·filter는 요청·HTTP 오류를 남긴다. Controller·UseCase·Repository에 같은 시작/종료 로그를 반복하지 않는다.
- 같은 오류를 여러 층에서 다시 남기지 않는다. 4xx 업무 오류는 `errorCode`만 info·warn, 5xx만 error + 예외 보고다.

## 이벤트 키와 필드 (서버·앱 공통)

- 형식은 `<context>.<subject>[.<detail>].<outcome>`다. 소문자, 단어는 하이픈, 마디는 점이다(`identity.oauth.token-exchange.failed`, 앱 `todo-comment.submit.failed`).
- 첫 마디는 Bounded Context, platform은 기술 영역(`http`·`redis`·`cache`·`jobs`·`database`·`events`)이다. 마지막은 결과(`failed`·`completed`·`skipped` …)다.
- Sentry `feature` 태그는 첫 마디의 하이픈을 밑줄로 바꾼 값이다(앱 [observability](../../mobile/docs/observability.md)와 같은 축).
- `errorType`은 분류 또는 예외 클래스 이름(`toErrorType`), `errorCode`는 공유 `ErrorCode` 값만이다. 공급자 기호는 `providerError`, 공급자 HTTP 상태는 `statusCode`, Node 네트워크 code는 `networkCode`다.
- 메시지 자리에 template literal·문자열 연결을 쓰지 않는다. `logger.warn({ event, ...fields })` 한 객체로 남긴다.
- 기존 snake_case 키(`weather.*`·`ai.job.*`·`social.*`·`notification.*` 일부)는 저장된 조회 호환으로 유지한다. 새 키만 이 형식이다.

레벨: log는 필요한 성공 이벤트, warn은 격리된 실패·처리 가능한 거부, error는 최종 실패, debug는 진단이다.

## 남기면 안 되는 값

이메일, 토큰, 인증 code, OAuth state, authorization header, 공급자 사용자 ID, user tag, 할 일 제목, 말한 내용·전사, AI 입력/출력, 이메일 본문, 전체 webhook payload, 공급자 오류 본문, env 값, 서명 키(`*_SIGNING_KEYS`)의 값.

- 공급자 실패는 공급자 이름·HTTP 상태·짧은 오류 코드만 남긴다. 외부 `error.message`·stack을 logger에 그대로 넘기지 않는다.
- 로그 정리와 호출자의 오류 계약은 별개다. 로그를 가리려고 sender result·queue throw·재시도 여부를 바꾸지 않는다.
- Sentry SDK 11은 기본으로 요청·응답 본문, DB 바인딩 값, 스택 지역 변수, 쿠키·쿼리를 모은다. [sentry-options](../src/platform/config/utils/sentry-options.ts)의 `SENTRY_DATA_COLLECTION`이 모두 끄고(헤더는 `user-agent`·`x-app-version`·`x-device-type`만), `scrubErrorEvent`가 보내기 직전 인증 헤더·IP·본문·이메일을 한 번 더 지운다. 예외 메시지(`cause`로 이은 linked exception 포함)·메시지 이벤트·breadcrumb 글의 `DrizzleQueryError` 바인딩 값(`params:` 뒤)과 이메일 모양도 `[FILTERED]`로 바꾼다(끝 칸이 숫자인 패키지 버전 `x@5.1.0`은 남긴다). AI span 입출력도 끈다([보안](security.md#ai)).

## HTTP 로그와 요청 ID

- [logger.options.ts](../src/platform/logging/logger.options.ts)는 nestjs-pino `pinoHttp` 옵션이다. query를 뺀 path·method·status·event와 요청 ID를 남기고 req/res 원문 serializer를 끈다. 4xx/5xx 자동 로그는 filter와 중복하지 않게 silent다.
- 요청 ID(`reqId`)는 [assignRequestId](../src/platform/http/request-client/request-id.ts)가 정한다. 같은 값이 `RequestClient.requestId`와 Sentry `request_id` 태그라 앱 breadcrumb·서버 로그·Sentry 이벤트를 한 ID로 찾는다.
- 레벨 우선순위는 module 옵션 → `LOG_LEVEL` → 환경 기본값(test silent, production info, 그 밖 debug)이다. `pino-pretty`는 개발에서만 쓰는 devDependency다.

## 경보와 예외 보고

| 상황            | 포트                                                                                | 정의                                 |
| --------------- | ----------------------------------------------------------------------------------- | ------------------------------------ |
| 사람이 볼 상황  | `OperationalAlertPort.raise({ ...Alerts.X, tags, details, cause })`(throw하지 않음) | slice `*.alerts.ts`의 `defineAlerts` |
| 5xx·미분류 예외 | `ExceptionReporterPort`(`GlobalExceptionFilter`가 호출)                             | 4xx는 보내지 않는다                  |

- Sentry import는 `platform/observability/sentry-*`, `instrument.ts`, `platform/config/utils/sentry-options.ts`, `app.module`의 `SentryModule.forRoot()`(SDK 설정 모듈)에만 둔다. 업무 코드는 포트만 부른다.
- 경보 Sentry 이벤트: fingerprint = key(원인을 나누는 `subject`가 있으면 `key:subject`), 제목 = summary, 부제(transaction) = key, 고정 태그 `alert_key`·`alert_context`·`severity`(·`alert_subject`), extra `runbook`. 호출부 태그는 고정 태그를 덮지 못한다.
- 5xx: 코드로 분류해 던진 실패(`SYS_0005`·`AI_1301`·`WEATHER_1901`·502 계열)는 `http-5xx.<코드>` 한 이슈로, 분류되지 않은 `SYS_0001`은 스택으로 모은다. 같은 경로·코드·예외는 한 시간에 10건(`EXCEPTION_REPORT_THRESHOLD`·`EXCEPTION_REPORT_WINDOW_MS`)까지만 보낸다.
- 업무 거부(계약에서 4xx로 정한 `ApplicationException`·`DomainException`)는 HTTP·웹훅·`@OnEvent`·작업 어느 경로에서도 Sentry 오류가 아니다(`isBusinessRejection`). 경보의 원인이면 예외 대신 경보 문장과 `errorCode` extra로, @sentry/nestjs가 handler에서 자동 수집한 것은 `beforeSendError`가 버린다. 사람이 봐야 하면 이름 있는 경보를 올린다.
- `ignoreErrors`는 쓰지 않는다. 걸러낼 알려진 소음이 아직 없고, 4xx는 필터가 애초에 보내지 않는다. 소음이 생기면 이유 한 줄과 함께 `sentry-options`에 더한다.

### 환경별 어댑터

선택은 [AlertingModule](../src/platform/observability/alerting.module.ts)의 표 한 곳이고, 판정은 `selectObservabilityBackend`(= `instrument.ts`의 SDK `enabled`)다. 환경은 `appConfig.environment`([배포 환경](configuration.md#배포-환경))다. 개발에서도 경보·예외가 어디엔가 보여야 하므로 SDK만 꺼진 Sentry 어댑터를 두지 않고 로그 어댑터를 쓴다.

| 환경                                          | 경보                                                          | 5xx 예외                                              | SDK  | 작업 heartbeat |
| --------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------- | ---- | -------------- |
| production + `SENTRY_DSN`                     | `SentryOperationalAlertAdapter`                               | `SentryExceptionReporter`                             | 켜짐 | Sentry         |
| production(DSN 없음)·staging·development·test | `LogOperationalAlertAdapter`(key·태그·스택을 warn·error 로그) | `LogExceptionReporterAdapter`(태그·스택을 error 로그) | 꺼짐 | no-op          |

경보 중복 제거 감싸기는 고른 어댑터 바깥에서 모든 환경에 같게 돈다. heartbeat 포트도 같은 표에 열을 더해 고른다.

## 요청·작업 문맥

| 대상 | Sentry 태그·사용자                                                                                             | 넣는 곳                                                       |
| ---- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 요청 | `request_id`·`app_version`·`app_platform`(RequestClient), `http.method`·`http.route`(경로 템플릿), `user.id`만 | CLS middleware → `tagRequestScope`, `RequestScopeInterceptor` |
| 작업 | `job.queue`·`job.name`·`job.id`·`job.attempt`, `queue.process` span(묶음 크기)                                 | `withJobScope`(pg-boss 어댑터 두 곳)                          |

- 실제 URL·쿼리·기기 이름·시간대·payload는 싣지 않는다. `app_platform`은 이벤트의 `platform`(node)과 헷갈리지 않게 접두사를 붙였다.
- 앱 Sentry가 보낸 `sentry-trace`·`baggage`는 SDK가 받아 서버 span을 이어 붙인다. 웹 출처를 위해 CORS 허용 헤더에도 넣었다. 앱 쪽 후속(한 줄): `Sentry.init`에 `tracesSampleRate: 0.05, tracePropagationTargets: [/^https:\/\/api\.aido\.kr\//]`. 서버는 앱이 정한 표본 결정을 따른다(비율 0 경로 제외).

## 중요 흐름과 경보

key·심각도·첫 대응 전체는 [경보 카탈로그](alerts.md)다. 아래는 1인 운영자가 손을 대야 하는 흐름과 조건이다.

| 흐름                 | 경보 key                                                         | 조건(상수는 재는 코드 옆)                                                                                                                                                                                                                                                                                   |
| -------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 계정 삭제(법적 기한) | `identity.account-purge.failed`                                  | 03시 배치에서 사용자 1명 이상 삭제 실패. 배치 전체 실패는 작업 실패 경보                                                                                                                                                                                                                                    |
| 결제·권한            | `billing.subscription.*`, `social.invite-reward.retry-exhausted` | 웹훅 영구 실패·원문 불일치, 대조 재시도 소진, 초대 보상 재시도 소진. 웹훅 일시 실패는 5xx 예외                                                                                                                                                                                                              |
| 푸시 발송            | `notification.push.receipt-failure-ratio-high`                   | 한 receipt 확인 실행(5분)에서 받은 receipt ≥ 20건(`PUSH_RECEIPT_FAILURE_MIN_RECEIPTS`) 중 공급자 실패(기기 미등록 제외) ≥ 20%(`PUSH_RECEIPT_FAILURE_RATIO_THRESHOLD`). Expo는 회로가 없어 발송 실패는 작업 실패 경보                                                                                        |
| AI                   | `ai.provider.*`, `ai.spend.*`                                    | 업체 결제 회로(402 1회)·인증 회로(401·403 연속 3회)·장애 회로(시간 초과·5xx·과부하 연속 `AI_BREAKER_HEALTH_THRESHOLD`회, warning), 모든 업체 회로 열림, 동의 범위에 키 있는 업체 없음, 비용 경고·배경 중단·전체 중단 기준선. 업체가 모두 실패한 요청의 `AI_1301`은 5xx 예외(`http-5xx.AI_1301`)로 따로 간다 |
| 리마인더             | `notification.reminder.late-skips-high`                          | 15분 넘게 늦거나 할 일 시각이 지나 버린 할 일 리마인더가 1시간(`REMINDER_LATE_SKIP_WINDOW_MS`)에 20건(`REMINDER_LATE_SKIP_THRESHOLD`)                                                                                                                                                                       |
| 리마인더             | `notification.reminder.sweep-catch-up-capped`                    | 시간대 sweep이 15분 따라잡기 상한(`REMINDER_LATE_LIMIT_MINUTES`)을 넘겨 분을 버림                                                                                                                                                                                                                           |
| 작업·스케줄          | `job.failed`, `schedule.*`, `queue.dead-letter`                  | 아래 [작업 실패 경보](#작업-실패-경보)                                                                                                                                                                                                                                                                      |
| DB·런타임            | `runtime.*`, `database.unique-constraint.unknown`                | 풀 대기 30초 지속, 루프 p99 > 200ms, 힙 > 85%(`RUNTIME_THRESHOLDS`, 60초 표본, 넘기 시작한 표본에서만)                                                                                                                                                                                                      |
| 보안                 | `identity.session.refresh-token-reused`                          | 유예 10초 밖에서 이미 바꾼 refresh token이 다시 옴(warning)                                                                                                                                                                                                                                                 |
| 메일·날씨·운영       | `notification.email.*`, `weather.*`, `operations.*`              | 공급자 회로·한도·거절, WeatherKit 월 호출, 관리자 알림 거절, 브로드캐스트 재시도 소진                                                                                                                                                                                                                       |

## 작업 실패 경보

2026-11 운영에서 `ai-report-generation.v1`·`ai-suggestion-analysis.v1` 디스패처가 8일 넘게 매 실행 실패(392건)했지만 pg-boss `failed`와 로그에만 남았다. 그래서 작업 실패는 아래 경보로 사람에게 간다(catalog: [jobs.alerts.ts](../src/platform/jobs/jobs.alerts.ts)).

| 신호(key:subject)                | 언제                                                                                                                  | 어디서                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `job.failed:<queue>:<errorType>` | 재시도를 모두 쓰고 실패(DLQ로 옮겨질 때, `InvalidJobPayload` 포함). 남은 재시도의 실패는 `jobs.attempt.failed` 로그만 | `PgBossJobQueueAdapter`                                 |
| `schedule.failing:<scheduleKey>` | 마지막 두 예정 실행의 창(간격 × 2 + 30분) 안에 실패만 있다                                                            | `schedule-watchdog.v1`(15분, `missed: "skip"`)          |
| `schedule.overdue:<scheduleKey>` | 같은 창 안에 실행이 없거나 남은 실행이 30분 넘게 멈춰 있다                                                            | 같음                                                    |
| `queue.dead-letter:<queue>`      | 최근 15분 동안 DLQ에 작업이 들어왔다                                                                                  | 같음                                                    |
| Cron 모니터 `aido-job-worker`    | 감시 작업 check-in이 두 번 연속 빠지거나 실패(약 35분). worker·pg-boss가 통째로 멈춘 경우                             | `SentryJobHeartbeatAdapter`(`withMonitor`, 설정 upsert) |

- 태그는 `queue`·`job.name`·`job.attempt`·`error.type`·`schedule.key`뿐이고 payload 값·예외 message는 싣지 않는다. 판정은 순수 함수 [schedule-watchdog.domain-service.ts](../src/platform/jobs/schedule-watchdog.domain-service.ts)다.
- 판정하지 않는 것: 앞 예정 시각 뒤에 등록된 스케줄, 보관 기간(`deleteAfterSeconds`)이 지나 지워졌을 수 있는 실행, 등록되지 않은 스케줄(`bootstrap.background-init.failed` 로그).
- 모니터 slug는 상수 `JOB_WORKER_MONITOR_SLUG`다. Sentry가 environment별로 나눠 보여 env로 바꾸지 않는다.

### 중복 제거

모든 경보는 [DeduplicatingOperationalAlertAdapter](../src/platform/observability/deduplicating-operational-alert.adapter.ts)를 거친다. 이슈 단위는 `key`(subject가 있으면 `key:subject`)다. 첫 경보는 늘 보내고, 같은 단위는 1시간에 한 번, 다시 보내기는 프로세스 전체 시간당 2건(`OPERATIONAL_ALERT_LIMITS`, key 1,000개 `lru-cache`)이다. 재시작하면 단위마다 한 번 더 간다.

| 경우                                       | 월 오류 이벤트                                      |
| ------------------------------------------ | --------------------------------------------------- |
| 평소(실패 없음)                            | 0                                                   |
| 위 사고(매시 디스패처 2개, 8일, 단위 4개)  | 첫 4건 + 시간당 2건 × 192시간 ≈ 390건(한도의 8%)    |
| 사용자별 작업 1,000개가 같은 원인으로 실패 | 단위 1개라 1건                                      |
| 상한(어떤 폭주든 한 달 내내)               | 반복 2건 × 720시간 = 1,440건 + 단위별 첫 경보(29%~) |

## 지연·포화도 신호

새 유료 인프라 없이 Sentry Performance, `/health`, `OperationalAlertPort`로 본다.

| 신호        | 무엇                                                                     | 어디서                                                                                                |
| ----------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| 지연        | HTTP 경로별 p50·p95·p99, DB span, 공급자 호출, 작업별 p95                | Sentry Performance                                                                                    |
| 트래픽·오류 | RPS, 5xx 비율, 4xx는 `errorCode`별                                       | Sentry(5xx), 로그(4xx)                                                                                |
| 포화도      | 풀 `waitingCount`·`idleCount`·`totalCount`, 이벤트 루프 지연 p99, 힙·RSS | [runtime-stats](../src/platform/observability/runtime-stats.ts)(60초) → `/health` `runtime` 상세·경보 |
| 큐          | 큐별 대기·실행·실패, 가장 오래된 대기 시간, DLQ 크기                     | Health job 상태(`JobQueueRegistry`), 스케줄 감시                                                      |
| 외부 의존성 | 공급자별 지연·오류율·회로 상태·bulkhead 거절                             | `outbound.circuit.*` 로그, `OutboundUsage`, Health `outbound`                                         |
| DB          | 연결 수, CPU 크레딧, FreeableMemory·스왑, 느린 쿼리, autovacuum          | CloudWatch RDS + `pg_stat_statements` + `log_min_duration_statement`                                  |
| 업무        | 가입·DAU·푸시 퍼널                                                       | [알림·지표](notifications.md#지표)                                                                    |

- 판정은 순수 함수 `evaluateRuntimeSample`·`newlyBreached`이고 `runtime` 상세는 항상 up이다. 경보는 넘기 시작한 표본에서만 올린다. Swagger 설명은 계약 지문 때문에 바꾸지 않는다.
- 공개 `/health`의 상세(`database`·`queues`·`outbound`·`runtime`·`instanceId`)는 development·staging에서만 싣는다(`appConfig.exposeHealthDetails`). 운영은 `{ status }`와 200/503만 주므로 큐·포화도 감시는 경보(`OperationalAlertPort`)와 로그로 한다.
- 메모리: 힙 경보(`runtime.heap.usage-high`)는 사용량이 상한(`--max-old-space-size=384`)의 85%를 넘으면 뜬다. RSS(컨테이너 512MB)는 `/health` runtime 상세에만 싣고 경보가 없으니 배포 사이 추세로 본다. 누수 회귀는 [메모리 소크](testing.md#메모리)가 먼저 잡는다.
- Sentry 경보 규칙과 RDS 사용자 정의 파라미터 그룹은 사용자 승인 뒤 만든다.

### 표본 비율 (`tracesSampler`)

| 대상                                                                                         | 비율 | 이유                                                           |
| -------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `/`, `/health`, `GET …/unread-count`, `GET /v1/app-config/*`                                 | 0    | 상태 확인(Uptime 포함)·화면 복귀 폴링. 앞선 추적 헤더가 와도 0 |
| `POST /v1/webhooks/*`, `DELETE /v1/auth/account`                                             | 1    | 결제·계정 삭제, 드묾                                           |
| `/v1/auth/*`                                                                                 | 0.25 | 로그인·토큰 갱신                                               |
| `/v1/ai/*`, `quick-plans`, `voice-notes`, `action-plans`                                     | 0.5  | 느리고 비쌈                                                    |
| 그 밖의 HTTP(`SENTRY_TRACES_SAMPLE_RATE`로 바꿈)                                             | 0.1  | 기본. 값을 비우면(`KEY=`) 0이 아니라 기본                      |
| 경로도 큐도 없는 루트 span(타이머·Redis·pg-boss 폴링)                                        | 0    | 요청·작업 밖이라 볼 것이 없고 무료 span 한도를 먹음            |
| 매분 큐(`timezone-reminder`·`retention`·`push-delivery`)                                     | 0.01 | 하루 1,440회씩                                                 |
| `notification`·`todo-reminder`                                                               | 0.02 | 건수 많음                                                      |
| `account-purge`·`store-subscription-reconcile`·`invite-reward`·`todo-series-materialization` | 1    | 드물고 중요                                                    |
| `email-delivery`·`ai-report-generation`                                                      | 0.5  | 인증 메일·비싼 작업                                            |
| 그 밖의 큐                                                                                   | 0.05 | 기본                                                           |

## Sentry 무료 플랜 운영

Developer 플랜(2026-11-10 [요금 페이지](https://sentry.io/pricing/) 확인): 사용자 1명, 오류 5천 건, span 500만 개, 리플레이 50, 로그 5GB, 첨부 1GB, uptime 모니터 1개, cron 모니터 1개, 지표 모니터 20개, 대시보드 10개, 조회 30일. 알림은 **이메일만**이다(통합 도구 알림·서드파티 통합·추가 알림 유형·지출 알림 없음). 한도를 넘은 이벤트는 받지 않는다(청구 주기 끝까지 버려짐).

**사용량**(프로젝트 `node-nestjs`, 지난 30일 실측은 이전 설정: 모든 경로 0.2·작업 span 없음):

| 항목        | 지난 30일 실측           | 이 설정 추정                                                            | 한도 대비 |
| ----------- | ------------------------ | ----------------------------------------------------------------------- | --------- |
| 트랜잭션    | 1.45만                   | HTTP 기본 0.1·폴링 0으로 ≈ 0.7만 + 작업 ≈ 0.3만 = 약 1만                | —         |
| span        | 21.9만(트랜잭션당 약 15) | 약 16만                                                                 | 3%        |
| 오류 이벤트 | 203(조직 전체)           | 업무 거부 소음이 빠지고 새 경보가 더해져 500건 아래(중복 제거·5xx 상한) | 10%       |

배포 1주 뒤 Settings → Stats로 다시 본다. 한도를 넘으면 그 달 남은 이벤트를 받지 않으니 비율을 줄이는 쪽으로 맞춘다.

**설정된 것**(2026-11-10, 프로젝트 `node-nestjs`, 환경 `production`):

- 이슈 알림 "서버 운영: 새 오류·재발·급증·장애 즉시 메일": When 새 이슈·급증(escalating)·재발, If Issue category = Error 또는 Outage(성능 이슈 제외), Then 유일한 멤버에게 이메일, 같은 이슈는 30분에 한 번. 5xx·운영 경보(warning 포함)·작업 실패와 Cron·Uptime 장애가 모두 여기로 온다. 규칙은 태그에 기대지 않고, 경보 key 태그 이름은 `alert_key` 하나다(검색·필터용).
- Uptime 모니터 "Uptime check for api.aido.kr/health": 60초마다, 제한 5초, 2xx 기대, 연속 3회 실패(약 3분)에 이슈, 1회 성공에 해소. 설명에 3단계 첫 대응이 있다. 확인 요청이 `sentry-trace`를 보내도 `/health`는 표본 0이라 span을 남기지 않는다. 큐 장애는 `/health`가 200 `degraded`라 작업 경보가 맡는다.

**배포 뒤 할 일**: Cron 모니터 `aido-job-worker`는 만들지 않는다. 첫 감시 실행이 코드 값(`*/15 * * * *` UTC, margin 5분, max runtime 5분, 연속 2회 실패에 이슈)으로 upsert하므로 배포 15분쯤 뒤 Crons 화면에서 check-in이 OK인지만 본다. check-in은 15분마다 2건이라 분당 6건 한도 아래다.

경보를 받으면 [경보 카탈로그](alerts.md)의 첫 대응부터 본다. Sentry 이슈의 extra `runbook`에도 같은 문장이 있다.

## 확인할 증거

업무 로그 변경은 합성 민감값이 logger 인자에 들어가지 않는지와 성공·실패 격리를 함께 본다. HTTP 설정 변경은 실제 Nest 요청을 Pino stream으로 받아 reqId·event·query·header 비노출을 본다. logger spy로 Sentry까지 확인했다고 주장하지 않는다. 수집 범위는 `sentry-options.spec`이 SDK가 푼 `dataCollection` 값으로 확인한다.
