# 공유 REST 계약

요청·응답·Zod·HTTP mapper를 바꿀 때 참고한다. 공유 계약의 정본은 [packages/api](../../../packages/api/README.md)다. 서버 실행 패키지는 `@aido/server`, REST 계약 패키지는 `@aido/api`다.

## 경계와 소유

| 경계                   | 소유                                               |
| ---------------------- | -------------------------------------------------- |
| `@aido/api`            | 요청·응답 Zod schema, inferred type, 성공 envelope |
| `@aido/api/errors`     | 안정된 오류 code·HTTP 오류 계약                    |
| `@aido/api/vocabulary` | Zod·HTTP·ORM 없는 순수 상수·union                  |
| Domain                 | 내부 값·상태·순수 업무 판단                        |
| Application            | 업무 입력·read model·흐름·locale별 콘텐츠 조립     |
| Presentation           | HTTP DTO 검증, 원시값 변환, 공개 응답 매핑         |

Domain에 HTTP DTO나 transport serialization을 넣지 않는다. Application의 내부 계약을 새로 정리할 때는 공개 응답과의 우연한 결합을 줄이되, 현재 UseCase 중에는 공유 응답 타입을 쓰는 기존 구현도 있다. 이를 문서만으로 이미 분리됐다고 표현하지 않는다.

## Schema와 서버 DTO

`packages/api/src/contracts/<feature>`에서 `<feature>.request.ts`, `<feature>.response.ts`, 필요한 경우 `<feature>.common.ts`가 schema를 소유한다. 공개 타입은 `z.infer`로 얻으며 별도 Nest DTO class/validation decorator를 공유 패키지에 넣지 않는다.

서버 Presentation DTO는 공유 schema의 meta와 type alias다. `@Body/Query/Param({ schema: Dto })`로 runtime 검증을 명시한다. 응답 envelope와 상태는 기존 Controller/platform HTTP 경계를 따른다. schema를 Server ORM 타입에서 자동 파생해 DB 표현을 클라이언트로 노출하지 않는다.

필드의 `.describe()`와 `.meta()`는 실제 공개 설명/Swagger 계약이다. 추가 필드는 단위·시점·nullable 의미와 소비를 함께 설명한다. HTTP input/output mapper는 날짜·epoch·enum 표현을 명시적으로 변환한다.

## 입력과 시간 의미

- required/optional/nullable/default와 validation 메시지는 계약이다. 리팩터링 중 바꾸지 않는다.
- PATCH undefined는 미제공, 허용된 null은 초기화다. false·0을 누락으로 처리하지 않는다.
- 필수 scalar에 nullish fallback을 덧붙여 유효하지 않은 입력을 감추지 않는다.
- `YYYY-MM-DD` calendar label과 instant ISO datetime·epoch milliseconds를 구분한다. process-local Date 파싱으로 사용자 날짜/요일을 이동시키지 않는다.
- timezone·locale header/default와 지원 범위도 계약이다. 예를 들어 전역 좌표 VO가 생겼어도 기존 Weather HTTP의 한국 bbox·1901/1902·fallback 범위가 해외 지원으로 바뀐 것은 아니다.

## 오류·copy·호환

공개 오류는 기존 ErrorCode/HTTP 상태/details/envelope를 유지하고 GlobalExceptionFilter가 변환한다. Domain은 번역된 문장을 판정하지 않는다. 기존 한국어 validation 문구는 현재 계약으로 보존하고, 사용자 표시·AI prompt·notification/email copy는 Application typed catalog 또는 Presentation에서 다룬다.

API 필드를 제거하거나 의미를 바꾸는 작업은 요청 범위와 실제 소비자·배포 전략을 확인한다. 소비가 없는 내부 forwarding alias/helper는 유지 명분이 없으면 제거할 수 있으나, 배포된 구 앱 계약이나 queue/DB 운영 호환과 혼동하지 않는다.

고정된 released app fixture를 현재 schema로 재생성하지 않는다. snapshot 갱신으로 회귀를 감추지 않는다. 의도된 변경은 변경 내용을 검토하고 해당 계약·소비자 검증으로 확인한다.

## 검증 선택

공유 schema를 바꾸면 영향을 받는 `@aido/api` 테스트와 서버 HTTP·구 앱 fingerprint/OpenAPI 사례를 선택한다. 내부 mapper만 바꾸면 실제 경계 값·null/default/error regression을 확인한다. 문구·링크만 바꾸면 코드와 참조 확인으로 충분할 수 있다.

실행 명령과 격리 조건은 [testing-guide.md](testing-guide.md)에 있다. 단순 수정마다 모든 package/E2E/lint/typecheck를 중복 실행하는 고정 recipe를 두지 않는다.
