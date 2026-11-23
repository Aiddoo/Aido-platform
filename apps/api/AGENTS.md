# Aido API

서버 작업의 진입점이다. 업무는 `src/modules`, 실행 기술은 `src/platform`, 순수 공통 코드는 `src/shared`에 있다. 공통 코드 규칙은 [루트 AGENTS](../../AGENTS.md#공통-코드-규칙)이고, 작업에 맞는 문서만 아래 표에서 골라 읽는다.

## 명령

- 새 기능 뼈대: `pnpm gen:api-slice`(slice·계약·fixture·InMemory·계약 테스트). 순서는 [새 기능 추가](docs/new-feature.md)이고 스킬은 `api-feature`(Claude Code `/api-feature <기능>`)다.
- 검사: `pnpm lint`(Oxlint와 `aido/*`) · `pnpm lint:names`(ls-lint) · `pnpm --filter @aido/server lint:deps`(dependency-cruiser) · `pnpm check:unused`(knip, 루트 `knip.jsonc`). 모두 `pnpm check`에 있다. Claude Code는 서버 파일을 고친 직후 `scripts/agent-hooks/lint-edited-file.mjs` hook이 Oxlint를 돌린다.
- 테스트: `pnpm test` · `pnpm test:integration` · `pnpm test:e2e` · `pnpm test:contract`([테스트](docs/testing.md)).

## 무엇을 할 때 무엇을 읽나

| 작업                                                  | 문서                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 새 slice·UseCase를 더하는 순서                        | [새 기능 추가](docs/new-feature.md), 기준 구현 notes/memos                                 |
| Context·slice·레이어 의존·공개 면·포트·조립           | [아키텍처](docs/architecture.md)                                                           |
| 파일·클래스·메서드·상수 이름, 축약어, 공유 값 선언    | [이름 사전](docs/conventions.md)                                                           |
| Aggregate·VO·팩토리·상태 전이·도메인 이벤트·업무 오류 | [도메인 모델](docs/domain-modeling.md), 업무 용어 [용어집](docs/glossary.md)               |
| Drizzle·잠금·시간 칼럼·마이그레이션                   | [영속성](docs/persistence.md)                                                              |
| 큐·도메인 이벤트·크론                                 | [작업과 이벤트](docs/jobs-and-events.md)                                                   |
| Controller·DTO·버전·요청 한도·출시 앱 호환            | [HTTP 계약](docs/http-contracts.md), [호환](../../docs/conventions/compatibility.md)       |
| 외부 공급자 호출                                      | [외부 호출](docs/outbound.md)                                                              |
| 로그 키·경보·예외 보고                                | [관측](docs/observability.md), [경보 카탈로그](docs/alerts.md)                             |
| 설정·배포 환경·캐시·메모리 상한                       | [설정](docs/configuration.md), [확장](docs/scaling.md)                                     |
| 테스트 층·더블·fixture·flake                          | [테스트](docs/testing.md), 파일 이름·형식 [테스트 파일](../../docs/conventions/testing.md) |
| 기능별 문서(결제·푸시·AI·반복 할 일…)·운영            | [서버 문서 안내](docs/README.md)                                                           |

## 꼭 지키는 규칙

끝의 링크가 그 규칙의 원본이다. 괄호 안 이름은 그 규칙을 막는 검사다.

- **slice 하나는 Aggregate Root 하나다.** `modules/<context>/<slice>/{domain,application,infrastructure,presentation}`이고 다른 Context는 `*.public.ts`로만 읽는다. 그 Context 테이블을 직접 읽지 않는다([아키텍처](docs/architecture.md#폴더-구조)).
- **Domain·Application은 Nest·ORM·SDK·platform·계약을 모른다.** `@aido/api`는 `/vocabulary`·`/errors`만 쓴다(`no-restricted-imports`, [아키텍처](docs/architecture.md)).
- **이름은 사전을 따른다.** 역할 접미사는 루트 `.ls-lint.yml` 목록 하나, UseCase 공개 메서드는 `execute` 하나, 축약어(`ctx`·`tx`·`repo`)를 쓰지 않는다(`aido/use-case-single-execute`, [이름 사전](docs/conventions.md)).
- **상태 전이는 바뀌면 `true`, 이미 그 상태면 `false`다.** `false`면 UseCase가 저장·발송을 건너뛴다. 이벤트는 Aggregate가 `raise`하고 UseCase가 `pullDomainEvents()`를 publish한다([도메인 모델](docs/domain-modeling.md)).
- **업무 오류는 `<slice>.errors.ts`의 이름 있는 함수다.** 거부는 `ApplicationException`, 불변식은 `DomainException`이다(`aido/no-inline-coded-exception`, [도메인 모델](docs/domain-modeling.md)).
- **포트는 abstract class이자 DI 토큰이다.** 조립은 `*.providers.ts`의 `provideUseCase`, 의존성 타입은 `Pick<Port, "…">`다([아키텍처](docs/architecture.md)).
- **같은 Aggregate를 `save`하는 UseCase는 같은 잠금을 읽기 전에 잡는다**([영속성](docs/persistence.md#저장과-잠금)).
- **외부 I/O는 트랜잭션 밖이다.** 상태를 바꾸는 후속 작업은 같은 트랜잭션 enqueue 또는 `publish` + durable 구독이고, after-commit 구독은 캐시 정리만 한다. 큐는 `defineQueue` 한 곳이고 큐 이름 `*.v1`·job key는 바꾸지 않는다([작업과 이벤트](docs/jobs-and-events.md)).
- **지금 시각은 `ClockPort.now()` 하나다.** Domain·UseCase에서 `new Date()`·`Date.now()`를 쓰지 않는다([날짜](../../docs/conventions/dates.md)).
- **출시 계약은 추가만 한다.** released fixture를 재생성하지 않고 버전은 `http/v2/` 폴더로만 나눈다([HTTP 계약](docs/http-contracts.md#출시-앱-호환-절차)).
- **로그·경보에 민감값을 넣지 않는다.** 로그 키는 `<slice>.log-events.ts`, 경보는 `<slice>.alerts.ts` + `OperationalAlertPort`, 업무 코드는 Sentry를 부르지 않는다([관측](docs/observability.md)).
- **테스트는 행동 하나를 가장 싼 층에서 한 번이다.** UseCase는 InMemory 포트 + `FixedClock`, SQL 의미는 Testcontainers PG, `retry`로 가리지 않는다([테스트](docs/testing.md)).

## 완료

- 검증 범위·승인 범위는 [루트 검증](../../AGENTS.md#검증)을 따른다. 서버 순서는 `pnpm check` → 바꾼 범위의 unit·integration → 계약이 바뀌면 `test:contract`·관련 E2E다([새 기능 추가](docs/new-feature.md#7-문서와-pr)).
- 유료 외부 호출과 외부 발송도 사용자의 승인 범위에서만 한다. 폐기 가능한 로컬 test DB는 승인 없이 쓴다.
- 규칙을 바꿨으면 같은 PR에서 그 주인 문서를 고친다.
