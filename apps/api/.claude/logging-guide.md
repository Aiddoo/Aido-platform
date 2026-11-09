# 서버 로깅

업무 이벤트·외부 공급자·HTTP 로그를 바꿀 때 참고한다. 실행 연결은 `src/platform/logging`의 Nest/Pino 구성을 쓴다. 새 Logger wrapper나 자체 마스킹을 만들지 않는다.

## 소유

- Domain은 로그를 남기지 않는다.
- 순수 Application은 `Pick<ApplicationLogger, ...>`를 생성자로 받고 factory provider가 Nest Logger를 연결한다.
- Application 이벤트 상수는 `application/observability/<slice>/*.events.ts`(예: [identity-log.events.ts](../src/modules/identity/application/observability/auth/identity-log.events.ts)), 공급자 이벤트는 `infrastructure/observability/<slice>`, HTTP 이벤트는 `platform/logging/http-log.ts`, platform 이벤트는 [platform-log.events.ts](../src/platform/logging/platform-log.events.ts)다.
- Infrastructure는 공급자 결과·재시도·작업 실패를, HTTP middleware/filter는 요청·HTTP 오류를 남긴다. Controller·UseCase·Repository에 같은 시작/종료 로그를 반복하지 않는다.

## 이벤트 키와 필드 (서버·앱 공통)

- 형식은 `<context>.<subject>[.<detail>].<outcome>`다. 소문자, 단어는 하이픈, 마디는 점이다(`identity.oauth.token-exchange.failed`, 앱 `todo-comment.submit.failed`).
- 첫 마디는 Bounded Context, platform은 기술 영역(`http`·`redis`·`cache`·`jobs`)이다. 마지막은 결과(`failed`·`completed`·`skipped` …)다.
- Sentry `feature` 태그는 첫 마디의 하이픈을 밑줄로 바꾼 값이다(앱 [observability.md](../../mobile/.claude/observability.md)와 같은 축).
- `errorType`은 분류 또는 예외 클래스 이름(`toErrorType`), `errorCode`는 공유 `ErrorCode` 값만이다. 공급자 기호는 `providerError`, 공급자 HTTP 상태는 `statusCode`, Node 네트워크 code는 `networkCode`다. `errorName`·`errorKind`를 새로 쓰지 않는다.
- 메시지 자리에 template literal·문자열 연결을 쓰지 않는다. `logger.warn({ event, ...fields })` 한 객체로 남긴다.
- 기존 snake_case 키(`weather.*`·`ai.job.*`·`social.*`·`notification.*` 일부)는 저장된 조회 호환으로 유지한다. 새 키만 이 형식을 따른다.

```ts
this.#dependencies.logger.warn({
  event: NotificationDeliveryLogEvent.RECONCILE_PUSH_RECEIPTS_CACHE_SETTLE_FAILED,
  count: failedCount,
  errorType: "cache-invalidation",
});
```

레벨: log는 필요한 성공 이벤트, warn은 격리된 실패·처리 가능한 거부, error는 최종 실패, debug는 진단이다. 같은 오류를 여러 레이어에서 반복하지 않는다.

## 남기면 안 되는 값

이메일, 토큰, 인증 code, OAuth state, authorization header, 공급자 사용자 ID, user tag, 할 일 제목, 말한 내용·전사, AI 입력/출력, 이메일 본문, 전체 webhook payload, 공급자 오류 본문, env 값.

- 공급자 실패는 공급자 이름·HTTP 상태·짧은 오류 코드만 남긴다.
- 외부 `error.message`·stack도 같은 값을 포함할 수 있으므로 logger에 그대로 넘기지 않는다.
- 무설정 로그 발송 어댑터도 본문·code를 출력하지 않는다.

로그 정리와 호출자의 오류 계약은 별개다. 로그를 가리려고 sender result·queue throw·retry 여부를 바꾸지 않는다. 실패를 격리해야 하는 흐름에 로그 변경으로 예외를 새로 전파하지 않는다.

## Sentry와 경보

- 전역 filter가 5xx만 캡처한다. 공개 오류 응답을 유지하고 query와 예외 message 원문을 합치지 않는다.
- Sentry에는 사용자 ID만 싣고 IP(`ip_address`·`x-forwarded-for`·`x-real-ip`)는 보내지 않는다.
- 사람이 볼 상황은 [`OPERATIONAL_ALERT`](architecture.md#외부-호출-정책계량운영-경보)로 올린다. 업무 코드에서 Sentry를 직접 부르지 않는다.

## HTTP와 설정

[logger.options.ts](../src/platform/logging/logger.options.ts)는 공식 nestjs-pino `pinoHttp` 옵션을 쓴다. query를 뺀 path/method/status/event와 요청 ID를 남기고 req/res 원문 serializer를 끈다. 4xx/5xx 자동 로그는 `customLogLevel`의 silent로 생략해 filter와 중복하지 않는다.

요청 ID(`reqId`)는 `genReqId`의 [assignRequestId](../src/platform/http/request-client/request-id.ts)가 정한다. 앱이 보낸 `X-Request-Id`가 UUID면 그대로, 아니면 새 UUID를 쓰고 응답 `X-Request-Id`로 돌려준다. 같은 값이 `RequestClient.requestId`와 Sentry `request_id` 태그가 되므로 앱 breadcrumb·서버 로그·Sentry 이벤트를 한 ID로 찾는다.

레벨 우선순위는 module 옵션 → `LOG_LEVEL` → 환경 기본값(test silent, production info, 나머지 debug)이다. pretty print는 production/test 밖에서만 쓴다.

## 확인할 증거

업무 로그 변경은 합성 민감값이 logger 인자에 들어가지 않는지와 기존 성공/실패 격리를 함께 본다. HTTP 설정 변경은 실제 Nest 요청을 Pino stream으로 받아 reqId/event/query·header 비노출을 본다. logger spy로 Sentry까지 확인했다고 주장하지 않는다.
