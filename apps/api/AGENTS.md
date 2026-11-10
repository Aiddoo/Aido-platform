# Aido API

서버 작업의 진입점이다. 업무는 `src/modules`, 실행 기술은 `src/platform`, 순수 공통 코드는 `src/shared`에 있다. 공통 코드 규칙은 [루트 AGENTS](../../AGENTS.md#공통-코드-규칙), 작업별 상세는 [서버 문서 안내](docs/README.md)에서 필요한 것만 읽는다.

## 시작

- 새 slice는 `pnpm gen:api-slice`로 뼈대를 만든다. 생성기가 없으면 [아키텍처](docs/architecture.md#폴더-구조-목표)의 템플릿을 손으로 따른다.
- 기준 구현은 notes/memos다([도메인 모델](docs/domain-modeling.md#목표-예시-notesmemos)).
- 검사: `pnpm lint:names`, `pnpm --filter @aido/server lint:deps`·`check:conventions`·`check:unused`(knip, 보고만). Claude Code는 서버 파일을 고친 직후 `scripts/agent-hooks/lint-edited-file.mjs` hook이 lint·관례 검사를 돌린다.
- 모든 Context가 slice 구조이고 위 검사는 `apps/api/src` 전체에 걸린다. 남은 옛 이름은 각 문서의 "전환 중" 절에 있고 새 코드의 사례로 삼지 않는다.

## 서버 규칙 체크리스트

**레이어·slice**

- [ ] `modules/<context>/<slice>/{domain,application,infrastructure,presentation}`. slice 하나 = Nest Module 하나 = Aggregate Root 하나.
- [ ] presentation → application → domain, infrastructure → application(ports)·domain. 다른 Context는 `<context>-<slice>.public.ts`로만.
- [ ] Domain·Application은 Nest·ORM·SDK·`@aido/api` 계약을 모른다(`/vocabulary`·`/errors`만).
- [ ] 버전은 `presentation/http/v<n>/`와 계약에만. `forwardRef`·순환 금지.

**이름**([사전](docs/conventions.md))

- [ ] 파일 접미사: `.aggregate`·`.entity`·`.vo`·`.event`·`.domain-service`·`.use-case`·`.port`·`.read-model`·`.repository`·`.reader`·`.mapper`·`.adapter`·`.wire`·`.queue`·`.processor`·`.scheduler`·`.event-handler`·`.controller`·`.dto`.
- [ ] UseCase는 `CreateMemoUseCase.execute(command)`. 구현은 `DrizzleMemoRepository`(`Impl` 금지).
- [ ] 팩토리는 `create`·`generate`·`reconstitute`뿐, 값 꺼내기는 `toPrimitives()`/`<Noun>Primitives`.
- [ ] 순수 판단은 `*.domain-service.ts` 함수. `policy`는 바깥 호출 정책에만. static만 있는 클래스 금지.
- [ ] 쓰기는 Entity·VO, 조회는 Read Model, HTTP는 Dto.

**모델**([도메인 모델](docs/domain-modeling.md))

- [ ] 상태 전이는 바뀌면 `true`. `false`면 저장·발송을 건너뛴다.
- [ ] 복원은 `*-row.mapper.ts` 한 곳. 시퀀스 id는 `nextId()`.
- [ ] 업무 오류는 `<slice>.errors.ts`의 이름 있는 생성 함수. 불변식은 `DomainException`, 거부는 `ApplicationException`.

**포트·조립**

- [ ] 포트는 abstract class이자 DI 토큰. Symbol 토큰·`@Inject(TOKEN)` 금지.
- [ ] 조립은 `<context>-<slice>.providers.ts`의 `provideUseCase`. 의존성 타입은 `Pick<Port, "…">`.
- [ ] 공급자 이름은 어댑터·`*.wire.ts`에만. 외부 응답은 Zod `parse`, 호출은 `OutboundPolicy` 안에서([외부 호출](docs/outbound.md)).

**트랜잭션·큐**([작업과 이벤트](docs/jobs-and-events.md))

- [ ] `UnitOfWorkPort.run` + CLS. 잠금은 `MutationLockPort`와 `<slice>.lock-keys.ts`(문자열 유지).
- [ ] 외부 I/O는 트랜잭션 밖. 상태를 바꾸는 후속 작업은 같은 트랜잭션 enqueue/publish, 커밋 뒤 in-process는 캐시 정리만.
- [ ] 큐는 `defineQueue` 한 곳(payload schema·재시도·`missed` 필수). handler는 멱등. 큐 이름 `*.v1`·job key·옛 payload는 바꾸지 않는다.

**시간**([날짜](../../docs/conventions/dates.md))

- [ ] `ClockPort.now(): Temporal.Instant`. Domain·UseCase에서 `new Date()`·`Date.now()` 금지.
- [ ] 계약은 문자열, 변환은 presentation 경계. 직렬화는 `toIsoString`(ms 3자리).
- [ ] 할 일 시각은 떠 있는 시각(`startDate + scheduledLocalTime`).

**HTTP·오류**([HTTP 계약](docs/http-contracts.md))

- [ ] DTO는 `http/v1/<noun>.dto.ts` 한 파일에 `schema.meta({ id })`. component id·operationId 유지.
- [ ] 응답 문구·계약 타입은 응답 매퍼가 만든다. 새 목록은 `cursorPageSchema`.
- [ ] 앱 헤더는 `RequestClient`로. 출시 계약은 추가만, released fixture를 재생성하지 않는다.

**관측·보안**

- [ ] 로그 키는 `<context>.<subject>.<outcome>`, 상수는 `<slice>.log-events.ts`. 토큰·키·할 일 제목·전사·AI 입출력 금지([관측](docs/observability.md)).
- [ ] 경보는 `OperationalAlertPort`, 5xx는 `ExceptionReporterPort`. 업무 코드에서 Sentry 직접 호출 금지.
- [ ] env는 slice `*.config.ts`(`registerAs` + Zod)에서만 읽는다([설정](docs/configuration.md)).

**테스트**([테스트](docs/testing.md))

- [ ] 행동 하나를 가장 싼 층에서 한 번. UseCase는 InMemory 포트 + `FixedClock`, SQL 의미는 Testcontainers PG, 계약은 E2E.
- [ ] 전달만 하는 코드·조립·필드 복사 매퍼·상수·mock 호출 횟수는 테스트하지 않는다.

## 완료

- 요청한 동작, 호출 경로, 오류·호환 조건을 확인한다. 검증은 위험에 맞게 고르고 통과한 검사를 이유 없이 반복하지 않는다.
- 폐기 가능한 로컬 test DB는 승인 없이 쓴다. 운영 삭제·마이그레이션, 유료 호출, 외부 발송은 승인 범위를 확인한다.
- 결과에는 달라진 것, 실제 확인한 범위, 남은 한계를 적는다.
