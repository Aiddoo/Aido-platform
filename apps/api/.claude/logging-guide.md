# 서버 로깅

Nest/Pino 연결은 `platform/logging`이 소유한다. `bootstrap`이 등록한 공식 `nestjs-pino` Logger와 기존 Nest Logger를 사용한다. 별도 Logger wrapper나 이메일 마스킹 구현을 추가하지 않는다.

## 레이어와 소유권

- Domain은 로그를 기록하지 않는다. 상태와 불변식에 집중한다.
- Application은 순수 `ApplicationLogger` port를 생성자 의존성으로 받는다. Composition Root가 기존 Nest Logger를 연결한다.
- Infrastructure는 공급자 실패·재시도·작업 결과를 기록한다. HTTP 요청 로그는 Pino middleware, 오류 로그는 GlobalExceptionFilter가 소유한다.
- Controller와 Repository에서 같은 호출의 시작·종료 로그를 반복하지 않는다.
- 변경하는 업무 이벤트의 식별자는 Context의 `application/observability/<slice>/*.events.ts`, 공급자 이벤트는 `infrastructure/observability/<slice>`에 둔다. HTTP 이벤트는 `platform/logging/http-log.ts`에 둔다.

## 형식

`event`는 검색과 집계를 위한 안정적인 영어 식별자다. 필드는 `userId`, `sessionId`, `jobId`, `messageId`, `errorCode`, `errorType`, `retryCount`처럼 명확한 camelCase로 사용한다. 식별자가 없는 값은 `undefined`로 생략한다. 업무 상태와 HTTP 응답은 로그 문구에 의존하지 않는다.

```typescript
this.#dependencies.logger.error({
  event: IdentityLogEvent.VERIFICATION_EMAIL_FAILED,
  verificationType: 'PASSWORD_SETUP',
  userId,
});
```

`log`: 주요 성공 이벤트, `warn`: 처리 가능한 거부·재시도, `error`: 최종 공급자 실패·5xx, `debug`: 필요한 진단. 루프의 개별 항목이나 큰 객체의 JSON 문자열을 기록하지 않는다.

## 개인정보와 인증 값

이메일 주소·토큰·인증 코드·OAuth state·교환 코드의 일부·할 일 제목·AI 입력·이메일 본문은 로그에 남기지 않는다. 외부 공급자의 오류 원문도 이를 포함할 수 있다. 알려진 오류 분류와 내부 식별자를 남기고 발송 결과의 오류 계약은 유지한다. API key가 없는 이메일 모의 발송에서도 본문과 인증 코드를 출력하지 않는다.

HTTP 로그는 query를 제거한 `path`, `method`, `statusCode`, `event`, `reqId`, `responseTime`을 사용한다. `req`/`res` 원문을 직렬화하지 않으며 Pino의 `quietReqLogger`·`quietResLogger`로 요청 ID를 유지한다. 헤더/본문 redaction 설정을 함께 유지한다. `customLogLevel`의 `silent`가 4xx/5xx 자동 로그를 생략해 예외 필터와 중복 기록하지 않는다.

GlobalExceptionFilter는 기존 REST 오류 응답을 유지한다. 로그에는 오류 코드·타입·stack frame만 기록하고 query와 예외 메시지 원문을 합치지 않는다. 5xx Sentry 캡처는 유지하며, Sentry 전체 데이터 정제 검증까지 완료했다고 주장하지 않는다.

## 설정과 검증

환경 기본값은 test `silent`, production `info`, development `debug`다. 명시적인 module 옵션, `LOG_LEVEL`, 환경 기본값 순서로 결정한다. 개발 환경에서만 기본 pretty print를 사용한다.

실제 Nest HTTP 요청을 공식 Pino stream으로 받아 인증 query/header 비노출, 구조화 이벤트와 요청 ID, 4xx 자동 로그 생략을 검증한다. 인증 workflow와 Email Adapter 테스트는 실제 입력·발송 결과를 유지하면서 로그 비노출을 검증한다. 기존 문자열 로그의 일괄 변환은 기능별 후속 Stack에서 필요성과 소유권을 확인하며 진행한다.

공식 문서: [NestJS Pino](https://github.com/iamolegga/nestjs-pino), [Pino HTTP 옵션](https://github.com/pinojs/pino-http#api).
