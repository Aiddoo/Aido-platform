# 에러 처리 가이드

앱의 오류 처리 규칙의 원본이다. 서버와 함께 지키는 계약(envelope, ErrorCode 범위, 한 오류는 한 곳에서)은 [공통 오류 규칙](../../../docs/conventions/errors.md)에 있다.

- **단일 원본.** `ErrorCode`·`Errors`·코드별 `details` 스키마(`PUBLIC_ERROR_DETAILS`)·`HttpStatus`는 `@aido/api/errors`, 실패 응답 모양(`errorEnvelopeSchema`)은 `@aido/api/common`이다. 앱에 코드 문자열·상태 상수·details 모양을 다시 만들지 않는다.
- **판단 하나.** 예상한 오류인지는 `shared/errors/classify-error.ts`의 `classifyError` 하나가 정한다. 예상한 오류는 화면이 안내하고, 예상하지 못한 오류만 Sentry 이슈가 된다.
- **한 오류는 한 곳에서 보인다.** 조회는 경계 fallback, mutation은 전역 피드백, 칸 오류는 `form.setError`다. 경계가 그린 오류에 토스트를 더하지 않고 `onError`에서 다시 던지지 않는다.

## 흐름

```text
 서버 GlobalExceptionFilter ─ { success:false, error:{ code, message(요청 언어), details? }, timestamp }
            │
 ky(retry 0) → afterResponse: 토큰 갱신(401) · 실패 breadcrumb(관측만)
            ▼
 KyHttpClient.#request ── readErrorEnvelope(@aido/api/common에서 error만)
   2xx 봉투 아님·JSON 아님 ─────────────► throw ParseError
   4xx ─► Result.err(ApiError { code: 아는 코드|SYS_0001, message, status, details, requestId })
   5xx ─► throw ServerError { status, serverCode: 아는 코드|null, details, requestId, request }
   시간 초과 ─► throw TimeoutError · ky NetworkError / expo `fetch failed:` ─► throw NetworkError
   그 밖(요청 경로의 TypeError 등 코드 버그) ─► 그대로 throw
            ▼
 {Entity}Api: parseApiResponse(응답 스키마 + mapper toModel) 실패 ─► throw ParseError
 Device Service·Policy: Result.err(BusinessError(코드))
            ▼  queryFn·mutationFn이 unwrap()
 ├─ 조회: shouldRetryQuery(일시 장애 6회 · ParseError·코드 있는 오류 0회 · 그 밖 3회)
 │    useSuspenseQuery ─► QueryErrorBoundary: kind별 보고 + 기능 fallback + 진단 문의 초안
 │    useQuery(isError)·데이터 있는 재조회 실패 ─► QueryCache.onError ─► QueryErrorReport
 └─ mutation: retry false, MutationCache.onError(기능 onError보다 먼저)
      meta.errorFeedback 객체 ─► useMutationErrorFeedback: 햅틱 + 토스트(문구 + describe) + 보고
      isHandledByFeature ─► 기능 onError·form.setError / false ─► 기능이 useMutationErrorFeedback 한 번
            ▼
 reportUnexpectedError / logger.error ─► captureError(WeakSet 중복 제거) ─► classifyError
   unexpected ─► Sentry 이슈(feature·status·serverErrorCode·method·endpoint·request_id 태그)
   그 밖 ─► breadcrumb
```

## 분류: classifyError

```typescript
classifyError(error): { kind: 'expected' | 'auth-expired' | 'connectivity' | 'unexpected'; report: 'event' | 'breadcrumb' }
```

| kind           | 오류                                                                                                             | report       |
| -------------- | ---------------------------------------------------------------------------------------------------------------- | ------------ |
| `expected`     | 401이 아닌 `ApiError`(4xx), `BusinessError`와 하위 클래스, `KeychainLockedError`                                 | `breadcrumb` |
| `auth-expired` | 401 `ApiError`                                                                                                   | `breadcrumb` |
| `connectivity` | `NetworkError`, `TimeoutError`                                                                                   | `breadcrumb` |
| `unexpected`   | `ServerError`, `ParseError`·`ZodError`, 코드 버그, 감싸지 않은 SDK 오류(문자열 `code`가 있어도), Error가 아닌 값 | `event`      |

- 예상한 것만 이름으로 나열한다. 새 오류 종류를 예상한 쪽으로 옮기려면 이 함수와 `classify-error.test.ts` 표를 함께 고친다.
- Sentry 어댑터(`captureError`), mutation·조회 전역 보고, 경계, `useReportUnexpectedError`가 모두 이 판정을 따른다.
- 재시도(`bootstrap/query/query-retry.ts`)는 따로 정한다. 일시 장애(`isTransientError`: 연결·시간 초과·5xx)는 6회, 응답 계약 위반(`ParseError`)과 코드로 거절한 오류(`isCodedError`)는 0회, 그 밖은 3회다.

## 오류 클래스

모든 앱 오류는 `core/errors/app-error.ts`의 `AppError`를 잇는다. 이름은 `override readonly name = '…'` 필드 하나, 원인은 생성자 마지막 인자 `{ cause }`다(Hermes가 `Error`의 `cause` 옵션을 무시할 수 있어 `AppError`가 직접 대입한다). HTTP 상태 필드 이름은 `status` 하나다.

| 클래스                | 위치                              | 모양                                                                                        | 사용자 문구                                                      |
| --------------------- | --------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `ApiError`            | `core/errors/api-error.ts`        | `code: ErrorCodeType`, `status`, `details: Record \| null`, `requestId`, `hasCode(code)`    | 카탈로그 → 서버 message → `errors:fallback`                      |
| `ServerError`         | `shared/errors/infra-error.ts`    | `status`, `serverCode: ErrorCodeType \| null`, `details`, `requestId`, `request`            | 아는 `serverCode`면 카탈로그, 아니면 `common:infraErrors.server` |
| `NetworkError`        | 〃                                | 상태 없음                                                                                   | `common:infraErrors.network`                                     |
| `TimeoutError`        | 〃                                | 상태 없음(응답이 오지 않았다)                                                               | `common:infraErrors.timeout`                                     |
| `ParseError`          | 〃                                | 개발용 message                                                                              | `getUserFacingMessage`가 숨긴다(폴백 문구)                       |
| `BusinessError`       | `shared/errors/business-error.ts` | `code`(앱 코드)                                                                             | `errors` 카탈로그의 코드 키                                      |
| `KeychainLockedError` | `shared/errors/storage-error.ts`  | `cause`(원본)                                                                               | —                                                                |
| 포트 오류             | `core/ports/*`                    | `ClipboardCopyError`·`LocationUnavailableError`·`PurchasesGatewayError`. SDK 원본은 `cause` | —                                                                |

- 5xx 코드는 `ServerError.serverCode`다. `code`로 두지 않는다. `code`가 있으면 `isCodedError`가 참이 되어 예상한 4xx처럼 재시도·보고에서 빠진다.
- 일반 `throw new Error`는 Context 가드(`must be used within …`)와 어댑터의 환경 오류(모듈 없음)만 쓴다. SDK 오류는 어댑터·mapper 경계에서 코드 없는 포트 오류나 `BusinessError`로 바꾸고 원래 SDK 코드는 진단용으로만 남긴다(`subscription-error.mapper.ts`의 `toSubscriptionError`).

## 분류는 KyHttpClient 한 곳

[`shared/infra/http/ky-client.ts`](../src/shared/infra/http/ky-client.ts)의 `#request`가 HTTP 결과를 위 흐름대로 바꾼다. `{Entity}Api`와 Device Service는 `Result`를 돌려주고, `queryFn`·`mutationFn`은 반드시 `unwrap()`한다(React Query는 throw가 없으면 성공으로 본다).

- 실패 봉투는 [`error-envelope.ts`](../src/shared/infra/http/error-envelope.ts)의 `readErrorEnvelope` 하나가 읽는다. `errorEnvelopeSchema`에서 `error`만 골라 게이트웨이 응답처럼 `success`·`timestamp`·`message`가 없어도 `code`가 있으면 읽는다. `ky-error`, 실패 breadcrumb, 토큰 갱신 판정이 같이 쓴다.
- 4xx 문구는 서버가 보낸 코드 그대로 `errors` 카탈로그 → 서버 message(요청 언어로 번역됨) → `errors:fallback` 순서다(`resolveMessage`). 앱이 모르는 코드도 분기용 `code`만 `SYS_0001`이고 문구는 서버 message다. 봉투가 아닌 4xx는 폴백이다.
- `parseApiResponse`는 응답 스키마 실패와 mapper(`toModel`)의 `ZodError`를 모두 `ParseError`로 던진다. 계약 위반은 이슈가 되고 재시도하지 않는다.
- afterResponse 훅([`api-failure-breadcrumb.ts`](../src/shared/infra/http/api-failure-breadcrumb.ts))은 관측만 한다(`http` breadcrumb, 서버가 보낸 코드 그대로). 분류하면 5xx가 재시도하지 않는 `ApiError`로 둔갑한다. 재시도는 React Query가 소유한다(ky `retry: 0`).

## 기능 오류: domains/{feature}.error.ts

- 서버 오류와 앱 코드는 `domains/{feature}.error.ts`의 이름 있는 판별 함수(`isLocationNotRegisteredError`)로만 읽는다. 코드 표(`{FEATURE}_ERROR_CODE`), `isXxxError`, `ErrorCode` → 폼 칸 매핑도 이 파일에 둔다. 파일이 없으면 만든다.
- 판별은 `ErrorCode`로 한다(`error.hasCode(ErrorCode.TODO_0801)`). 상태로 판별하는 것은 코드가 없는 경우(검증·없는 route·throttler 429)뿐이고 `HttpStatus`를 쓴다. 5xx는 `serverCode`로 판별한다.
- `details`는 공유 스키마(`quotaErrorDetailsSchema` 등)로 `safeParse`한다. 운영에는 `PUBLIC_ERROR_DETAILS`에 등록한 코드만 실리므로 새로 읽는 코드는 계약에 먼저 등록한다.
- lint가 `*.error.ts` 밖의 `isApiError`·`isCodedError` import, `.hasCode`, 오류 값의 `.status`·`.statusCode`·`.details`·`.serverCode`를 막는다(`aido/no-error-field-access`, [가드레일](./architecture/guardrails.md)). 공용 분류(`shared/errors`, 재시도, 경계)만 예외다.
- 앱이 판단한 거절은 Device Service·Policy가 `err(new BusinessError(코드))`로 돌려준다. 문구는 `errors` 카탈로그의 코드 키(ko·en)로 `getUserFacingMessage`가 고른다. 하위 클래스가 필요하면 `SubscriptionError`처럼 확장한다. `SubscriptionError`의 `SUBSCRIPTION_*` 8코드는 예외로 `errors` 카탈로그에 없다. 결제·복원은 `errorFeedback: false`이고 화면 문구(제목·설명·문의)를 `subscription-failure.view-model`이 고르기 때문이다.

## mutation 오류 피드백

모든 mutation 옵션은 `meta.errorFeedback`을 하나 둔다. 타입은 `shared/constants/query-meta.ts`가 TanStack `Register`로 등록한다.

```typescript
errorFeedback: { feature, fallbackKey?, isHandledByFeature?, describe? } | false
```

| 값                                        | 전역이 하는 일                                                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `{ feature, fallbackKey? }`               | 햅틱 한 번, `toast.error(getUserFacingMessage(error), { fallback: t(fallbackKey ?? 'errors:fallback') })` 한 번, 예상하지 못한 오류만 보고 |
| `describe(error)`                         | 위 토스트의 둘째 줄. 미차감 안내처럼 기능만의 설명은 `false` 대신 객체에 둔다                                                              |
| `isHandledByFeature(error)`가 true인 오류 | 아무것도 하지 않는다. 기능 `onError`(코드별 안내·이동·한도 시트)나 호출부 `form.setError`가 보인다                                         |
| `false`                                   | 전역은 아무것도 하지 않는다. 실패 이유마다 안내가 다르거나(결제·복원, 음성 계획) 화면 뒤 작업(로그아웃, 푸시 기기 보고)이다                |

`false`인 mutation과 여러 요청을 묶은 일괄 작업(날씨 일괄 옮기기)은 전역과 같은 본체 `useMutationErrorFeedback()`(`bootstrap/query/mutation-error-feedback.tsx`)로 햅틱·토스트·보고를 한 번에 한다. 토스트만 직접 띄우면 예상하지 못한 실패가 Sentry에 남지 않는다.

```typescript
const showMutationError = useMutationErrorFeedback();
// onError 안에서. 제목·설명은 기능이 정하고 보고는 예상하지 못한 오류만 한다
showMutationError(error, {
  feature: 'voice',
  title: t(`voicePlan:failure.${cause}.title`),
  description: t(`voicePlan:failure.${cause}.description`),
});
```

- **어디서 도나.** 앱 `MutationCache`(`mutation-error-feedback-cache.ts`)의 캐시 단계 `onError`가 실패를 내보내고, Provider 안에 한 번 둔 `MutationErrorFeedback`이 받아 `useMutationErrorFeedback` 본체로 알린다. 토스트·햅틱이 Provider 안의 훅이라 캐시가 직접 부르지 못한다. 테스트의 `createTestQueryClient`·`renderScreen`도 같은 캐시와 컴포넌트를 쓴다.
- **왜 `MutationCache.subscribe`가 아닌가.** TanStack은 `await options.onSettled`가 끝난 뒤에야 `error` 상태를 알린다. 재조회를 기다리는 `onSettled`(카테고리 순서, 모두 읽음, 댓글 삭제)는 오프라인이면 멈춰 토스트가 끝내 뜨지 않는다. 캐시 단계 `onError`는 기능 `onError`·`onSettled`보다 먼저 돌아, 기능이 보일 오류는 미리 `isHandledByFeature`로 알려야 한다.
- **기능 `onError`.** 낙관적 갱신을 되돌리고, 이미 지워진 대상은 캐시에서 빼고, `isHandledByFeature`로 뺀 오류만 보인다. 서버가 확정한 실패의 분석 이벤트만 함께 둔다. 다시 던지지 않는다.
- **칸 오류.** 특정 칸에 속한 4xx(이미 쓴 이메일, 없는 초대 코드)는 `*.error.ts`의 판별 함수를 `isHandledByFeature`에 넘겨 전역 토스트를 끄고, 폼을 가진 호출부가 `form.setError(칸, { message: getUserFacingMessage(error) ?? … })`로 보인다.
- **호출부.** `mutateAsync`의 실패는 이미 알렸으므로 `.catch(noop)`이나 흐름만 잇는 `catch`로 받는다. 저장 실패는 입력값과 화면을 그대로 둔다.
- **로그아웃.** `abandonPendingMutations`가 진행 중인 mutation의 콜백을 비우고 `errorFeedback`을 `false`로 바꿔, 끝난 세션의 실패가 다음 화면에 뜨지 않는다.
- 대체 문구 키는 `errors:fallback` 하나다. `common:errorBoundary.title`은 같은 글이지만 경계 화면의 제목이라 따로 둔다.
- `aido/mutation-error-feedback`이 `queries/*.mutations.ts`에서 `errorFeedback` 누락, 전역 피드백과 겹치는 `onError`의 햅틱·토스트, `useReportUnexpectedError` import를 막는다. lint가 보지 않는 컴포넌트의 `useMutation({ … })`은 개발 빌드가 `query-cache.error-feedback.missing` warn으로 알린다.

## 조회 오류

[`QueryErrorBoundary`](../src/shared/ui/query-error-boundary/query-error-boundary.tsx)는 `classifyError(error).kind`로 보고를 나눈다.

| kind           | 대상                                                           | 보고                                    | 화면                                     |
| -------------- | -------------------------------------------------------------- | --------------------------------------- | ---------------------------------------- |
| `auth-expired` | 401 ApiError                                                   | warning 메시지                          | 앱 경계가 로그인으로 보낸다              |
| `expected`     | 그 밖의 4xx(404 없음, 403 볼 수 없음·기능 꺼짐), BusinessError | `http` breadcrumb(코드·상태)            | 기능 fallback이 `*.error.ts` 판별로 안내 |
| `connectivity` | 네트워크·타임아웃                                              | `network` breadcrumb(warning)           | fallback(다시 시도 + 문의하기)           |
| `unexpected`   | 5xx·파싱·렌더 오류 등                                          | `reportUnexpectedError`(요청 태그 포함) | fallback(다시 시도 + 문의하기)           |

- 독립된 데이터 블록마다 `QueryErrorBoundary → Suspense → 블록`을 둬 부분 실패를 허용한다. 식별자가 바뀌면 `resetKeys`로 이전 실패를 푼다. mutation은 경계로 가지 않는다(`throwOnError` 미사용).
- 기능 fallback은 `fallback={X.Error}`로 잇고 버튼 자리에 `QueryErrorActions`(다시 시도 + 문의하기)를 둔다. 한 칸 안의 실패는 `QueryErrorFallback.Inline`이다.
- 문의하기는 경계가 받은 오류의 진단 코드·오류 코드·요청 ID(`getErrorDiagnosis`, 4xx·5xx 모두)를 본문 첫 줄에 담아 문의 화면을 연다. 사용자·기기 식별자와 오류 문구는 넣지 않는다. route 시트 안에서는 `onInquiry`가 받은 `href`로 `sheet.close({ type: 'replace', href })`한다([QueryErrorBoundary 문서](../src/shared/ui/query-error-boundary/query-error-boundary.md)).
- **경계 밖 조회.** 인라인 `useQuery`의 `isError` 화면과 데이터가 있는 재조회 실패는 경계로 가지 않는다. 앱 `QueryCache`의 `onError`(`query-error-report-cache.ts`)가 받아 `QueryErrorReport`가 `feature: query_cache`로 보고한다. 데이터 없이 실패한 `useSuspenseQuery`는 경계로 가므로 건너뛰고(TanStack `defaultThrowOnError`와 같은 조건), 같은 오류 객체가 두 길로 와도 `captureError`가 한 번만 보낸다. 기능이 조회 실패를 다시 보고하지 않는다.
- **조회에서 예상한 상태.** 경계로 던지지 않고 값으로 캐시에 둔다. 구독 요금제 조회는 `toOfferingsAvailability`로 `{ status: 'available' | 'unavailable' }`를 두고, 요금제 자리가 안내를 보일 때 `useReportStoreUnavailable`로 관측한다(설정 문제는 error, 일시 문제는 warning 메시지).

## 보고

보고 API는 `captureError` 한 길이고 입구는 둘이다. 둘 다 `classifyError`로 이슈·breadcrumb를 정하고 같은 오류 객체는 한 번만 보낸다([관측](./observability.md#오류-분류와-한-번만-보고)).

| 입구                                                   | 쓰는 곳                                                                                  | 예상한 오류         |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------- |
| `reportUnexpectedError(errorReporter, error, feature)` | 전역 mutation·조회 보고, 경계, `useReportUnexpectedError`(기기 작업 등 mutation·조회 밖) | 보내지 않는다       |
| `logger.error(KEY, toError(error), context)`           | DI 밖 코드, 로그 키로 기능을 밝히고 문맥(`speech_error` 등)을 남기는 곳                  | breadcrumb로 남긴다 |

- 서비스는 삼킨 실패를 `logger.warn(KEY, { error: getErrorMessage(error) })`로만 남긴다. 예측 가능한 4xx는 이벤트가 아니다.
- RN 브릿지·SDK는 `Error`가 아닌 값을 던지기도 한다. 보고에는 `toError`(원본은 `cause`), 로그 문맥에는 `getErrorMessage`를 쓴다. `new Error(String(error))`는 객체를 `[object Object]`로 만든다.
- 삼키는 자리는 이유를 적는다. 확인 다이얼로그는 `onConfirm`(mutation)이 전역 피드백으로 이미 알려 실패를 삼키고 다이얼로그를 남긴다. 클립보드 실패(`ClipboardCopyError`)는 로그 키의 기능으로 보고한다.

## 오프라인

연결 감지는 `NetworkStatusGateway`(expo-network) → `OnlineManagerProvider` → React Query `onlineManager` 한 곳이다. 기본 `networkMode: 'online'`이라 오프라인이면 쿼리·뮤테이션이 멈추고(`paused`) 다시 연결되면 이어서 실행된다.

| 상황                 | 화면                                             | 관측                                |
| -------------------- | ------------------------------------------------ | ----------------------------------- |
| 오프라인             | 루트 `OfflineBanner` 하나, 블록은 로딩·캐시 유지 | 전환마다 `network` breadcrumb 한 번 |
| 온라인인데 연결 오류 | 블록 fallback(다시 시도 + 문의하기)              | `network` breadcrumb(warning)       |
| 온라인인데 5xx·파싱  | 블록 fallback(다시 시도 + 문의하기)              | 이슈                                |

- 경계는 연결 상태를 `resetKeys`에 더해 오프라인 전환·복귀 때 오류 화면을 풀고 다시 불러온다.
- `networkMode: 'always'`는 기기 안에서만 처리하는 작업(앱 아이콘, 클립보드, 알림 권한, 공유)과 로그아웃, 그리고 멈췄다가 나중에 실행되면 안 되는 쓰기(메모 저장·삭제·할 일 변환, 결제·복원, 음성 정리·계획 적용, AI 동의)다. 오프라인 저장은 바로 실패해 토스트가 한 번만 나온다.
- 로그아웃은 오프라인이면 서버 요청 없이 토큰만 지우고, 온라인이면 요청마다 짧은 `timeout`을 건다(`logOutDevice`).
- 구독 화면의 혜택은 스토어 응답 없이 그린다. 오프라인이면 요금제 자리에 「연결되면 보여드릴게요」 안내를 보이고 결제·복원 버튼을 이유와 함께 잠근다.

### 조회 캐시 보관

오프라인으로 앱을 다시 열어도 마지막 데이터를 보이도록 opt-in한 조회(`...PERSISTED_QUERY_OPTIONS`)만 AES-256 MMKV `aido.query-cache.encrypted`에 24시간 보관한다. 토큰·결제·배지 수·AI 제안은 보관하지 않는다.

- 키를 읽지 못한 실행은 `query-cache.encrypted-storage.unavailable` warn만 남기고 저장하지 않는다. 복원한 값은 `meta.persist`의 모델 스키마로 검증해 깨진 조회만 버리고(`query-cache.restored-queries.dropped`) 복원 직후 전체를 invalidate한다.
- 로그인한 사용자 키에만 쓰고(`useClaimDeviceDataForUser`), 미인증 전환 때 `SessionCleanupService`가 인스턴스를 통째로 비운다(`clearAll` + `trim`). 앱 버전·OTA가 바뀌면 버린다. 저장소를 열지 못한 실행의 세션 종료는 정리 표시(`aido_session_pending-storage-cleanup_v1`)를 남겨 다음에 열 때 지운다.
- 로그아웃·탈퇴 뒤 늦게 온 초안 저장·녹음 파일은 `SignOutEpoch`와 비교해 버린다. 세션 만료는 같은 사람이 이어 쓰므로 남긴다.

## 저장소 오류: KeychainLockedError

`KeyValueStorage.get()`은 값이 없으면 `null`, 기기 잠금으로 지금 못 읽으면 `KeychainLockedError`, 영구 오류(키체인 손상·entitlement 오설정)면 원본, 저장 값 파싱 실패면 `null`이다. "지금 못 읽음"을 "토큰 없음"으로 확정하면 잠긴 키체인이 로그아웃이 되고, 모든 읽기 실패를 잠김으로 뭉개면 무한 로딩에 갇힌다. 벤더 판별(OSStatus 메시지)은 `secure-storage.ts`에만 두고 `resolve-initial-auth-status.ts`는 `isKeychainLockedError()`만 안다. 경계로 보내지 않는다.

## 참고 파일

| 파일                                                          | 설명                                             |
| ------------------------------------------------------------- | ------------------------------------------------ |
| `core/errors/{app-error,api-error,result}.ts`                 | 오류 바탕·ApiError·Result                        |
| `shared/errors/classify-error.ts`                             | 분류                                             |
| `shared/errors/report-unexpected-error.ts`                    | 예상하지 못한 오류 보고·요청 태그                |
| `shared/errors/{infra-error,business-error,storage-error}.ts` | 오류 클래스                                      |
| `shared/errors/{user-facing-message,error-diagnosis}.ts`      | 사용자 문구, 진단 값                             |
| `shared/infra/http/{ky-client,ky-error,error-envelope}.ts`    | HTTP 결과 변환, 실패 봉투                        |
| `bootstrap/query/mutation-error-feedback*`                    | mutation 전역 피드백, `useMutationErrorFeedback` |
| `bootstrap/query/query-error-report*`                         | 경계 밖 조회 보고                                |
| `bootstrap/query/query-retry.ts`                              | 재시도                                           |
| `shared/ui/query-error-boundary/`                             | 경계, fallback, 문의 초안                        |
| `features/*/domains/*.error.ts`                               | 기능 오류                                        |
