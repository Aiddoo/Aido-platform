# 응답과 오류

서버·모바일·`@aido/api` 공통 기준이다. 성공은 공유 Zod 계약으로, 실패는 `ErrorCode` 하나로 표현한다. 서버 상세는 [REST 계약](../../apps/api/.claude/rest-contracts.md), 모바일 상세는 [에러 처리](../../apps/mobile/docs/error-handling.md)에 있다.

## 1. 계약

| 경우 | 형태                                                      | 정본                                                                                                                           |
| ---- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 성공 | `{ success: true, data, timestamp }`                      | `successEnvelopeSchema`([response.ts](../../packages/api/src/common/response.ts)) + 기능별 `contracts/<feature>/*.response.ts` |
| 목록 | `data` 안의 기능별 schema + 공용 cursor 정보              | [pagination.ts](../../packages/api/src/common/pagination.ts), [query.ts](../../packages/api/src/common/query.ts)               |
| 실패 | `{ success: false, error: { code, message }, timestamp }` | `errorEnvelopeSchema`([response.ts](../../packages/api/src/common/response.ts))                                                |

- 실패 본문의 의미는 `error.code`뿐이다. 앱은 `message`나 HTTP 상태 문자열로 분기하지 않는다. `details`는 개발 환경 진단용이다.
- `ErrorCode`는 [errors.ts](../../packages/api/src/errors/errors.ts)의 도메인 범위(`SYS 0001-0099`, `AUTH 0100-0199`, … `INVITE 2100-2199`)에서 다음 번호를 쓴다. 새 도메인은 빈 범위를 정해 같은 파일 머리 주석에 적는다. 문자열 코드를 하드코딩하지 않는다.
- `@RawResponse` endpoint(AppConfig의 `feature-discovery`·`app-version`)만 envelope 없이 raw union을 돌려준다. 새 raw 응답은 만들지 않는다.

## 2. 서버

- Domain 불변식 위반은 `DomainException`, Application 거부(권한·없음·한도)는 `ApplicationException`에 `ErrorCode`를 담아 던진다(`apps/api/src/shared/domain/exceptions`). HTTP 상태·envelope 변환은 [GlobalExceptionFilter](../../apps/api/src/platform/filters/global-exception.filter.ts)만 한다. Controller에서 `HttpException`을 직접 만들거나 응답을 조립하지 않는다.
- 코드마다 `Errors[code].message`는 Swagger와 서버 기본 문구로 쓰는 **합니다체**다(`서버 내부 오류가 발생했습니다.`). endpoint는 던질 수 있는 코드마다 `@ApiErrorResponse({ errorCode })`를 붙인다.
- 5xx만 Sentry로 보낸다. 로그에는 code·type만 남기고 원문 message·공급자 오류를 넣지 않는다([로깅](../../apps/api/.claude/logging-guide.md)).

## 3. 모바일

- 사용자 문구는 `errors` 네임스페이스에서 **키 = ErrorCode**, 해요체로 둔다. 모르는 코드는 서버 message → `errors:fallback` 순서다([i18n](../../apps/mobile/.claude/i18n-guide.md#에러-메시지)).
- 기능 오류는 `features/{feature}/domains/{feature}.error.ts` 하나에 `XxxErrorCode` 상수 · `XxxError`(`BusinessError` 구현) · `XxxErrors` 팩토리 · `isXxxError` 가드를 둔다.
- 분류는 `KyHttpClient` 한 곳이 한다.
  - 4xx·Policy 실패 → `Result.err(ApiError | XxxError)` → mutation `onError`에서 코드별로 처리한다.
  - 5xx·네트워크·타임아웃·Zod 파싱 실패 → `throw InfraError` → Suspense 조회는 `QueryErrorBoundary` fallback(다시 시도 + 문의하기)이 받는다.
- 한 오류는 한 곳에서만 보여 준다. 경계 fallback이 그린 오류에 토스트를 더하거나, 토스트를 띄운 mutation 오류를 경계로 다시 던지지 않는다. mutation은 경계로 가지 않으므로(`throwOnError` 미사용) 예상하지 못한 오류도 `onError`의 기본 토스트 하나로 끝낸다.
- 예상한 상태(404 = 대상 없음)는 `classifyBoundaryError`가 `expected-state`로 나눠 예외 리포트 없이 안내 화면을 그린다.
