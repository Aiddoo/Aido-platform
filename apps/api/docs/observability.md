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

`notification.email.*`, `billing.subscription.webhook.processing-failed`, `billing.subscription.webhook.invalid`, `billing.subscription.reconcile.failed`, `operations.admin-notification.rejected`, `ai.*`(예산 초과·결제 회로·가격표 없는 모델), `weather.*`(WeatherKit 호출량), `access.quota.*`(돌려주지 못한 예약), `planning.todo-series.*`(회차 채우기 실패), `planning.todo-timezone-rebase-failed`, `social.invite-reward.*`(초대 보상 재시도 소진).

결제 웹훅 실패를 Discord로 보내는 규칙은 표시할 tag에 `storeEnvironment`를 넣어 SANDBOX와 PRODUCTION을 구분한다.

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

## 확인할 증거

업무 로그 변경은 합성 민감값이 logger 인자에 들어가지 않는지와 성공·실패 격리를 함께 본다. HTTP 설정 변경은 실제 Nest 요청을 Pino stream으로 받아 reqId·event·query·header 비노출을 본다. logger spy로 Sentry까지 확인했다고 주장하지 않는다.

## 전환 중

아직 옮기지 않은 Context는 `application/observability/<slice>/*.events.ts`·`*-alerts.ts`와 Nest Logger 연결 factory를 쓴다. `GlobalExceptionFilter`·`request-client.store`·`main.ts`의 직접 Sentry 호출과 `runtime-stats`는 platform 정리 때 포트 뒤로 옮긴다. 옮긴 Context는 `apps/api/architecture.ratchet.json`의 `migratedContexts`에 있다.
