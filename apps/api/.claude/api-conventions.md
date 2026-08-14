# API Code Conventions

> Version 3.0.0 · Updated 2026-08-14 · Owner: Aido Platform Team

이 문서는 신규·수정 코드의 작성 규칙이다. 구조적 이유는 [architecture.md](./architecture.md), DTO는 [validators.md](./validators.md), DB는 [prisma.md](./prisma.md), 테스트는 [testing-guide.md](./testing-guide.md)를 따른다.

## 1. 기본 원칙

- 기존 모듈의 현재 패턴과 `src/todo`를 먼저 읽는다.
- 한 클래스는 하나의 역할과 하나의 변경 이유를 가진다.
- 전달만 하는 Facade, Service, Manager, Helper, Utils, Impl을 만들지 않는다.
- 추상화는 교체·격리·모듈 경계 가치가 있을 때만 추가한다.
- 공개 계약을 유지하는 리팩터링에서는 snapshot을 갱신해 회귀를 승인하지 않는다.

## 2. 파일과 역할

| 역할           | 위치·형식                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------- |
| Aggregate Root | `domain/entities/<name>.aggregate.ts`                                                     |
| 자식 Entity    | `domain/entities/<name>.entity.ts`                                                        |
| Value Object   | `domain/value-objects/<name>.vo.ts`                                                       |
| 순수 판단      | `domain/policies/<name>.policy.ts` 또는 기존 `domain/services/<specific-name>.ts`         |
| Domain event   | `domain/events/<event>.event.ts`                                                          |
| 쓰기 UseCase   | `application/use-cases/<verb-object>/<verb-object>.use-case.ts`                           |
| 읽기 UseCase   | `application/queries/<verb-object>/<verb-object>.use-case.ts`                             |
| Port           | `application/ports/<capability>.<role>.port.ts`                                           |
| Adapter        | `infrastructure/adapters/<purpose>.adapter.ts`                                            |
| Prisma 구현    | `infrastructure/adapters/prisma-<capability>.<role>.ts` 또는 모듈의 기존 persistence 구조 |
| Cache keyspace | `infrastructure/cache/<context>-cache.keyspace.ts`                                        |
| Queue contract | `infrastructure/queue/<context>-queue.constants.ts`                                       |
| Queue consumer | `<purpose>.processor.ts` 또는 `<purpose>.job-handler.ts`                                  |
| HTTP mapper    | `presentation/<purpose>.mapper.ts`                                                        |

역할 접미사:

- 상태 저장: `Repository`
- 조회: `Reader`
- 임시 상태: `Store`
- 외부 API/SDK: `Client`
- 발송: `Sender`
- append-only 기록: `Recorder`
- 이벤트 발행: `Publisher`
- 경계 변환: `Adapter`
- 순수 판단: `Policy`
- 복수 정보 해석: `Resolver`
- 구현 선택: `Registry`
- 큐 소비: `JobHandler` 또는 기존 Nest 관례의 `Processor`

## 3. Controller

Controller는 HTTP 경계다.

해야 하는 일:

- decorator, auth/role guard, Swagger 선언
- `@aido/validators` DTO 수신
- header/param/query/body를 application input으로 변환
- endpoint UseCase 직접 호출
- 응답 DTO 또는 mapper로 변환

하지 않는 일:

- repository/Prisma 직접 호출
- 상태 전이와 비즈니스 분기
- transaction 시작
- 외부 SDK 호출
- 전달 전용 Facade 호출

```ts
@Post()
async create(
  @CurrentUser('id') userId: string,
  @Body() request: CreateTodoRequestDto,
): Promise<TodoResponseDto> {
  return this.createTodoUseCase.execute({
    userId,
    title: request.title,
    scheduledAt: request.scheduledAt,
  });
}
```

## 4. UseCase

- 클래스명은 `<Verb><Object>UseCase`다.
- 공개 실행 메서드는 `execute` 하나다.
- 입력이 있으면 단일 `XxxInput`, 없으면 무인자다.
- 입력 속성은 재할당하지 않는 계약이므로 `readonly`를 사용한다. 지역 변수나 mutable domain state에 기계적으로 붙이지 않는다.
- 반환 객체는 `XxxResult` 또는 실제 read model 이름을 사용한다.
- Nest의 `@Injectable`, `@Inject`, Logger는 허용한다.
- Prisma와 vendor 타입은 금지한다.
- 권한, orchestration, transaction, port 호출 순서를 담당한다.
- 상태 전이 규칙은 Aggregate/VO/Policy에 위임한다.

```ts
export interface UpdateTodoTitleInput {
  readonly userId: string;
  readonly todoId: string;
  readonly title: string;
}

@Injectable()
export class UpdateTodoTitleUseCase {
  constructor(
    @Inject(TODO_REPOSITORY)
    private readonly todoRepository: TodoRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(input: UpdateTodoTitleInput): Promise<TodoResponse> {
    return this.unitOfWork.run(async () => {
      const todo = await this.todoRepository.findOwnedById(input.todoId, input.userId);
      todo.changeTitle(input.title);
      await this.todoRepository.updateTitle(todo);
      return this.todoRepository.findResponseById(input.todoId, input.userId);
    });
  }
}
```

실제 repository 메서드명과 반환 타입은 해당 모듈을 따른다. 예제의 이름을 존재 확인 없이 복사하지 않는다.

## 5. Partial update

`patch.completed !== undefined` 자체는 잘못이 아니지만 여러 필드에 반복하면 의도가 흐려진다. 입력 presence와 도메인 행동을 명시적으로 분리한다.

```ts
if (patch.completed !== undefined) {
  todo.changeCompletion(patch.completed);
}
```

필드가 많으면 순수 presence 함수 또는 mapper로 정리하되 truthy 검사로 바꾸지 않는다. `false`, `0`, 빈 문자열이 유효한 값일 수 있기 때문이다.

```ts
const hasValue = <T>(value: T | undefined): value is T => value !== undefined;

if (hasValue(patch.completed)) {
  todo.changeCompletion(patch.completed);
}
```

도메인 상태 변경은 `Object.assign`이나 범용 patch 메서드보다 명명된 행동을 우선한다. DB에는 실제 영향 필드만 저장할 수 있다.

## 6. Domain

- constructor는 외부에서 직접 호출하지 않는다.
- 생성과 복원을 구분한다.
- 원시값은 VO로 변환한 뒤 Aggregate 상태로 유지한다.
- getter가 `Date`나 mutable collection을 그대로 노출하지 않게 한다.
- boolean은 `is/has/can/should`, 시각은 `*At`, 기간은 `*Ms/*Seconds/*Minutes`를 사용한다.
- vendor의 enum/필드명은 presentation 또는 infrastructure mapper 안에서만 유지한다.
- 주석은 코드 동작이 아니라 결정 이유, transaction 이유, 호환성 이유를 설명한다.

Aggregate가 필요하지 않은 경우:

- 단순 조회 projection
- 통계와 report read model
- 상태 없는 formatter/mapper
- 집합 단위 batch/claim/counter

## 7. Port와 Adapter

Port는 application의 언어로 정의한다.

```ts
export const AI_TEXT_GENERATOR = Symbol('AI_TEXT_GENERATOR');

export interface AiTextGeneratorPort {
  generateTodo(input: GenerateTodoTextInput): Promise<GeneratedTodoText>;
}
```

나쁜 예:

- vendor SDK 메서드와 타입을 그대로 복사한 Port
- 한 concrete class를 감싸기만 하는 Port
- `ServicePort`, `ManagerPort`처럼 capability가 드러나지 않는 이름
- 같은 DB 모듈 내부 호출마다 추가한 인터페이스

Adapter는 변환과 외부 I/O를 담당하며 비즈니스 규칙을 만들지 않는다. vendor 교체는 Adapter와 module binding에서 끝나야 한다.

## 8. Repository와 Transaction

- 영속 상태 변경은 `Repository`, 읽기 projection은 `Reader`로 구분한다.
- repository는 Prisma row와 domain/read model 사이를 매핑한다.
- UseCase에 Prisma model 또는 transaction client를 반환하지 않는다.
- 활성 transaction은 CLS에서 읽는다. `transaction`, `tx`를 계층마다 전달하지 않는다.
- unique/foreign-key 오류는 기존 canonical error mapping을 유지한다.
- 회원가입 기본 카테고리처럼 특정 업무를 수행하는 클래스는 `DefaultTodoCategorySeeder`처럼 업무 이름을 사용한다. 내부에서 repository를 사용해 같은 UoW에 참여하는 것은 허용한다.

## 9. Domain event와 Queue

- domain event는 이미 발생한 사실을 과거형으로 명명한다.
- Aggregate가 event를 적립하고 UseCase가 성공한 commit 뒤 발행한다.
- 같은 transaction 안에서 반드시 성공해야 하는 핵심 저장을 비동기 event로 넘기지 않는다.
- queue payload는 producer/consumer가 공유하는 schema로 검증한다.
- queue/job/key 문자열과 retry/concurrency 숫자는 이름 있는 상수로 관리한다.
- processor는 payload 검증, UseCase 호출, 재시도 가능한 오류의 로깅에 집중한다.

## 10. Cache

- cache key와 TTL은 컨텍스트별 keyspace 파일이 소유한다.
- application에는 `getTodoSummary`, `invalidateUserTodos` 같은 의미 기반 메서드를 노출한다.
- raw key 조립, wildcard pattern, Redis command는 infrastructure에 둔다.
- 쓰기 성공 후 필요한 범위만 무효화한다.
- 필터 조합이 많고 변경이 잦은 데이터는 캐시를 기본 선택으로 보지 않는다.

## 11. Module과 public API

- Module이 UseCase와 `Port → Adapter` binding을 명시적으로 등록한다.
- provider 배열은 반복 등록을 줄일 때만 사용하며 `todo-use-case.providers.ts` 같은 별도 파일을 기본 규칙으로 만들지 않는다.
- 공개 `index.ts`는 타 모듈이 실제로 소비하는 capability, event contract, DTO만 export한다.
- UseCase, concrete repository, queue 구현, test helper는 공개하지 않는다.
- 순환 의존을 `forwardRef`로 덮기 전에 capability 방향을 재검토한다.

## 12. Error와 logging

- Domain invariant: `DomainException`
- Application rule: `ApplicationException`
- Public code: `ErrorCode`
- 비즈니스 코드에서 `HttpException`과 임의 문자열 code를 만들지 않는다.
- log context에는 module/use-case/job과 안정적인 식별자를 포함한다.
- token, password, authorization code, 원문 개인정보와 전체 vendor payload는 기록하지 않는다.

## 13. Test

- Aggregate/VO/Policy: 프레임워크 없는 단위 테스트
- UseCase: `@suites/unit`의 `TestBed.solitary` 또는 명시적 fake/mock
- Module wiring/decorator/guard: Nest testing module
- Repository/UoW/concurrency: 실제 PostgreSQL 통합 테스트
- HTTP/error/OpenAPI: E2E

TestBed는 금지 대상이 아니다. domain 테스트에 Nest container를 불필요하게 올리지 않고, UseCase DI 자동 mock에 선택적으로 사용한다.

## 14. 신규·수정 체크리스트

1. 공개 HTTP/Zod/error/DB/queue/cache 계약의 변경 여부를 먼저 확인한다.
2. 상태 전이와 invariant가 있으면 기존 Aggregate에 행동을 추가한다.
3. endpoint orchestration은 하나의 UseCase `execute(input)`에 둔다.
4. 외부 기술 또는 cross-context capability가 있을 때만 Port를 정의한다.
5. Adapter에서 Prisma/vendor/Redis/BullMQ 타입을 변환한다.
6. Controller에서 DTO를 input으로 변환하고 UseCase를 직접 호출한다.
7. Module binding과 최소 public export를 추가한다.
8. unit → integration → E2E → architecture/contract 순으로 위험에 비례해 검증한다.

```bash
pnpm typecheck
pnpm lint
pnpm format:check
```

## 15. 금지 검색어 점검

신규 코드에서 아래 항목을 발견하면 역할과 경계를 다시 검토한다.

```text
application/facades
*Facade
*Manager
*Helper
*Utils
*Impl
deep import of another module
Prisma type in application/domain
shared CacheKeys in application
```

이름만으로 실패시키지 말고 실제 책임을 확인한다. 외부 라이브러리 고유명과 기존 호환 API는 예외일 수 있다.
