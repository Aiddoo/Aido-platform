---
'@aido/api': patch
---

`@aido/api/errors`에서 패키지 테스트만 쓰던 옛 함수·타입을 지운다: `createErrorResponse`, `ErrorResponse`(description·path가 있던 옛 응답 모양), `getErrorsByDomain`(SUBSCRIPTION 이후 도메인이 빠져 있었다), `getErrorsByHttpStatus`, `getAllErrorCodes`, `getAllErrors`, `getError`. 서버·앱은 쓰지 않았고 실패 응답 모양은 `@aido/api/common`의 `errorEnvelopeSchema`·`RestErrorResponse` 그대로다. `ErrorCode`·`Errors`·`HttpStatus`·`isErrorCode`·공개 details는 그대로다.
