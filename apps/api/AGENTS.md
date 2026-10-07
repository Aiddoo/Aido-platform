# Aido API

> Version 3.0.0 · Updated 2026-10-07 · Owner: Aido Platform Team

NestJS API 작업의 세션 진입점이다. 이 파일은 우선순위가 높은 규칙만 담는다. 세부 설계는 링크된 문서를 읽고, 구조가 불명확하면 `src/modules/planning`의 현재 코드를 기준으로 판단한다.

## 작업 전 읽기

| 작업                           | 필수 문서                                                |
| ------------------------------ | -------------------------------------------------------- |
| API 구조·의존성                | [.claude/architecture.md](.claude/architecture.md)       |
| Controller·UseCase·도메인 코드 | [.claude/api-conventions.md](.claude/api-conventions.md) |
| Zod DTO·공개 스키마            | [.claude/rest-contracts.md](.claude/rest-contracts.md)   |
| Prisma·트랜잭션·마이그레이션   | [.claude/prisma.md](.claude/prisma.md)                   |
| 테스트                         | [.claude/testing-guide.md](.claude/testing-guide.md)     |
| 로깅                           | [.claude/logging-guide.md](.claude/logging-guide.md)     |
| 배포                           | [DEPLOYMENT.md](DEPLOYMENT.md)                           |

## 정본 구조

```text
HTTP → presentation → endpoint UseCase → domain + application port
                                      infrastructure adapter → DB/Redis/queue/vendor
```

- `domain`: 순수 TypeScript. Aggregate, Entity, VO, Policy, domain event를 소유한다.
- `application`: endpoint 흐름과 consumer-owned port를 소유한다. 순수 TypeScript이며 의존성을 생성자 객체로 받는다.
- `infrastructure`: Prisma, Redis, pg-boss, 외부 SDK, port 구현을 소유한다.
- `presentation`: HTTP DTO 검증, 원시값 변환, Swagger, 응답 매핑을 소유한다.
- Context는 `src/modules/<context>`, 공용 기술 구현은 `src/platform`, 순수 공통 코드는 `src/shared`에 둔다.
- Composition Root의 `*-application.providers.ts`가 factory provider로 순수 Application 클래스를 조립한다.
- Controller는 UseCase를 직접 주입한다. 전달 전용 Facade는 만들지 않는다.
- Port는 DB 내부 호출마다 만들지 않는다. 외부 공급자, 캐시, 큐, 크로스 컨텍스트 capability처럼 교체·격리 가치가 있을 때 만든다.

## 절대 규칙

- 공개 HTTP route/method/header/query/body/response/status를 의도 없이 바꾸지 않는다.
- NestJS 12/Prisma ESM: 상대 import는 `.js`, 내부 경로는 `#api/*`, 테스트는 `#test/*`를 사용한다.
- DTO는 공유 Zod 스키마와 타입 alias이며 `@Body/Query/Param({ schema: Dto })`로 명시한다.
- 테스트는 Vitest project(unit/integration/e2e)이며 `Mocked` 타입은 Vitest에서 import한다. Spy는 `beforeEach`에서 생성한다.
- DTO는 `@aido/api`, 오류는 `@aido/api/errors`의 `ErrorCode`를 사용한다.
- domain에서 `@nestjs/*`, Prisma, application, infrastructure, presentation을 import하지 않는다.
- application에서 Prisma 타입, vendor SDK, infrastructure, presentation, 타 모듈 내부 경로를 import하지 않는다.
- 타 모듈 UseCase나 구현체를 직접 호출하지 않는다. 필요한 최소 capability를 공개 경계로 연결한다.
- 트랜잭션은 `UNIT_OF_WORK.run(async () => ...)`를 사용한다. repository가 CLS의 활성 transaction을 읽는다.
- 단건 상태 전이는 Aggregate가 판단한다. batch update, atomic claim/counter 등 집합 원자성은 명명된 port 뒤 SQL에 둔다.
- 커밋 후 필요한 부수효과만 domain event/queue로 보낸다. enqueue 실패 격리 의미를 임의로 바꾸지 않는다.
- application은 모듈 cache port에 의존한다. 공유 `CacheService`나 전역 `CacheKeys`를 직접 사용하지 않는다.
- Redis key, TTL, queue name, job payload와 retry 의미는 해당 컨텍스트의 infrastructure에 응집한다.
- `as`, non-null assertion, deep import, concrete repository 공개를 추가하지 않는다.

## 명명

- Aggregate: `domain/aggregates/<slice>/<name>.aggregate.ts`
- Entity: `domain/entities/<slice>/<name>.entity.ts`
- VO: `domain/value-objects/<slice>/<name>.vo.ts`
- UseCase: `application/use-cases/<slice>/<verb-object>.use-case.ts`
- 읽기 UseCase도 같은 위치와 `.use-case.ts` 접미사를 사용한다.
- Port: `application/ports/<slice>/<capability>.<role>.port.ts`
- Adapter: `infrastructure/adapters/<slice>/<purpose>.adapter.ts`
- 역할명은 `Repository`, `Reader`, `Store`, `Client`, `Sender`, `Recorder`, `Publisher`, `Adapter`, `Policy`, `Resolver`, `Registry`, `JobHandler` 중 실제 책임을 표현한다.

## 완료 조건

```bash
pnpm typecheck
pnpm lint
pnpm format:check
```

위 명령은 항상 실행한다. Oxlint의 `no-restricted-imports`가 domain/application 의존성 경계를 검사한다. 변경 위험에 따라 API unit/integration/E2E를 추가한다. 공개 계약을 건드리는 작업은 OpenAPI snapshot과 배포 클라이언트 fingerprint의 의도치 않은 diff가 없어야 한다.
