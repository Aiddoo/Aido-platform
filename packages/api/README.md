# @aido/api

서버(`@aido/server`)와 모바일(`@aido/mobile`)이 공유하는 REST 계약 패키지다. Zod 4 스키마와 그로부터 추론한 타입, 오류 코드, 순수 공용 값만 담고 NestJS·ORM·React Native에 의존하지 않는다. 모노레포에서의 역할은 [루트 README](../../README.md#서버클라이언트-타입-공유)를 참고한다.

## Entry point

| Import                               | 내용                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------- |
| `@aido/api/contracts/<feature>/v<n>` | 기능·버전별 요청·응답 Zod 스키마와 inferred type                                    |
| `@aido/api/common`                   | envelope(`response.ts`)·pagination·datetime·entity-id schema                        |
| `@aido/api/errors`                   | `ErrorCode`, HTTP 상태, 오류 응답 정의, 공개 details schema(`toPublicErrorDetails`) |
| `@aido/api/vocabulary`               | Zod 없이 쓰는 순수 상수 튜플·union type                                             |

루트 `@aido/api`와 버전 없는 `contracts/<feature>` 진입 파일은 없다. 루트 import는 서버·앱 dependency-cruiser `aido-api-subpath-only`가 막는다. `z`는 `zod`에서 가져온다.

## 작성 규칙

- `src/contracts/<feature>/v<n>/`는 `<feature>.request.ts`, `<feature>.response.ts`, 필요하면 `<feature>.common.ts`로 나누고 공개 진입 파일 `index.ts`를 둔다. 버전 폴더는 출시 앱 계약이 갈라질 때만 더한다. 버전은 경로에만 두고 이름에 `V2`를 붙이지 않는다.
- 서버·앱이 함께 아는 값 목록(상태·종류·언어·한도)은 `src/vocabulary/`의 `as const` 튜플 한 곳에 둔다. vocabulary에는 Zod를 넣지 않는다.
- 저장소 Entity나 ORM row를 공유 REST 타입으로 쓰지 않는다. HTTP 검증과 날짜 변환은 서버 presentation이 맡는다.
- PATCH에서 빠진 필드는 기존 값을 유지하고, nullable 필드의 `null`은 값을 비운다. `false`와 `0`은 유효한 값이다([nullish](../../docs/conventions/nullish.md#4-계약-aidoapi-zod)).
- 설명은 `.meta({ description })`, 정수는 `z.int()`로 쓴다. 스키마를 옮길 때 required/optional/nullish/default, 검증 메시지, 설명, 날짜 표현을 바꾸지 않는다. 배포된 앱의 OpenAPI fixture는 현재 스키마로 재생성하지 않는다.
- 서버와 앱이 각자 구현한 규칙은 `test/fixtures/`의 표를 양쪽 테스트가 읽어 맞춘다(`repeat-occurrence-cases.json`·`repeat-last-occurrence-cases.json`: 서버 `RepeatRule`, 앱 `TodoRepeatPolicy`). `test/`는 `dist`와 패키지 `files` 밖이라 번들에 들어가지 않는다.

상세: [HTTP 계약](../../apps/api/docs/http-contracts.md), [호환](../../docs/conventions/compatibility.md), [오류](../../docs/conventions/errors.md)

## 명령어

`pnpm install`의 `postinstall`이 이 패키지를 먼저 빌드한다. 서버·앱은 `dist`를 읽으므로 스키마를 바꾸면 다시 빌드하고 서버 계약 테스트로 공개 계약을 확인한다. 루트 `pnpm dev`는 이 패키지의 `dev`(`tsc --build --watch`)도 함께 돌려 `dist`를 다시 만든다.

```sh
pnpm --filter @aido/api build          # tsc --build → dist/
pnpm --filter @aido/api dev            # tsc --build --watch
pnpm --filter @aido/api test           # Vitest
pnpm --filter @aido/server test:contract
```
