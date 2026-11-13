# Aido API

서버 작업의 진입점이다. 업무는 `src/modules`, 실행 기술은 `src/platform`, 순수 공통 코드는 `src/shared`에 있다. 공통 코드 규칙은 [루트 AGENTS](../../AGENTS.md#공통-코드-규칙), 작업별 상세는 [서버 문서 안내](docs/README.md)에서 필요한 것만 읽는다.

## 시작

- 새 기능은 [새 기능 추가](docs/new-feature.md) 순서를 따른다(Claude Code 스킬 `/api-module <기능>`). 뼈대는 `pnpm gen:api-slice`(slice·계약·fixture·InMemory·계약 테스트)다.
- 기준 구현은 notes/memos다([도메인 모델](docs/domain-modeling.md#기준-구현-notesmemos)). 모든 Context가 slice 구조이고 규칙은 모든 Context에 같다.
- 검사: `pnpm lint`(Oxlint와 `aido/*` 관례 규칙), `pnpm lint:names`(ls-lint), `pnpm --filter @aido/server lint:deps`(dependency-cruiser), `pnpm check:unused`(knip, 설정은 루트 `knip.jsonc`). 모두 `pnpm check`에 있고 `apps/api/src` 전체에 걸린다. Claude Code는 서버 파일을 고친 직후 `scripts/agent-hooks/lint-edited-file.mjs` hook이 Oxlint를 돌린다.

## 서버 규칙 체크리스트

**레이어·slice**([구조](docs/architecture.md))

- [ ] `modules/<context>/<slice>/{domain,application,infrastructure,presentation}`. slice 하나 = Nest Module 하나 = Aggregate Root 하나.
- [ ] presentation → application → domain, infrastructure → application(ports)·domain. 다른 Context는 `*.public.ts`로만, 그 Context 테이블을 직접 읽지 않는다.
- [ ] Domain·Application은 Nest·ORM·SDK·platform·`@aido/api` 계약을 모른다(`/vocabulary`·`/errors`만).
- [ ] 재수출은 slice public·`@aido/api` 진입 파일·Drizzle schema 묶음에서만. barrel·`export *` 금지.
- [ ] 버전은 `presentation/http/v<n>/`와 계약에만. `forwardRef`·순환 금지.

**이름**([사전](docs/conventions.md))

- [ ] 역할 접미사는 루트 `.ls-lint.yml`의 `apps/api/src/modules/*` 목록 하나(`.aggregate`·`.vo`·`.domain-service`·`.use-case`·`.port`·`.repository`·`.mapper`·`.adapter`·`.queue`·`.controller`·`.dto` …).
- [ ] UseCase는 `CreateMemoUseCase.execute(command)`. 구현은 `DrizzleMemoRepository`(`Impl` 금지).
- [ ] 팩토리는 `create`·`generate`·`reconstitute`뿐, 값 꺼내기는 `toPrimitives()`/`<Noun>Primitives`.
- [ ] 순수 판단은 `*.domain-service.ts` 함수. `.policy`는 `<vendor>-outbound.policy.ts`에만. static만 있는 클래스 금지.
- [ ] 쓰기는 Entity·VO, 조회는 Read Model, HTTP는 Dto. 비공개는 `#`.

**모델**([도메인 모델](docs/domain-modeling.md))

- [ ] 베이스는 `shared/domain/model`. 상태 전이는 바뀌면 `true`, `false`면 저장·발송을 건너뛴다.
- [ ] 복원은 `*-row.mapper.ts` 한 곳. 시퀀스 id는 `nextId()`. 포트의 식별자는 id VO.
- [ ] 업무 오류는 `<slice>.errors.ts`의 이름 있는 생성 함수. 거부는 `application/`의 `ApplicationException`, 불변식은 `domain/`의 `DomainException`. 그 밖에서 바로 만들지 않는다(Oxlint `aido/no-inline-coded-exception`).

**포트·조립**

- [ ] 포트는 abstract class이자 DI 토큰. Symbol 토큰·`@Inject(TOKEN)`·옛 이름을 잇는 `useExisting` 별칭 금지.
- [ ] 조립은 `<context>-<slice>.providers.ts`의 `provideUseCase`. 의존성 타입은 `Pick<Port, "…">`, 로거는 `loggerFor`.
- [ ] 공급자 이름은 어댑터·`*.wire.ts`에만. 외부 응답은 Zod `parse`, 호출은 `OutboundPolicy` 안에서([외부 호출](docs/outbound.md)).

**트랜잭션·큐**([작업과 이벤트](docs/jobs-and-events.md))

- [ ] `UnitOfWorkPort.run` + CLS. 같은 Aggregate를 `save`하는 UseCase는 모두 같은 잠금(`<slice>.lock-keys.ts`)을 읽기 전에 잡는다([영속성](docs/persistence.md#저장과-잠금)).
- [ ] 외부 I/O는 트랜잭션 밖. 상태를 바꾸는 후속 작업은 같은 트랜잭션 enqueue 또는 `publish` + durable 구독, after-commit 구독은 캐시 정리만.
- [ ] 큐는 `defineQueue` 한 곳(payload schema·재시도·스케줄 `missed` 필수). handler는 멱등. 큐 이름 `*.v1`·job key·옛 payload는 바꾸지 않는다.

**시간**([날짜](../../docs/conventions/dates.md))

- [ ] `ClockPort.now(): Temporal.Instant`. Domain·UseCase에서 `new Date()`·`Date.now()` 금지. 시각 칸은 `instant`·`plainDate`.
- [ ] 계약은 문자열, 변환은 presentation 경계. 직렬화는 `toIsoString`(ms 3자리).

**HTTP·오류**([HTTP 계약](docs/http-contracts.md))

- [ ] DTO는 `http/v1/<noun>.dto.ts` 한 파일에 `schema.meta({ id })`. component id·operationId 유지.
- [ ] 응답 문구·계약 타입은 응답 매퍼가 만든다. 새 목록은 `cursorPageSchema`. 운영 밖에서는 응답이 선언 schema와 다르면 500이다.
- [ ] 앱 헤더는 `RequestClient`로. 출시 계약은 추가만, released fixture를 재생성하지 않는다.

**관측·보안·설정**

- [ ] 로그 키는 `<context>.<subject>.<outcome>`, 상수는 `<slice>.log-events.ts`. 토큰·키·할 일 제목·전사·AI 입출력 금지([관측](docs/observability.md)).
- [ ] 경보는 `<slice>.alerts.ts` 카탈로그 + `OperationalAlertPort`, 5xx는 `ExceptionReporterPort`. 업무 코드에서 Sentry 직접 호출 금지.
- [ ] 설정은 `defineConfig` namespace(`*.config.ts`). 운영 여부는 배포 환경 설정 하나로 판단하고 `NODE_ENV`를 직접 읽지 않는다. 운영에서 위험한 조합은 시작 검증에 더한다([설정](docs/configuration.md)).
- [ ] 캐시는 `CacheStorePort`(`ttlMs`) + `<noun>.keyspace.ts`. 프로세스 안 저장소는 `lru-cache` 상한·TTL([확장](docs/scaling.md)).

**테스트**([테스트](docs/testing.md))

- [ ] 행동 하나를 가장 싼 층에서 한 번. UseCase는 InMemory 포트 + `FixedClock`, SQL 의미는 Testcontainers PG + 포트 계약 suite, 계약은 E2E.
- [ ] 전달만 하는 코드·조립·필드 복사 매퍼·상수·mock 호출 횟수는 테스트하지 않는다. mock 라이브러리 대신 작은 double.
- [ ] 기다림은 `vi.waitFor`·`expect.poll`, 시각은 비교마다 출처 하나, 경쟁 순서는 lock·barrier. `retry` 금지([flake](docs/testing.md#실행-자원과-flake)).

## 완료

- 요청한 동작, 호출 경로, 오류·호환 조건을 확인한다. 검증은 위험에 맞게 고르고 통과한 검사를 이유 없이 반복하지 않는다.
- 폐기 가능한 로컬 test DB는 승인 없이 쓴다. 운영 삭제·마이그레이션, 유료 호출, 외부 발송은 승인 범위를 확인한다.
- 결과에는 달라진 것, 실제 확인한 범위, 남은 한계를 적는다. 규칙을 바꿨으면 같은 PR에서 문서를 고친다.
