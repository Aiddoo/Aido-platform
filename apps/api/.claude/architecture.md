# API Architecture

> Version 6.1.0 · Updated 2026-08-26 · Owner: Aido Platform Team

이 문서는 Aido API의 구조적 결정만 설명한다. 코드 작성 형식은 [api-conventions.md](./api-conventions.md), 저장소와 트랜잭션은 [prisma.md](./prisma.md), 테스트는 [testing-guide.md](./testing-guide.md)를 따른다.

## 1. 목표와 비목표

Aido API는 싱글 PostgreSQL 기반의 모듈러 모놀리스다. 실용형 DDD와 Clean Architecture를 사용하되, 레이어 수나 인터페이스 수 자체를 품질로 보지 않는다.

목표:

- 비즈니스 규칙과 외부 기술을 분리한다.
- 모듈 간 결합을 공개 capability로 제한한다.
- 상태 전이, 트랜잭션, 캐시, 큐의 소유권을 명확히 한다.
- 기존 클라이언트와 운영 계약을 자동 테스트로 보호한다.

비목표:

- 모든 모델을 Aggregate로 만들지 않는다.
- 모든 repository 호출 앞에 Port를 추가하지 않는다.
- application을 프레임워크 제로 의존으로 만들지 않는다.
- CQRS bus, 별도 command/query 객체, 추상 factory를 일괄 도입하지 않는다.

## 2. 의존성 방향

```text
presentation ───────────────→ application ───────────────→ domain
      │                            ↑                         ↑
      │                            │ implements ports        │ maps/reconstitutes
      └────────────────────→ infrastructure ─────────────────┘
                                  │
                                  └→ Prisma / Redis / BullMQ / vendor SDK
```

| 레이어           | 소유 책임                                                | 허용 의존성                                     |
| ---------------- | -------------------------------------------------------- | ----------------------------------------------- |
| `domain`         | Aggregate, Entity, VO, Policy, domain event              | 순수 TypeScript와 shared domain                 |
| `application`    | endpoint UseCase, orchestration, port, application error | domain, application 내부, 제한된 Nest DI/Logger |
| `infrastructure` | Prisma/Redis/queue/vendor 구현, mapper, listener         | application port, domain, 외부 기술             |
| `presentation`   | HTTP DTO, validation, Swagger, input/output mapper       | application 진입점, validator                   |

금지:

- domain → Nest, Prisma, application, infrastructure, presentation
- application → Prisma type, vendor SDK, infrastructure, presentation
- 외부 모듈 → 다른 모듈의 내부 UseCase, concrete adapter/repository, deep path
- public barrel → 내부 repository, queue 구현, 테스트 helper

`pnpm lint`의 Oxlint `no-restricted-imports` 규칙이 domain/application import 경계를 검사한다. Aggregate 파일명, public barrel, 타입 단언 같은 의미 규칙은 컴파일러와 리뷰 체크리스트로 확인하며 전용 AST 스크립트를 추가하지 않는다.

## 3. 요청 흐름

```text
Request
  → Guard / Interceptor
  → Controller
  → Endpoint UseCase.execute(input)
  → Aggregate/Policy + Port
  → Infrastructure Adapter
  → PostgreSQL/Redis/Queue/Vendor
```

- Controller는 Zod DTO와 HTTP 원시값을 application input으로 변환한다.
- Controller는 endpoint UseCase를 직접 주입한다. 단순 위임 Facade는 금지한다.
- UseCase는 한 endpoint의 흐름, 권한 확인, transaction, port 호출 순서를 조정한다.
- Domain은 상태 전이와 불변식을 판단하고 HTTP/DB 표현을 알지 않는다.
- 응답은 Aggregate가 만들지 않는다. read model 또는 presentation mapper가 만든다.

## 4. Domain 모델링

Aggregate는 동시 변경되어야 하는 단건 상태와 불변식이 있을 때만 사용한다.

| 종류           | 사용 기준                                      | 예시                                  |
| -------------- | ---------------------------------------------- | ------------------------------------- |
| Aggregate Root | 상태 전이와 불변식의 일관성 경계               | `Todo`, `AuthSession`, `Friendship`   |
| Entity         | Aggregate 안에서 식별되는 자식                 | `TodoItem`                            |
| Value Object   | 값 자체에 검증·동등성·불변성이 있음            | `TodoId`, `TodoTitle`, `TodoSchedule` |
| Policy         | 여러 입력으로 순수 판단                        | 완료, 재정렬, retry 계산              |
| Read model     | 조회·집계가 목적이며 상태 전이를 소유하지 않음 | daily/weekly 통계                     |

규칙:

- `AggregateRoot` 상속 파일은 `.aggregate.ts`, `Entity` 상속 파일은 `.entity.ts`다.
- 생성은 invariant와 기본값을 한곳에 모은다. DB autoincrement 모델은 `planCreation()` 후 저장하고 `reconstitute()`한다.
- `reconstitute()`는 신뢰한 영속 상태를 복원하며 생성 검증을 반복하지 않는다.
- mutable `Date`는 입출력 시 방어적으로 복사한다.
- 상태 문자열과 부분 update 판단을 UseCase에 흩뿌리지 않고 명명된 도메인 행동으로 표현한다.
- 다중 Aggregate 조정은 application transaction에서 수행한다.
- batch/claim/counter처럼 집합 원자성이 핵심이면 Aggregate를 거치지 않는 명명된 SQL port를 허용한다.

## 5. Port와 모듈 경계

Port는 변화 가능성 또는 격리 가치가 명확할 때 사용한다.

Port가 적합한 경우:

- AI, 결제, 이메일, push처럼 공급자를 교체할 수 있다.
- Redis, BullMQ, clock, ID 생성기처럼 테스트 대역이 필요하다.
- 다른 bounded context가 제공하는 좁은 capability를 소비한다.
- 원자적 DB 연산을 application 언어로 표현해야 한다.

Port가 불필요한 경우:

- 같은 모듈의 단순 내부 함수 호출이다.
- 구현이 하나뿐이고 교체·격리·경계 가치가 없다.
- 기존 클래스를 한 번 더 전달하기 위한 wrapper다.

Port는 소비자가 필요한 최소 동작으로 정의한다. 공급자의 전체 API나 vendor 용어를 복제하지 않는다. 타 모듈 연결은 공개 access module 또는 좁은 capability를 사용하며 UseCase를 직접 공유하지 않는다.

## 6. Transaction과 side effect

```text
UNIT_OF_WORK.run
  → load
  → Aggregate mutate
  → conditional write / repository save
commit
  → domain event publish
  → durable queue enqueue
```

- UoW 콜백은 인자를 받지 않는다. repository는 CLS에서 활성 transaction을 읽는다.
- load→mutate→write는 경쟁 조건을 줄이기 위해 같은 transaction에 둔다.
- 낙관적 잠금, conditional update, unique constraint는 DB가 보장한다.
- 실패 기록처럼 rollback되면 안 되는 쓰기는 기존 의미에 따라 transaction 밖에서 수행한다.
- 이메일, push, 외부 webhook 등은 커밋 전 실행하지 않는다.
- 크로스 모듈 후속 작업에만 domain event를 사용한다. 단순한 내부 함수 호출을 이벤트로 바꾸지 않는다.

## 7. Cache와 Redis keyspace

- 캐시는 read cost가 높고 재사용 가능하며 무효화 조건이 명확할 때만 사용한다.
- 자주 바뀌고 필터 조합이 많은 값은 hit ratio와 invalidation 비용을 먼저 검토한다.
- application은 의미 기반 cache port만 호출한다. raw Redis key를 알지 않는다.
- key builder, namespace, TTL, sentinel, pattern invalidation은 해당 컨텍스트의 `infrastructure/cache`가 소유한다.
- 논리 키는 `aido:v1:<context>:<resource>:<encoded-part>` 형태를 기본으로 한다. 기존 운영 키는 migration 계획 없이 변경하지 않는다.
- TTL은 이름 있는 상수로 관리하고 단위(`Ms`, `Seconds`, `Minutes`)를 드러낸다.
- cache miss와 장애 fallback을 구분하고, 캐시 장애가 핵심 쓰기를 rollback시키지 않도록 기존 격리 의미를 유지한다.

참조:

- `todo/infrastructure/cache/todo-cache.keyspace.ts`
- `weather/infrastructure/cache/weather-cache.keyspace.ts`
- `notification/infrastructure/cache/notification-cache.keyspace.ts`

### 댓글 읽기 모델 결정

- 댓글 overview와 flat conversation은 Redis에 캐시하지 않는다. root 인기 순위, 양방향 cursor,
  focus window, viewer 좋아요가 함께 변해 공유 payload의 무효화 범위가 지나치게 넓다.
- overview는 root keyset을 한 번 읽고 선택된 root의 preview·표시 가능한 descendant 수·참여자를
  한 번의 재귀 집계로 읽는다. page size는 root 수이며 root별 추가 조회를 만들지 않는다.
- `PrismaTodoCommentReader`가 root block 정렬과 parent-before-child DFS를 재귀 CTE 한 번으로
  계산하고, 요청한 window와 앞뒤 경계 한 행만 반환한다.
- 사용자별 좋아요 여부는 page 전체 comment ID를 한 번의 `IN` 조회로 결합한다.
- comment mutation은 별도 comment cache invalidation을 하지 않는다. Todo의 공유 지표가 바뀐
  경우에만 기존 Todo view cache를 커밋 뒤 best-effort로 정리한다.

## 8. Queue와 background job

- queue name, job name, payload schema, retry/backoff, concurrency는 queue 소유 컨텍스트에 둔다.
- Redis에서 읽은 payload는 신뢰하지 않는다. 주요 job payload는 Zod로 런타임 검증한다.
- job 이름은 판별 가능한 literal union으로 유지한다.
- producer와 processor가 같은 contract를 import한다.
- 안정적인 idempotency key를 사용하고 retry가 중복 부수효과를 만들지 않게 한다.
- 로그에는 queue/job 이름, job ID, 시도 횟수, correlation 식별자를 남기되 payload의 개인정보와 token은 기록하지 않는다.
- queue 이름·payload·enqueue 횟수·retry 의미는 운영 계약이다. 변경 시 migration과 호환 전략이 필요하다.

## 9. Error, logging, security

- Domain invariant 위반은 `DomainException`, application 규칙 위반은 `ApplicationException`으로 표현한다.
- 공개 오류는 `@aido/errors`의 `ErrorCode`를 사용한다. `HttpException`을 비즈니스 로직에서 직접 생성하지 않는다.
- `GlobalExceptionFilter`가 상태 코드와 응답 wrapping을 정규화한다.
- 운영 로그는 구조화하고 비밀번호, token, authorization code, 원문 개인정보를 기록하지 않는다.
- OAuth token 등 저장이 필요한 비밀은 기존 encryption 경계를 사용한다.

상세: [logging-guide.md](./logging-guide.md)

## 10. 계약과 검증

리팩터링에서 다음은 승인 없이 변경하지 않는다.

- HTTP route/method/header/query/body/response/status
- Zod/Swagger/`@aido/validators` 공개 export
- ErrorCode/message/details/wrapping
- Prisma schema/migration/data
- queue name/job payload/enqueue 조건
- Redis key/TTL/invalidation 범위
- 정렬, pagination, idempotency, side-effect 순서

검증 게이트:

- Oxlint: import 경계, 순환 참조, 핵심 TypeScript 안전 규칙
- Oxfmt: 저장소 전체의 결정적 포맷과 import/package 정렬
- TypeScript: strict 타입 검사
- unit: Aggregate/VO/Policy와 UseCase 분기
- integration: 실제 PostgreSQL transaction/concurrency
- E2E: HTTP, 오류 응답, OpenAPI snapshot과 배포 클라이언트 fingerprint 계약

## 11. 참조 구조

```text
src/todo/
├── domain/
│   ├── entities/todo.aggregate.ts
│   ├── entities/todo-item.entity.ts
│   ├── value-objects/
│   ├── services/              # 기존 순수 정책; 신규는 명확한 역할명 사용
│   └── events/
├── application/
│   ├── use-cases/
│   ├── queries/
│   ├── ports/
│   ├── events/
│   └── types.ts
├── infrastructure/
│   ├── adapters/
│   ├── persistence/
│   └── cache/
├── presentation/
│   ├── dtos/
│   └── todo.controller.ts
├── todo.module.ts
└── index.ts
```

새 구조를 추측하지 말고 이 디렉터리와 [api-conventions.md](./api-conventions.md)의 체크리스트를 함께 따른다.

## 12. Todo 댓글 참조 흐름

```text
GET /v1/todos/:todoId/details
  → 접근 가능한 Todo 조회
  → 비소유자 조회를 (todoId, viewerId) unique key로 멱등 기록
  → 같은 transaction에서 최신 viewCount 반환

GET /v1/todos/:todoId/comments/overview
  → LATEST/POPULAR root keyset page 조회
  → 선택된 root 전체의 owner 우선 direct reply preview와 descendant summary를 한 번에 집계
  → root·preview viewer like를 단일 IN 조회

GET /v1/todos/:todoId/conversation
  → todoId·sort·commentId·threadId·scope를 묶은 opaque cursor 검증
  → focus가 있으면 실제 thread를 resolve하고 그 root block 안에서만 parent-before-child DFS 조회
  → recursive reader가 page 밖 sibling·cousin까지 보고 각 행을 통과하는 조상 lane depth를 계산
  → 요청 window와 앞뒤 경계 한 행 반환
  → presenter가 visualDepth·상하 lane·부모 branch로 완성된 connection topology와 isFocused를 계산
  → page와 focus 조상 전체의 viewer like를 단일 IN 조회

unified comment/like mutation
  → Aggregate 권한·삭제 상태 검증
  → counter와 상태를 transaction에서 반영
commit
  → Todo 지표 cache 정리 + 기존 NotificationSender 호출
```

- 별도 조회수 기록 endpoint는 두지 않는다. 상세 GET 재시도·prefetch는 DB unique constraint로 중복 집계되지 않는다.
- 상위 댓글 삭제는 soft delete다. 본문과 작성자 표시는 제거하되 답글은 유지한다.
- cursor는 클라이언트가 정렬 컬럼을 조립하거나 점수 snapshot을 바꾸지 못하도록 HMAC으로 서명한다.
  버전·종류·정렬·todo·comment·thread·조회 범위를 포함하며, focus thread에서 만든 cursor는 다음·이전 page도 다른 root로
  넘어가지 않는다. 없는 focus와 삭제된 leaf focus는 빈 대화로 복구하고, 잘못된 before/after는 거부한다.
- 후손 때문에 보존된 삭제 조상 focus는 같은 thread 문맥을 보여 주되 focus 표시는 하지 않는다.
- connection의 lane 배열은 음수가 없는 중복 제거 오름차순이다. 첫 행의 부모 branch와 마지막 행에서
  page 밖 직계 자식으로 내려가는 lane도 서버가 완성하므로 클라이언트는 인접 행이나 tree를 추론하지 않는다.
- overview의 `totalCount`는 살아 있는 descendant와 살아 있는 후손을 가진 삭제 묘비를 센다.
  `previewReply`는 살아 있는 direct reply 중 Todo owner를 우선하고, 없으면 createdAt·id 오름차순 첫 행이다.
- `POPULAR`은 실시간 순위다. cursor는 경계 thread의 점수 snapshot을 이어 받아 그 thread의 중복과
  누락을 막지만, 아직 보지 않은 다른 root가 경계를 넘어 상승하면 현재 traversal에는 나타나지 않을
  수 있다. 새 순위는 pull refresh로 처음부터 읽는다. 완전히 반복 가능한 탐색이 필요해질 때만 별도
  ranking snapshot/session을 도입한다.
- 댓글 알림은 구버전 앱이 이미 아는 `TODO_SHARED` 타입을 유지한다. 서버는 모바일 내부 route를 `actionUrl`에 넣지 않고 `senderId`를 metadata에 넣어 계정 purge 시 body에 복사된 이름까지 찾아 지울 수 있게 한다. DB CHECK는 comment metadata가 있는 행의 URL 저장과 senderId 누락을 막는다. 1.8.2는 타입 기본 목적지로 안전하게 이동하고, 최신 앱만 Zod로 검증한 comment metadata를 해석한다.
- 계정 hard purge는 알림·댓글 bounded context의 공개 cleanup capability를 같은 UoW에서 먼저 호출한다. 다른 사용자의 알림에 복사된 발신자 이름을 제거하고, 작성 댓글은 묘비로 남기고 counter와 좋아요를 정산한 뒤 개인정보가 없는 잠긴 시스템 작성자로 재귀속한다. `authorId`와 relation은 NOT NULL이라 직전 API로 롤백해도 역참조가 깨지지 않는다. 재귀속할 때 더는 replay하지 않을 멱등 키도 새 UUID로 바꿔 여러 사용자의 키가 충돌하지 않게 한다. `User` FK의 `RESTRICT`는 이 정리가 빠졌을 때 hard delete를 막는 마지막 안전망이다.
