# 공유 REST 계약

정본은 [`packages/api`](../../../packages/api/README.md)다. 실행 서버는 `@aido/server`,
공유 계약은 `@aido/api`이며 NestJS·Prisma 구현을 모바일에 노출하지 않는다.

## 소유와 의존성

- `@aido/api`: 요청·응답 Zod 스키마와 inferred type, 성공 envelope.
- `@aido/api/errors`: 안정된 오류 코드와 HTTP 오류 계약.
- `@aido/api/vocabulary`: Zod·HTTP·ORM 없이 쓰는 순수 상수와 union type.
- 서버 Domain은 내부 상태·VO를 소유한다. HTTP DTO를 Entity로 저장하지 않는다.
- Application은 업무 입력과 read model을 소유한다. Presentation은 공유 요청을 검증하고
  내부 입력으로 변환하며, 저장 결과를 공개 응답에 매핑한다.
- 클라이언트 Service는 공유 스키마로 응답을 검증한 뒤 앱 모델로 변환한다.

## 파일과 검증

`packages/api/src/contracts/<feature>`에 `<feature>.request.ts`, `<feature>.response.ts`,
필요할 때만 `<feature>.common.ts`를 둔다. Zod schema에서 `z.infer`로 공개 타입을 얻는다.
별도 Nest DTO class나 decorator는 공유 패키지에 두지 않는다. 서버 Presentation의 DTO는
schema와 type alias이며 `@Body/Query/Param({ schema: Dto })`로 검증을 명시한다.

새 필드는 API 설명과 실제 소비 의미를 함께 작성한다. `.describe()`는 OpenAPI 계약이다.
기존 field required/optional/nullable/default, 날짜와 epoch milliseconds, validation 메시지를
리팩터링 중 바꾸지 않는다. PATCH `undefined`는 미제공, 허용된 `null`은 초기화이며
`false`·`0`은 누락이 아니다. 필수 scalar에 nullish fallback을 적용하지 않는다.

## 호환성과 다국어

고정된 구 앱 fixture와 OpenAPI fingerprint는 현재 schema로 재생성하지 않는다. 서버·앱
기능 변경에서 기존 오류 코드·HTTP 상태·응답 shape를 먼저 유지한다. Domain은 번역된 문장을
판단하지 않으며 locale별 사용자 메시지는 Presentation이 소유한다. 기존 한국어 validation
메시지는 호환 계약으로 유지하고 언어 확장은 코드 기반 오류 번역 경계에서 다룬다.

## 검증 명령

```sh
pnpm --filter @aido/api test
pnpm --filter @aido/server test:e2e
pnpm lint
pnpm format:check
pnpm typecheck
```
