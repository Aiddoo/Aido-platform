# @aido/api

서버 `@aido/server`와 모바일 `@aido/mobile`이 공유하는 REST 계약이다. 서버 실행 코드와
NestJS·Prisma·React Native 의존성을 포함하지 않는다.

| Entry point                     | 책임                                                |
| ------------------------------- | --------------------------------------------------- |
| `@aido/api`                     | 요청·응답 Zod 스키마와 inferred type, 공통 envelope |
| `@aido/api/errors`              | 기존 오류 코드·HTTP 상태·오류 응답 정의             |
| `@aido/api/vocabulary`          | Zod 없이 사용하는 순수 값·union type                |
| `@aido/api/contracts/<feature>` | 필요한 기능의 요청·응답 스키마                      |

`src/contracts/<feature>`는 `<feature>.request.ts`, `<feature>.response.ts`, 필요하면
`<feature>.common.ts`로 나눈다. 공유하는 값은 `src/vocabulary`에 둔다. 저장소 Entity나
ORM row를 공유 REST 타입으로 대체하지 않는다. 요청 모델에서 HTTP 검증·날짜 변환은 서버의
Presentation이 수행한다.

PATCH의 미제공 필드는 기존 값을 유지하고, nullable 필드의 `null`은 값을 비운다. `false`와
`0`은 유효한 값이다. 스키마를 옮기면서 required/optional/nullish/default, validation 메시지,
`.describe()`와 날짜 표현을 바꾸지 않는다. 배포된 앱의 fixture와 OpenAPI fingerprint는
공유 패키지의 현재 스키마에서 재생성하지 않는다.

```sh
pnpm --filter @aido/api build
pnpm --filter @aido/api test
pnpm --filter @aido/server test:e2e
```
