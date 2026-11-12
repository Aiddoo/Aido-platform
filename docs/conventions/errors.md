# 응답과 오류

서버·모바일·`@aido/api` 공통 기준이다. 성공은 공유 Zod 계약으로, 실패는 `ErrorCode` 하나로 표현한다. 서버 상세는 [REST 계약](../../apps/api/docs/http-contracts.md), 모바일 상세는 [에러 처리](../../apps/mobile/docs/error-handling.md)에 있다.

## 1. 계약

| 경우 | 형태                                                                | 정본                                                                                                                                |
| ---- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 성공 | `{ success: true, data, timestamp }`                                | `successEnvelopeSchema`([response.ts](../../packages/api/src/common/response.ts)) + 기능별 `contracts/<feature>/v{n}/*.response.ts` |
| 목록 | `data` 안의 기능별 schema + 공용 cursor 정보                        | [pagination.ts](../../packages/api/src/common/pagination.ts), [query.ts](../../packages/api/src/common/query.ts)                    |
| 실패 | `{ success: false, error: { code, message, details? }, timestamp }` | `errorEnvelopeSchema`([response.ts](../../packages/api/src/common/response.ts))                                                     |

- 실패의 의미는 `error.code`로 정한다. 앱은 `message`로 분기하지 않는다. HTTP 상태로 분기하는 곳은 아래 `ErrorCode`가 없는 경우(검증·없는 route·429)뿐이고, 상태 값은 `@aido/api/errors`의 `HttpStatus`를 쓴다. 앱·서버에 상태 상수를 따로 만들지 않는다.
- `details`는 코드별 계약이다. 운영에는 [`PUBLIC_ERROR_DETAILS`](../../packages/api/src/errors/public-details.ts)에 등록한 코드의 검증된 필드만 실린다(`featureQuota`, `charged`, 반복 오류 상세 등). 앱은 등록된 값을 공유 스키마로 읽는다. 등록하지 않은 코드의 `details`는 개발 환경 진단용이라 운영 응답에 없다. 스키마와 맞지 않는 값은 운영에서 빠지므로 코드별 details를 바꾸면 등록 스키마도 함께 바꾼다.
- `ErrorCode`는 [errors.ts](../../packages/api/src/errors/errors.ts)의 도메인 범위(`SYS 0001-0099`, `AUTH 0100-0199`, … `INVITE 2100-2199`)에서 다음 번호를 쓴다. 새 도메인은 빈 범위를 정해 같은 파일 머리 주석에 적는다. 문자열 코드를 하드코딩하지 않는다.
- `@RawResponse` endpoint(AppConfig의 `feature-discovery`·`app-version`)만 envelope 없이 raw union을 돌려준다. 새 raw 응답은 만들지 않는다.

## 2. 서버

- Domain 불변식 위반은 `DomainException`, Application 거부(권한·없음·한도)는 `ApplicationException`에 `ErrorCode`를 담아 던진다. 업무 오류는 slice `<slice>.errors.ts`의 이름 있는 생성 함수로 만들고, 예상한 DB 제약 충돌은 저장소가 업무 오류로 번역한다([도메인 모델](../../apps/api/docs/domain-modeling.md#오류와-식별자), [영속성](../../apps/api/docs/persistence.md#db-오류-번역)). HTTP 상태·envelope 변환은 [GlobalExceptionFilter](../../apps/api/src/platform/filters/global-exception.filter.ts)만 한다. Controller에서 `HttpException`을 직접 만들거나 응답을 조립하지 않는다.
- 코드마다 `Errors[code].message`는 Swagger와 서버 기본 문구로 쓰는 **합니다체**다(`서버 내부 오류가 발생했습니다.`). endpoint는 던질 수 있는 코드마다 `@ApiErrorResponse({ errorCode })`를 붙인다.
- `ErrorCode`가 없는 Nest `HttpException`(검증 파이프·없는 route·405·throttler)은 `GlobalExceptionFilter`가 상태로 정한다: 4xx → `SYS_0002`, 429·5xx → `SYS_0001`. 카탈로그에 상태별 공통 코드가 없고 출시 앱은 모르는 코드를 `SYS_0001`로 바꾸므로 이 경우를 위한 새 코드를 만들지 않는다. 앱은 이 경우 HTTP 상태(404·429)로만 분기한다.
- DB 연결 끊김·풀 대기 초과·문장/잠금/클라이언트 쿼리 시간 초과는 `GlobalExceptionFilter`가 503 `SYS_0005`(잠시 후 다시 시도)로 보낸다. 앱이 모르는 코드여도 출시 앱은 `SYS_0001`처럼 처리한다.
- 5xx만 `ExceptionReporterPort`(Sentry)로 보낸다([관측](../../apps/api/docs/observability.md#경보와-예외-보고)). 4xx 업무 오류는 `errorCode`만 로그로 남긴다.
- 오류 `message`는 요청 언어(`Accept-Language`, 없으면 ko·지원하지 않는 언어는 en)로 채운다. ko는 `Errors` 합니다체와 바이트 단위로 같고 en은 카탈로그 문구다. 던진 곳이 정한 문구와 검증 파이프의 Zod 문구는 그대로다. 계약은 문자열 그대로라 앱은 계속 `ErrorCode`로 현지화한다([서버 다국어](../../apps/api/docs/i18n.md)).

## 3. 모바일

한 패턴만 쓴다. 상세와 예시는 [에러 처리](../../apps/mobile/docs/error-handling.md)에 있다.

- **원본.** 코드·문구·`details` 스키마·`HttpStatus`는 `@aido/api/errors`, 실패 응답 모양은 `@aido/api/common`이다. 앱은 이 값을 다시 적지 않는다.
- **분류는 `KyHttpClient` 한 곳이다.** 4xx·Policy 실패 → `Result.err(ApiError | BusinessError)`. 5xx·네트워크·타임아웃·파싱 실패 → `throw InfraError`(5xx 봉투의 코드는 `ServerError.serverCode`) → 조회는 `QueryErrorBoundary`가 받는다. 예상한 오류인지는 `classifyError` 하나가 정한다(4xx·`BusinessError`는 예상, 401은 세션 종료, 연결 오류, 나머지는 예상하지 못한 오류).
- **기능 오류는 `domains/{feature}.error.ts` 하나다.** `{FEATURE}_ERROR_CODE` 코드 표, `isXxxError` 판별, `ErrorCode` → 폼 칸 매핑을 둔다. `isApiError`·`hasCode`는 이 파일 안에서만 쓰고, 던지는 쪽은 `new BusinessError(코드)`다.
- **한 오류는 한 곳에서 보인다.** 조회 오류는 경계 fallback, mutation 오류는 앱 `MutationCache`의 캐시 단계 `onError`가 `meta.errorFeedback`(`{ feature, fallbackKey?, isHandledByFeature?, describe? } | false`, mutation마다 필수)을 읽어 햅틱·토스트를 한 번, 칸 오류는 `form.setError`다. 기능 `onError`는 롤백과 `isHandledByFeature`로 뺀 오류만 다룬다. mutation은 경계로 가지 않고(`throwOnError` 미사용) 경계가 그린 오류에 토스트를 더하지 않는다.
- **문구.** `errors` 네임스페이스에서 키 = `ErrorCode`, 해요체다. 모르는 코드는 서버 message → `errors:fallback` 순서다([문구](../../apps/mobile/docs/dates-and-i18n.md#오류-메시지)).
- **보고.** 예상하지 못한 오류(`classifyError(error).kind === 'unexpected'`)만 `reportUnexpectedError`로 Sentry에 보낸다. mutation 전역 피드백, 경계, mutation 밖의 `useReportUnexpectedError`가 이 함수를 쓴다. 서비스는 삼킨 실패를 `logger.warn`으로만 남긴다.
