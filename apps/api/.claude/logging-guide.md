# 서버 로깅

업무 이벤트·외부 공급자·HTTP 로그를 바꿀 때 참고한다. 실행 연결은 `src/platform/logging`의 기존 Nest/Pino 구성을 사용한다. 새 Logger wrapper나 자체 마스킹 framework를 추가하지 않는다.

## 소유와 이벤트

- Domain은 로그를 기록하지 않는다.
- 순수 Application은 필요한 `Pick<ApplicationLogger, ...>`를 생성자로 받고 factory provider가 기존 Nest Logger를 연결한다.
- Application 이벤트 상수는 Context의 `application/observability/<slice>/*.events.ts`, 공급자 이벤트는 `infrastructure/observability/<slice>`에 둔다. HTTP 이벤트는 `platform/logging/http-log.ts`가 소유한다.
- Infrastructure는 공급자 결과·재시도·작업 실패를, HTTP middleware/filter는 요청·HTTP 오류를 기록한다. Controller·UseCase·Repository에 같은 시작/종료 로그를 반복하지 않는다.

`event`는 안정된 영어 key다. 식별자·channel·허용된 reason code·count·errorCode/errorType처럼 조회할 수 있는 필드를 구조화한다. 원문 message에 업무 상태를 의존시키지 않는다.

[ReconcilePushReceipts](../src/modules/notification/application/use-cases/delivery/reconcile-push-receipts.use-case.ts)의 실제 로그 발췌:

```ts
this.#dependencies.logger.warn({
  event: NotificationDeliveryLogEvent.RECONCILE_PUSH_RECEIPTS_CACHE_SETTLE_FAILED,
  count: failedCount,
  errorType: "cache-invalidation",
});
```

log는 필요한 성공 이벤트, warn은 격리된 실패·처리 가능한 거부, error는 최종 실패, debug는 유용한 진단에 사용한다. 항목마다 큰 객체를 JSON으로 출력하거나 같은 오류를 여러 레이어에서 반복하지 않는다.

## 원문과 오류 계약

이메일·token·인증 code·OAuth state·authorization header·할 일 제목·AI 입력/출력·이메일 본문·전체 webhook payload를 기록하지 않는다. 외부 error.message/stack/문자열도 같은 값을 포함할 수 있으므로 그대로 logger에 전달하지 않는다. 알려진 errorType/code와 필요한 내부 식별자만 남긴다. 무설정 mock 발송도 본문·code를 출력하지 않는다.

로그 정리와 caller의 오류 계약은 구분한다. 기존 sender result.error, queue throw identity, retry 여부를 log 비노출만을 위해 임의로 바꾸지 않는다. 반대로 호출자가 실패를 격리해야 하는 흐름에 logging 변경 때문에 예외를 새로 전파하지 않는다.

전역 filter는 공개 오류 응답을 유지하면서 query와 예외 message 원문을 합치지 않는다. 기존 sanitized frame·errorCode/type 처리와 5xx Sentry 캡처를 확인한다. 이 범위의 검증을 Sentry 전체 데이터 정제 완료로 확대하지 않는다. 모듈별 발송·문의 로그의 실제 검증 범위는 [전환 기록](../../../docs/server/migration.md)에 남긴다.

## HTTP와 설정

[logger.options.ts](../src/platform/logging/logger.options.ts)는 공식 nestjs-pino `pinoHttp` 옵션을 사용한다. query를 제외한 path/method/status/event와 요청 ID를 유지하고 req/res 원문 serializer를 비활성화한다. `quietReqLogger`·`quietResLogger`와 redaction 설정을 유지하며 4xx/5xx 자동 로그는 `customLogLevel`의 silent로 생략해 filter와 중복하지 않는다.

level 우선순위는 명시적인 module 옵션 → LOG_LEVEL → 환경 기본값이다. 현재 기본값은 test silent, production info, 나머지 debug다. 기본 pretty print는 production/test 밖에서 사용한다. 업무 코드가 개별 logger 설정으로 이 정책을 다시 만들지 않는다.

## 확인할 증거

업무 로그 변경은 합성 민감값이 실제 logger 인자에 들어가지 않는지와 기존 성공/실패 격리·오류 결과를 함께 확인한다. HttpClient/SDK 경계는 실제 설치 API의 wire/throw 동작을 반영한 fixture가 필요하다. 전체 SDK mock은 native error/partial result 의미의 증거가 아니다.

HTTP 설정 변경은 실제 Nest 요청을 공식 Pino stream으로 받아 reqId/event/query·header 비노출과 중복 기록을 확인한다. callback logger spy로 downstream Pino/Sentry/외부 유출까지 확인했다고 주장하지 않는다. 실행 범위는 [testing-guide.md](testing-guide.md)에서 선택한다.
