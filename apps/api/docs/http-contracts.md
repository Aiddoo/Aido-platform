# HTTP 계약

Controller·DTO·Zod schema·응답 매퍼·페이지네이션·Swagger·요청 헤더를 바꿀 때 읽는다. 공유 계약 패키지는 [packages/api](../../../packages/api/README.md), 응답·오류 envelope는 [오류 규칙](../../../docs/conventions/errors.md), 출시 앱 호환 범위는 [호환](../../../docs/conventions/compatibility.md)이다.

## 경계와 소유

| 경계                   | 소유                                                                 |
| ---------------------- | -------------------------------------------------------------------- |
| `@aido/api`            | 요청·응답 Zod schema, inferred type, 성공 envelope, 공용 pagination  |
| `@aido/api/errors`     | 안정된 오류 code·HTTP 오류 계약·공개 details                         |
| `@aido/api/vocabulary` | Zod·HTTP·ORM 없는 순수 상수·튜플                                     |
| presentation           | DTO 검증, DTO → Command 변환(문자열 → Temporal 포함), 응답 매핑·문구 |
| Application·Domain     | 계약 타입을 모른다(lint로 막는다)                                    |

## Controller

- Controller는 guard·Swagger·DTO 검증, 원시값의 Command 변환, 결과의 HTTP 매핑만 한다. Repository·SDK·트랜잭션·업무 판단을 두지 않는다. UseCase를 직접 주입한다.
- `@Controller({ path, version: API_VERSION.V1 })`처럼 v1도 명시한다. v2는 계약이 갈라질 때만 `http/v2/`에 둔다. 사례: [MemoController](../src/modules/notes/memos/presentation/http/v1/memo.controller.ts).
- 공용 데코레이터는 `platform/http/decorators`(`@Timezone`·`@Locale`·`@IdempotencyKey`·`@RawResponse`·`@ClientAbortSignal`)와 `platform/http/request-client`(`@AppVersion`·`@CurrentRequestClient`)에 있다. 인증(`@CurrentUser`·`@Public`·`@Admin`)은 identity auth가 `identity-auth-http.public.ts`로 연다.

## 요청 헤더와 throttle

앱 헤더는 요청마다 한 번 `RequestClient`(`platform/http/request-client`)로 정규화한다. Controller에서 `@Headers("x-…")`를 쓰지 않는다. 새 헤더는 `RequestClient`에 정규화 규칙과 함께 더한다.

| 필요한 값                     | 사용                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| 앱 버전(SemVer, 없으면 구 앱) | `@AppVersion()`. 비교는 `isSemanticVersionAtLeast`                                    |
| 플랫폼·빌드·OS·기기명·언어    | `@CurrentRequestClient()`, `@Locale()`([다국어](i18n.md))                             |
| 시간대                        | `@Timezone()`([날짜 규칙](../../../docs/conventions/dates.md#2-오늘과-시간대의-출처)) |
| Controller 밖(guard 등)       | `RequestClientReader.current()`                                                       |

- `X-Request-Id`는 UUID면 그대로, 아니면 새 UUID를 쓰고 응답 헤더로 돌려준다([관측](observability.md#http-로그와-요청-id)).
- throttle은 전역 `UserAwareThrottlerGuard`다. 한도는 Controller 옆 이름 있는 상수(`AUTH_THROTTLE.LOGIN`처럼 `{ ttl, limit }`)이고, 인증 전은 IP, 사용자별은 `@ThrottleByUser()` + `@Throttle`이다. 출시된 endpoint의 새 한도는 `@ApiDoc` description 문장으로 적는다.

## Schema와 DTO

- `packages/api/src/contracts/<resource>/v<n>/`의 `*.request.ts`·`*.response.ts`·`*.common.ts`가 schema를 소유한다. 타입은 `z.infer`로만 얻는다.
- 서버 DTO는 `http/v1/<noun>.dto.ts` 한 파일에 그 컨트롤러의 `X = schema.meta({ id: "XDto" })`와 타입을 모은다([memo.dto.ts](../src/modules/notes/memos/presentation/http/v1/memo.dto.ts)). Swagger component id는 바꾸지 않는다. 파일을 합칠 때 옛 파일을 같은 커밋에서 지운다(같은 id가 두 번 등록되면 `toJSONSchema`가 실패한다).
- Zod 4 문법: 조합은 `.pick`/`.omit`/`.extend`/`.partial`만(`.merge` 금지). 외부 원문은 `z.looseObject`, 내부 계약은 `z.object`, 닫힌 내부 payload는 `z.strictObject`. 오류 옵션은 `{ error }`다.
- `.describe()`·`.meta()`는 공개 Swagger 계약이다. 새 필드는 단위·시점·nullable 의미를 적는다.
- required/optional/nullable/default와 검증 메시지는 계약이다. 리팩터링 중 바꾸지 않는다. 기존 한국어 검증 문구도 유지한다(앱은 `SYS_0002`로 현지화).

## 응답

- 응답 envelope(`{ success, data, timestamp }`, `ResponseTransformInterceptor`)와 오류 envelope는 그대로다.
- 서버가 계산한 값을 싣는다. AI 응답과 한도 오류는 `featureQuota`를 준다. 앱이 읽지 않는 값은 새 응답에 넣지 않는다(출시 뒤에는 뺄 수 없다). 그런 값은 서버 로그에 남긴다.
- 날짜는 `YYYY-MM-DD`, 순간은 ISO datetime(ms 3자리, `toIsoString`), 벽시계는 `HH:mm`이다. 변환은 응답 매퍼 한 곳이다.
- 변경 응답의 `message`는 출시 계약이라 유지하되 문구는 presentation 매퍼 상수(`MEMO_RESPONSE_MESSAGES`)에 둔다. 새 응답에는 넣지 않는다.
- 운영 응답에 실을 details는 `PUBLIC_ERROR_DETAILS`에 코드별 Zod로 등록한다.

## 응답 계약 검사

배포 환경이 운영이 아니면(로컬 실행·테스트·개발서버·staging, `appConfig`의 `responseContractCheck`) [configureApplication](../src/platform/http/configure-application.ts)이 [`ResponseContractInterceptor`](../src/platform/http/interceptors/response-contract.interceptor.ts)를 전역으로 더한다. 운영에는 요청마다 parse하는 비용을 피하려고 등록하지 않는다([설정](configuration.md#배포-환경)).

- `@ApiSuccessResponse`·`@ApiCreatedResponse`가 Swagger에 등록한 바로 그 Zod schema로, 실제 상태 코드의 body를 JSON으로 바꾼 뒤(`@RawResponse`가 아니면 envelope 포함) `safeParse`한다. 응답 값은 바꾸지 않는다.
- 다르거나 선언한 성공 상태와 다른 상태로 응답하면 `http.response-contract.violated` 로그(handler·path·Zod issues)를 남기고 500(`SYS_0001`)으로 실패한다. 그래서 E2E가 선언과 다른 응답을 바로 잡는다.
- Zod가 아닌 선언(class `type`, OpenAPI `schema` 객체)과 `@Res()`로 직접 보낸 응답은 검사하지 않는다. 친구·카테고리 한도 응답의 class DTO는 Zod로 옮기면 제약 없는 nullable 숫자가 `nullable: true` 대신 `type: ["number", "null"]`이 되어 released 지문이 달라지므로 그대로 둔다.
- 실패는 서버 응답을 출시 계약에 맞추거나, 선언이 틀렸으면 선언을 고쳐서 없앤다. 출시 계약과 released fixture는 바꾸지 않는다.

## 페이지네이션

- 새 목록은 [`cursorPageSchema(item, cursor)`](../../../packages/api/src/common/pagination.ts)(`@aido/api/common`)가 만드는 `{ items, pagination: { nextCursor, hasNext, size } }`만 쓴다. 페이지 크기 이름은 `size`다. 할 일·친구 할 일·메모·주간 성취 목록이 이 helper를 쓴다.
- 출시 계약을 helper로 옮길 때는 그 계약의 설명 문구를 세 번째 인자로 넘겨 생성된 JSON Schema를 바이트 단위로 같게 두고, OpenAPI 지문으로 확인한다.
- 다른 모양의 출시 계약(알림·친구·응원·찌르기·초대·댓글)은 그대로 두고, 서버 내부는 `CursorPage`로 통일한 뒤 매퍼가 옛 모양을 만든다.
- 서버가 발급한 문자열 ID는 [`entityIdSchema`](../../../packages/api/src/common/entity-id.ts)로 검증한다(`z.cuid()` 금지). 모양 규칙은 `@aido/api/vocabulary`의 `ENTITY_ID_PATTERN` 하나이고 서버 도메인은 `isEntityId`로 같은 규칙을 쓴다.
- 문자열 커서는 서명한다. 댓글 커서는 [HmacTodoCommentCursorCodecAdapter](../src/modules/engagement/comments/infrastructure/adapters/hmac-todo-comment-cursor-codec.adapter.ts)가 `CURSOR_SIGNING_KEYS` key ring으로 서명한다([보안](security.md#서명-키-회전)). 숫자 커서 계약은 숫자를 유지한다.

## 타입 안전 체크리스트

| 경계              | 보장                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------ |
| HTTP 입력         | 공유 Zod + 전역 `StandardSchemaValidationPipe`. 인자 타입은 `z.infer`                      |
| HTTP 출력         | 반환 타입이 계약 DTO 타입. 운영 밖에서는 [응답 계약 검사](#응답-계약-검사), E2E도 `.parse` |
| 외부 API          | `*.wire.ts` Zod `parse`([외부 호출](outbound.md))                                          |
| 큐·이벤트 payload | `defineQueue`·이벤트 schema([작업과 이벤트](jobs-and-events.md))                           |
| 환경변수          | `defineConfig`·config schema Zod([설정](configuration.md))                                 |
| DB 행             | `$inferSelect`/`$inferInsert` + Temporal customType, 행 → 도메인은 매퍼 한 곳              |
| DI                | abstract class 토큰 + `provideUseCase`                                                     |
| 분기              | 유니온은 ts-pattern `.exhaustive()`                                                        |
| 금지              | `as`(`as const` 제외)·`any`·`!`·`@ts-*`. 예외는 `provideUseCase` 내부 1곳(사유 주석)       |

## 출시 앱 호환 절차

출시된 operation의 상태 코드·필수 입력·기존 필드는 바꾸지 않는다. released OpenAPI fixture(`test/e2e/fixtures/released-*-openapi-contract.ts`)와 [OpenAPI 계약 테스트](../test/e2e/openapi-contract.e2e-spec.ts)(`test:contract`)가 막는다. 필드·파라미터를 더해야 하면:

1. 생략했을 때 동작이 지금과 정확히 같은 optional만 더한다.
2. fixture에 이전 지문을 `pre<변경>SchemasFingerprint`·`pre<변경>PathsFingerprint`로 사유 주석과 함께 남기고 현재 지문을 갱신한다.
3. 출시 앱 요청 모양으로 보낸 E2E로 동작을 증명한다.

고정된 released fixture를 현재 schema로 재생성하지 않는다. 서버는 `@aido/api`의 `dist` 타입을 읽으므로 `packages/api`를 바꾸면 서버 타입 검사 전에 `pnpm --filter @aido/api build`를 돌린다. Swagger 설명은 지문에서 빠지므로 코드와 다른 설명(정렬 방향 등)은 바로 고친다.
