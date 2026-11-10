# 관측 (로그·경보·지연·포화도)

로그 이벤트·경보 key·예외 보고·성능 신호를 더하거나 바꿀 때 읽는다. 실행 연결은 `src/platform/logging`(nestjs-pino)과 `src/platform/observability`다. 새 Logger wrapper나 자체 마스킹을 만들지 않는다.

## 소유

- Domain은 로그를 남기지 않는다.
- Application은 `ApplicationLoggerPort`를 `Pick`으로 받는다. 이벤트 상수는 slice의 `<slice>.log-events.ts`, 경보 key는 `<slice>.alerts.ts`다.
- Infrastructure는 공급자 결과·재시도·작업 실패를, HTTP middleware·filter는 요청·HTTP 오류를 남긴다. Controller·UseCase·Repository에 같은 시작/종료 로그를 반복하지 않는다.
- 같은 오류를 여러 층에서 다시 남기지 않는다. 4xx 업무 오류는 `errorCode`만 info·warn, 5xx만 error + 예외 보고다.

## 이벤트 키와 필드 (서버·앱 공통)

- 형식은 `<context>.<subject>[.<detail>].<outcome>`다. 소문자, 단어는 하이픈, 마디는 점이다(`identity.oauth.token-exchange.failed`, 앱 `todo-comment.submit.failed`).
- 첫 마디는 Bounded Context, platform은 기술 영역(`http`·`redis`·`cache`·`jobs`)이다. 마지막은 결과(`failed`·`completed`·`skipped` …)다.
- Sentry `feature` 태그는 첫 마디의 하이픈을 밑줄로 바꾼 값이다(앱 [observability](../../mobile/.claude/observability.md)와 같은 축).
- `errorType`은 분류 또는 예외 클래스 이름(`toErrorType`), `errorCode`는 공유 `ErrorCode` 값만이다. 공급자 기호는 `providerError`, 공급자 HTTP 상태는 `statusCode`, Node 네트워크 code는 `networkCode`다.
- 메시지 자리에 template literal·문자열 연결을 쓰지 않는다. `logger.warn({ event, ...fields })` 한 객체로 남긴다.
- 기존 snake_case 키(`weather.*`·`ai.job.*`·`social.*`·`notification.*` 일부)는 저장된 조회 호환으로 유지한다. 새 키만 이 형식이다.

레벨: log는 필요한 성공 이벤트, warn은 격리된 실패·처리 가능한 거부, error는 최종 실패, debug는 진단이다.

## 남기면 안 되는 값

이메일, 토큰, 인증 code, OAuth state, authorization header, 공급자 사용자 ID, user tag, 할 일 제목, 말한 내용·전사, AI 입력/출력, 이메일 본문, 전체 webhook payload, 공급자 오류 본문, env 값, 새 키 이름(`*_KEYS`)의 값.

- 공급자 실패는 공급자 이름·HTTP 상태·짧은 오류 코드만 남긴다. 외부 `error.message`·stack을 logger에 그대로 넘기지 않는다.
- 로그 정리와 호출자의 오류 계약은 별개다. 로그를 가리려고 sender result·queue throw·재시도 여부를 바꾸지 않는다.

## HTTP 로그와 요청 ID

- [logger.options.ts](../src/platform/logging/logger.options.ts)는 nestjs-pino `pinoHttp` 옵션이다. query를 뺀 path·method·status·event와 요청 ID를 남기고 req/res 원문 serializer를 끈다. 4xx/5xx 자동 로그는 filter와 중복하지 않게 silent다.
- 요청 ID(`reqId`)는 [assignRequestId](../src/platform/http/request-client/request-id.ts)가 정한다. 같은 값이 `RequestClient.requestId`와 Sentry `request_id` 태그라 앱 breadcrumb·서버 로그·Sentry 이벤트를 한 ID로 찾는다.
- 레벨 우선순위는 module 옵션 → `LOG_LEVEL` → 환경 기본값(test silent, production info, 그 밖 debug)이다. `pino-pretty`는 개발에서만 쓰는 devDependency다.

## 경보와 예외 보고

| 상황            | 포트                                                                                    | 어댑터                    |
| --------------- | --------------------------------------------------------------------------------------- | ------------------------- |
| 사람이 볼 상황  | `OperationalAlertPort.raise({ key, severity, message, tags, details })`(throw하지 않음) | Sentry(fingerprint = key) |
| 5xx·미분류 예외 | `ExceptionReporterPort`(`GlobalExceptionFilter`가 호출)                                 | Sentry                    |

- Sentry import는 `platform/observability/sentry-*.adapter.ts`와 `instrument.ts`에만 둔다. 업무 코드에서 Sentry를 직접 부르지 않는다.
- Sentry에는 사용자 ID만 싣고 IP(`ip_address`·`x-forwarded-for`·`x-real-ip`)는 보내지 않는다. AI 입출력은 [보안](security.md#ai)대로 끈다.

### 경보 전달

운영 경보는 Sentry 이슈로만 남고 사람에게 자동 전달되지 않는다. Sentry 알림 규칙에서 태그 `alert.key`가 다음인 이슈를 Discord·Slack·이메일로 보낸다. 새 key를 만들면 이 목록과 알림 규칙에 함께 더한다.

`notification.email.*`, `billing.subscription.webhook.processing-failed`, `billing.subscription.webhook.invalid`, `billing.subscription.reconcile.failed`, `operations.admin-notification.rejected`, `ai.*`(예산 초과·결제 회로·가격표 없는 모델), `weather.*`(WeatherKit 호출량), `access.quota.*`(돌려주지 못한 예약), `planning.todo-series.*`(회차 채우기 실패), `planning.todo-timezone-rebase-failed`, `social.invite-reward.*`(초대 보상 재시도 소진), `database.unique-constraint.unknown`(저장소가 번역하지 않은 unique 충돌), `runtime.*`(풀 대기 지속·이벤트 루프 지연·힙 사용률).

결제 웹훅 실패를 Discord로 보내는 규칙은 표시할 tag에 `storeEnvironment`를 넣어 SANDBOX와 PRODUCTION을 구분한다.

## 작업 실패 경보

2026-11 운영에서 `ai-report-generation.v1`·`ai-suggestion-analysis.v1` 디스패처가 8일 넘게 매 실행 실패(실패 작업 392건)했지만 pg-boss `failed` 상태와 로그에만 남아 아무도 몰랐다. 작업 실패를 사람에게 알리는 장치는 아래 넷이고 모두 Sentry 무료(Developer) 플랜 안에서 돈다.

### Sentry 무료 플랜 한도 (2026-11-10 공식 문서 확인)

| 항목                 | 한도                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| 오류 이벤트          | 월 5,000건(운영 경보·5xx가 함께 쓴다)                                                                       |
| Cron 모니터          | 1개(추가는 유료 플랜 PAYG $0.78/개). check-in은 모니터 환경당 분당 6건까지                                  |
| Uptime 모니터        | 1개. 확인 간격 1분~1시간, 기본 3회 연속 실패 뒤 이슈, 확인 요청 span은 span 한도에 세지 않는다              |
| 알림                 | 이메일만. Slack·Discord 같은 연동 도구 알림, 서드파티 연동, API, 추가 경보 종류는 Team 플랜부터, 사용자 1명 |
| 경보 규칙 조건(무료) | 새 이슈·재발 트리거, `Tagged event`(`is set`·`equals` 등)·Issue category 필터, 여러 필터의 any/all          |

출처: [요금](https://sentry.io/pricing/), [Crons(NestJS)](https://docs.sentry.io/platforms/javascript/guides/nestjs/crons/), [Uptime](https://docs.sentry.io/product/uptime-monitoring/), [경보 조건](https://docs.sentry.io/product/alerts/create-alerts/issue-alert-config/). 무료 플랜은 Discord·Slack 전달이 안 되므로 위 [경보 전달](#경보-전달)도 이메일로 받는다.

### 경보 종류

| 신호                                | 언제                                                                                                                                                                               | 어디서                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `job.failed:<queue>:<errorType>`    | 작업이 재시도를 모두 쓰고 실패했다(DLQ로 옮겨지는 때, 잘못된 payload `InvalidJobPayload` 포함). 재시도가 남은 실패는 `jobs.attempt.failed` 로그만, 마지막 실패는 `jobs.job.failed` | 작업 runtime(`PgBossJobQueueAdapter`, 옛 `PgBossJobRuntimeAdapter`)          |
| `schedule.failing:<scheduleKey>`    | 끝났어야 할 마지막 두 예정 실행의 창 안에 끝난 실행이 없고 실패만 있다                                                                                                             | `schedule-watchdog.v1`(15분, `missed: "skip"`)                               |
| `schedule.overdue:<scheduleKey>`    | 같은 창 안에 실행이 없거나, 남은 실행이 여유 30분을 넘겨 멈춰 있다                                                                                                                 | 같음                                                                         |
| `queue.dead-letter:<queue>`         | 최근 15분 동안 DLQ에 작업이 들어왔다(`JobQueueRegistry`가 아는 DLQ)                                                                                                                | 같음                                                                         |
| Cron 모니터 `aido-job-worker`(기본) | 감시 작업 check-in이 두 번 연속 빠지거나 실패했다(약 35분). worker·pg-boss가 통째로 멈춘 경우다                                                                                    | `JobHeartbeatPort` → `SentryJobHeartbeatAdapter`(`withMonitor`, 설정 upsert) |

- 태그는 `queue`, `job.name`(payload의 고정 `name`, 없으면 큐 이름), `job.attempt`, `error.type`, `schedule.key`뿐이다. payload 값과 예외 message(공급자 원문)는 싣지 않는다. 원인은 같은 시각의 로그로 찾는다.
- 감시 대상은 pg-boss `schedule` 표 전체(옛 `JobRuntimePort` 등록 포함)다. 스케줄러와 같은 cron 해석(`previewSchedule`)으로 실제 예정 시각을 구해 "간격 × 2 + 30분" 창을 만들므로 한 번 빠지는 것(배포·`skip`)은 넘기고 서머타임·평일 cron에서도 맞다. 판정은 순수 함수 [schedule-watchdog.domain-service.ts](../src/platform/jobs/schedule-watchdog.domain-service.ts)다.
- 판정하지 않는 경우: 앞 예정 시각 뒤에 등록된 스케줄, 최근 예정 실행이 끝난 작업 보관 기간(`deleteAfterSeconds`)이 지나 지워졌을 수 있는 경우. 감시하려면 보관 기간을 스케줄 간격 이상으로 둔다(지금 스케줄은 모두 24시간 이상, 간격은 하루 이하).
- 다루지 않는 것: 한 번도 등록되지 않은 스케줄(등록 실패는 `bootstrap.background-init.failed` 로그), 만료(`expireInSeconds`)로 pg-boss가 실패시킨 스케줄 없는 작업.
- 개발·스테이징·테스트와 DSN이 없을 때는 no-op 어댑터라 check-in을 보내지 않는다. 모니터 slug는 선택 설정 `SENTRY_JOB_MONITOR_SLUG`(기본 `aido-job-worker`)다.

### 중복 제거와 한도 계산

모든 `OperationalAlertPort` 경보(작업 경보만이 아니다)는 [DeduplicatingOperationalAlertAdapter](../src/platform/observability/deduplicating-operational-alert.adapter.ts)를 거쳐 Sentry로 간다. Sentry 이슈 key(fingerprint)는 그대로 경보 key다.

- key의 첫 경보는 늘 보낸다(새 이슈 → 알림).
- 같은 key는 1시간에 한 번만 다시 보낸다.
- 다시 보내는 경보는 프로세스 전체에서 시간당 2건까지다.
- 기록은 상한 있는 `lru-cache`(key 1,000개)이고 프로세스 메모리라 재시작하면 key마다 한 번 더 간다.

| 경우                                                                            | 월 오류 이벤트                                     |
| ------------------------------------------------------------------------------- | -------------------------------------------------- |
| 평소(실패 없음)                                                                 | 0                                                  |
| 이번 사고(매시 디스패처 2개, 8일): key 4개(`job.failed` 2·`schedule.failing` 2) | 첫 4건 + 시간당 2건 × 192시간 ≈ 390건(한도의 8%)   |
| 사용자별 작업 1,000개가 같은 원인으로 실패                                      | key 1개라 1건(중복 제거가 없으면 1,000건)          |
| 상한(어떤 폭주든 한 달 내내)                                                    | 반복 2건 × 720시간 = 1,440건 + key별 첫 경보(29%~) |

Cron check-in은 15분마다 2건(시작·끝)으로 분당 6건 한도 아래이고 모니터 1개라 무료 몫 안이다.

### 배포 뒤 Sentry에서 할 일

1. **경보 규칙 하나**(Alerts → Create Alert, 서버 프로젝트):
   - When(any): `A new issue is created`, `A resolved issue regresses`
   - If(any): `Tagged event` `alert.key` **is set** / `Tagged event` `monitor.slug` **equals** `aido-job-worker` / (Uptime을 쓰면) `Issue category` **equals** `Outage`
   - Then: `Notify on preferred channel` → Member(본인). 무료 플랜이라 이메일로 온다.
2. **Cron 모니터**: 따로 만들지 않는다. 운영 첫 감시 실행이 `withMonitor` upsert로 `aido-job-worker`(`*/15 * * * *` UTC, margin 5분, max runtime 5분, 연속 2회 실패에 이슈, 1회 성공에 해소)를 만든다. 배포 15분쯤 뒤 Crons 화면에서 check-in이 OK인지 본다. 계정에 다른 Cron 모니터가 이미 있으면 무료 1개를 넘으므로 하나를 지우거나 이 slug를 그 모니터에 맞춘다.
3. **(선택) Uptime 모니터 1개**: `GET https://api.aido.kr/health`, 간격 5분, 기대 상태 200. API나 DB가 내려가면(503) 3회 연속 실패 뒤 Outage 이슈가 생겨 1번 규칙으로 온다. 큐 장애는 `/health`가 `degraded`로 200을 주므로 이 모니터가 아니라 위 작업 경보가 맡는다.

## 지연·포화도 신호

새 유료 인프라 없이 Sentry Performance(운영 `tracesSampleRate` 0.2, `pg` 자동 계측), `/health`, `OperationalAlertPort`로 본다.

| 신호        | 무엇                                                                            | 어디서                                                               |
| ----------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 지연        | HTTP 경로별 p50·p95·p99, DB span, 공급자 호출, 작업별 p95(`queue.process` span) | Sentry Performance                                                   |
| 트래픽·오류 | RPS, 5xx 비율, 4xx는 `errorCode`별                                              | Sentry(5xx), 로그(4xx)                                               |
| 포화도      | 풀 `waitingCount`·`idleCount`·`totalCount`, 이벤트 루프 지연 p99, 힙·RSS        | `platform/observability/runtime-stats`(60초) → `/health` 상세·경보   |
| 큐          | 큐별 대기·실행·실패, 가장 오래된 대기 시간, DLQ 크기                            | `JobQueueHealth`(등록된 큐 전부)                                     |
| 외부 의존성 | 공급자별 지연·오류율·회로 상태·bulkhead 거절                                    | `outbound.circuit.*` 로그, `OutboundUsage`, Health `outbound`        |
| DB          | 연결 수, CPU 크레딧, FreeableMemory·스왑, 느린 쿼리, autovacuum                 | CloudWatch RDS + `pg_stat_statements` + `log_min_duration_statement` |
| 업무        | 가입·DAU·푸시 퍼널                                                              | [알림·지표](notifications.md#지표)                                   |

- 경보 기준 예: 풀 대기 30초 지속, 루프 p99 > 200ms, 힙 > 85%, 경로 p95 > 1초, 5xx 비율 > 1%. Sentry 경보 규칙과 RDS 사용자 정의 파라미터 그룹은 사용자 승인 뒤 만든다.
- 메모리: 힙 경보(`runtime.heap.usage-high`)는 사용량이 상한(`--max-old-space-size=384`)의 85%를 넘으면 뜬다. RSS(컨테이너 512MB)는 `/health` runtime 상세에만 싣고 경보가 없으니 배포 사이 추세로 본다. 누수 회귀는 [메모리 소크](testing.md#메모리)가 먼저 잡는다.

## 확인할 증거

업무 로그 변경은 합성 민감값이 logger 인자에 들어가지 않는지와 성공·실패 격리를 함께 본다. HTTP 설정 변경은 실제 Nest 요청을 Pino stream으로 받아 reqId·event·query·header 비노출을 본다. logger spy로 Sentry까지 확인했다고 주장하지 않는다.

## 전환 중

- Sentry 직접 호출은 `platform/observability/sentry-*`(경보·예외 보고 어댑터, 요청 ID 태그·종료 flush)와 `instrument.ts`에만 있다. `app.module`의 `SentryModule.forRoot()`는 SDK 설정 모듈이라 그대로 둔다.
- [runtime-stats](../src/platform/observability/runtime-stats.ts)는 60초마다 표본을 재서 `/health`의 `runtime` 상세(항상 up)에 싣고, 판정은 순수 함수 `evaluateRuntimeSample`이다. Swagger 설명은 계약 지문 때문에 바꾸지 않았다.
- platform 로그 이벤트 상수는 [platform.log-events.ts](../src/platform/logging/platform.log-events.ts)다. 아직 옮기지 않은 Context는 `application/observability/<slice>/*.events.ts`·`*-alerts.ts`와 Nest Logger 연결 factory를 쓴다. 옮긴 Context는 `apps/api/architecture.ratchet.json`의 `migratedContexts`에 있다.
