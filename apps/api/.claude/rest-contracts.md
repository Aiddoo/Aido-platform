# 공유 REST 계약

요청·응답·Zod·HTTP mapper를 바꿀 때 참고한다. 공유 계약의 정본은 [packages/api](../../../packages/api/README.md)다. 서버 패키지는 `@aido/server`, 계약 패키지는 `@aido/api`다.

## 경계와 소유

| 경계                   | 소유                                               |
| ---------------------- | -------------------------------------------------- |
| `@aido/api`            | 요청·응답 Zod schema, inferred type, 성공 envelope |
| `@aido/api/errors`     | 안정된 오류 code·HTTP 오류 계약·공개 details       |
| `@aido/api/vocabulary` | Zod·HTTP·ORM 없는 순수 상수·union                  |
| Domain                 | 내부 값·상태·순수 업무 판단                        |
| Application            | 업무 입력·read model·흐름·locale별 콘텐츠 조립     |
| Presentation           | HTTP DTO 검증, 원시값 변환, 공개 응답 매핑         |

Domain에 HTTP DTO나 transport serialization을 넣지 않는다.

## Schema와 서버 DTO

- `packages/api/src/contracts/<context>/v<n>/`의 `<name>.request.ts`, `<name>.response.ts`, `<name>.common.ts`가 schema를 소유한다. 타입은 `z.infer`로만 얻는다.
- 서버와 앱이 함께 쓰는 값(반복 빈도, 수정 범위, 플랜 숫자)은 `packages/api/src/vocabulary`에 두고 `z.enum(튜플)`로 쓴다. 서버 안에 같은 리터럴을 다시 정의하지 않는다.
- 서버 DTO는 공유 schema의 meta와 type alias다. `@Body/Query/Param({ schema: Dto })`로 검증한다. Nest DTO class를 공유 패키지에 넣지 않고 ORM 타입에서 schema를 파생하지 않는다.
- `.describe()`와 `.meta()`는 공개 Swagger 계약이다. 새 필드는 단위·시점·nullable 의미를 적는다.

## 응답 규칙

- 성공·실패 envelope와 `ErrorCode`는 [오류 규칙](../../../docs/conventions/errors.md)에 있다.
- 서버가 계산한 값을 싣는다. AI 응답과 한도 오류는 `featureQuota`를 준다. 앱이 계산할 재료만 주고 판단을 앱에 넘기지 않는다.
- 앱이 읽지 않는 값을 새 응답에 넣지 않는다. 출시 뒤에는 뺄 수 없다. 1.15.0에서 새 응답의 모델·토큰·프롬프트 버전(`meta`)을 뺀 이유다. 그런 값은 서버 로그에 남긴다.
- 달력 날짜는 `YYYY-MM-DD`, 순간은 ISO datetime·epoch ms, 벽시계는 `HH:mm`이다. mapper가 명시적으로 변환한다([날짜 규칙](../../../docs/conventions/dates.md)).
- E2E는 공유 응답 schema로 실제 body를 `.parse`해 계약과 구현이 어긋나면 실패하게 한다.

## 요청 규칙

- required/optional/nullable/default와 validation 메시지는 계약이다. 리팩터링 중 바꾸지 않는다.
- PATCH의 `undefined`는 미제공, `null`은 초기화다. false·0을 누락으로 처리하지 않는다. 형태는 [nullish 규칙](../../../docs/conventions/nullish.md#4-계약-aidoapi-zod)을 따른다.
- 필수 scalar에 nullish fallback을 덧붙여 잘못된 입력을 감추지 않는다.
- 앱 헤더는 `RequestClient`로 읽는다([요청 헤더](api-conventions.md#요청-헤더와-throttle)). 기본값과 지원 범위도 계약이다. `/v2/weather`가 전 세계 좌표를 받아도 `/v1/weather`의 한국 범위와 `WEATHER_1901`·`1902`는 그대로다.
- 돈이 드는 요청은 `Idempotency-Key`로 재시도를 묶는다([AI](../../../docs/server/ai.md)).

## 오류와 문구

- 공개 오류는 `ErrorCode`·HTTP 상태·details·envelope를 유지하고 `GlobalExceptionFilter`가 변환한다.
- 운영 응답에 실을 details는 `PUBLIC_ERROR_DETAILS`에 코드별 Zod 스키마로 등록한다. 등록하지 않으면 운영에서 사라진다.
- Domain은 번역된 문장을 판정하지 않는다. 기존 한국어 validation 문구는 계약으로 둔다.

## 출시 앱 호환

범위는 [하위 호환](../../../docs/conventions/compatibility.md)에 있다. 출시된 operation의 상태 코드·필수 입력·기존 필드는 바꾸지 않는다(released app OpenAPI fixture가 막는다).

필드·파라미터를 더해야 하면:

1. 생략했을 때 동작이 지금과 정확히 같은 optional만 더한다.
2. fixture의 `pre…Fingerprint`에 이전 값과 사유 주석을 남기고 현재 지문을 갱신한다.
3. 출시 앱 요청 모양으로 보낸 E2E로 동작을 증명한다.

새 throttle 한도 같은 동작 변화는 description 문장으로 적는다. 고정된 released fixture를 현재 schema로 재생성하지 않는다. snapshot 갱신으로 회귀를 감추지 않는다.

## 검증 선택

공유 schema를 바꾸면 영향을 받는 `@aido/api` 테스트와 서버 HTTP·OpenAPI 계약을 고른다. `packages/api`를 바꾸면 서버 타입 검사 전에 `pnpm --filter @aido/api build`를 돌린다(서버는 dist 타입을 읽는다). 실행 명령은 [testing-guide.md](testing-guide.md)에 있다.
