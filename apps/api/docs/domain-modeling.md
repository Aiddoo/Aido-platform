# 도메인 모델

Entity·VO·Aggregate·도메인 서비스·도메인 오류를 만들거나 바꿀 때 읽는다. 이름은 [이름 사전](conventions.md), 레이어 경계는 [아키텍처](architecture.md)에 있다.

## 원칙

- 모든 slice는 Entity·Aggregate 클래스와 VO로 상태를 표현한다. 조회 전용 slice도 쓰기 상태가 있으면 Aggregate를 둔다.
- slice가 쓰는 테이블의 행 타입마다 Entity 클래스가 하나 있다. Root는 `*.aggregate.ts`(`AggregateRoot` 상속), Root를 거쳐서만 바뀌는 하위는 `*.entity.ts`다. slice 하나는 Aggregate Root 하나이고, 수명주기가 따로인 Root가 둘이면 slice를 나눈다.
- 작업 원장(push outbox·발송 기록·receipt, 알림 보존, 결제 안내 기록처럼 많은 행을 한 번에 넘기는 상태)도 행 Entity 클래스를 둔다. 수백 행을 한 문장으로 바꿔야 하는 경로만 저장소에 업무 이름의 묶음 메서드(`claimDue`·`markExpired`)를 허용하고, 한 행을 바꾸는 경로는 Entity 행동 → `save`다.
- 베이스 클래스는 `shared/domain/model`의 `ValueObject<TValue>`, `EntityId<TValue>`, `Entity<TId, TProps>`, `AggregateRoot<TId, TProps, TEvent>`다. VO는 `ValueObject`를 상속하고 const 객체로 VO를 흉내 내지 않는다. 다른 베이스 클래스를 만들지 않는다.
- `ValueObject.equals`는 생성자와 값을 비교한다. Temporal 값은 자체 `equals`로 비교한다(es-toolkit `isEqual`은 같은 시각의 다른 Temporal 객체를 다르다고 본다).
- `AggregateRoot`는 `raise(event)`로 이벤트를 쌓고 `pullDomainEvents()`로 꺼낸다. 이벤트를 내지 않는 Aggregate도 상속한다(일관성 우선).

## 팩토리는 세 이름뿐

| 이름           | 뜻                                                                       |
| -------------- | ------------------------------------------------------------------------ |
| `create`       | 새 상태. 생성 규칙을 검증하고 이벤트를 낸다                              |
| `generate`     | 앱이 만드는 식별자(`TodoSeriesId.generate()`)                            |
| `reconstitute` | 신뢰한 저장값 복원. 검증·이벤트가 없다. 한도가 줄어도 옛 데이터를 읽는다 |

- `planCreation`·`of`·`from` 같은 다른 이름을 쓰지 않는다.
- DB 시퀀스 id(`serial`)는 Repository `nextId()`로 먼저 받는다(IDDD `nextIdentity()`). 그래서 `create`와 `reconstitute`가 같은 완전한 타입을 돌려주고 "id 없는 Aggregate"가 없다. 묶음은 `nextIds(count)` 한 쿼리다.
- 복원 위치는 infrastructure의 `*-row.mapper.ts`(env에서 읽으면 `*-env.mapper.ts`) 한 곳이다. Application이 행을 받아 복원하지 않는다.

## 상태 전이

- 전이 메서드는 동사이고, 실제로 바뀌었으면 `true`, 이미 같은 상태면 아무것도 바꾸지 않고 `false`다. UseCase는 `false`면 저장·발송을 건너뛰어 재요청·재시도를 멱등으로 만든다. 사례: [Memo](../src/modules/notes/memos/domain/memo.aggregate.ts)의 `rewrite`·`changePinned`·`moveTo`와 [UpdateMemoUseCase](../src/modules/notes/memos/application/use-cases/update-memo.use-case.ts).
- 같은 값 수정에서 저장을 건너뛰면 `updatedAt`이 유지된다. 앱이 "값이 같아도 `updatedAt`이 바뀐다"에 기대는 slice만 항상 저장하고 그 이유를 slice에 적는다. 메모는 앱 초안이 원본 시각이 더 새로울 때만 낡았다고 보므로(`apps/mobile/src/shared/draft/draft.model.ts`) 건너뛴다. 여러 행을 미는 집합 update(`shiftSortOrders`)는 옮긴 행의 `updatedAt`을 바꾼다.
- 시각은 `now: Temporal.Instant` 인자로 받는다. 도메인 안에서 시계를 읽지 않는다.

## 상태와 행동 이름

- 상태 값은 튜플 한 곳에서 선언한다. 앱이 보는 상태는 `@aido/api/vocabulary`, 서버만 아는 상태는 `domain/<slice>.constants.ts`다. 타입은 튜플에서 유도하고 리터럴 유니온을 손으로 쓰지 않는다.
- 상태는 Aggregate의 행동 메서드로만 바뀐다. 메서드 이름은 [용어집](glossary.md)의 업무 동사다(`accept`·`complete`·`reopen`·`block`·`expire`). `setStatus`·`update`·`changeStatus` 같은 범용 setter를 두지 않는다. 값 하나를 바꾸는 행동만 `change<Noun>`(`changePinned`)을 쓴다.
- 허용되지 않은 전이(`ACCEPTED`인 요청을 다시 수락)는 두 가지 중 하나로 정하고 slice 안에서 섞지 않는다. 같은 상태로의 재요청은 `false`(멱등), 다른 상태에서의 금지된 전이는 `domain/<slice>.errors.ts`의 이름 있는 오류다.
- 상태 질문은 `is<State>()`(`isPending()`), 행동 가능 여부는 `can<Action>()`, 파생 값은 명사 getter(`remainingSeconds`)다. 질문 메서드는 상태를 바꾸지 않는다.
- 전이 표(상태 → 행동 → 다음 상태)는 용어집의 그 Context 절에 둔다. 코드와 표가 다르면 코드를 고치거나 표를 고치는 PR에서 함께 맞춘다.
- UseCase 이름은 `<업무 동사><Aggregate>`(`AcceptFriendRequest`, `CompleteTodo`)이고 용어집의 행동과 같은 말을 쓴다. 이벤트는 `<context>.<aggregate>.<과거형>`이다.

## 규칙을 둘 곳

1. 한 Entity·VO의 상태만 보는 규칙은 그 클래스 메서드다(`subscription.renewingPlanType()`, `memoContent.toTodoTitle()`).
2. 여러 모델에 걸치거나 상태가 없는 규칙은 `*.domain-service.ts`의 순수 함수다(`billing/shared/premium-access.domain-service.ts`).
   - 입력은 이름 붙은 객체 하나, `now`는 인자다.
   - 업무 판단은 throw하지 않고 판별 유니온으로 돌려준다. 같은 종류 함수는 반환 모양을 통일한다.
   - static만 있는 클래스로 감싸지 않는다(`no-extraneous-class`·`no-static-only-class`).
3. 런타임에 구현을 갈아 끼워야 할 때만 Strategy(포트 + 구현 클래스)를 쓴다.

## 오류와 식별자

- 불변식 위반은 `DomainException(ErrorCode, details)`(`shared/domain/exceptions`), UseCase 거부는 `ApplicationException`(`shared/application`)이다. 세 번째 인자 `{ message?, cause? }`로 응답 문구를 정하거나 감싼 원본 오류를 남긴다. HTTP 변환은 [오류 규칙](../../../docs/conventions/errors.md)대로 `GlobalExceptionFilter`가 한다.
- 업무 오류는 slice `<slice>.errors.ts`의 이름 있는 생성 함수(`memoNotFound(memoId)`)로 만든다. 같은 코드·details 모양이 한 곳에서 나온다. 거부는 `application/<slice>.errors.ts`, 불변식은 `domain/<slice>.errors.ts`(Domain은 Application을 import하지 못한다)이고, 같은 Context의 slice가 함께 쓰는 불변식은 `<context>/shared/domain/<context>.errors.ts`(`planning.errors.ts`), 공용 식별자는 `shared/domain/exceptions/shared-domain.errors.ts`다. 이 파일 밖에서 `new ApplicationException`·`new DomainException`·`new ErrorCodedException`(별칭 import 포함)을 쓰지 않고 이 클래스들을 잇는 예외 클래스도 만들지 않는다(Oxlint `aido/no-inline-coded-exception`, spec 제외). port·use-case 파일 안에 오류 클래스를 선언하지 않는다.
- 여러 Context가 쓰는 `UserId`는 `shared/domain/identifiers/user-id.vo.ts`, Context 고유 id(`TodoId`)는 그 Context의 `shared/domain`에 둔다.
- 포트 시그니처의 식별자는 원시값(`number`·`string`)이 아니라 id VO다([MemoRepositoryPort](../src/modules/notes/memos/application/ports/memo.repository.port.ts)의 `MemoId`·`UserId`). 원시값은 presentation 경계에서 VO로 바꾼다.
- 상태를 바꾸지 않거나 DB에 두지 않는 Root(주간 성취 기록, env의 앱 릴리스, 전달만 하는 문의)도 `AggregateRoot`(`*.aggregate.ts`)이고, 표시 라벨·응답은 presentation 매퍼가 만든다.

## 기준 구현: notes/memos

기준 구현은 [notes/memos](../src/modules/notes/memos)다. 테스트는 [fixture](../test/fixtures/notes/memo.fixture.ts)·[InMemory 저장소](../test/doubles/notes/in-memory-memo.repository.ts)·[저장소 계약](../test/contracts/notes/memo-repository.contract.ts)이 사례다.

```ts
// modules/notes/memos/domain/memo.aggregate.ts (발췌)
export class Memo extends AggregateRoot<MemoId, MemoProps> {
  static create(params: CreateMemoParams): Memo {
    return new Memo(params.id, {
      userId: params.userId,
      content: params.content,
      isPinned: false,
      sortOrder: params.sortOrder,
      createdAt: params.now,
      updatedAt: params.now,
    });
  }

  changePinned(isPinned: boolean, now: Temporal.Instant): boolean {
    if (this.props.isPinned === isPinned) {
      return false;
    }
    this.props.isPinned = isPinned;
    this.props.updatedAt = now;
    return true;
  }

  toPrimitives(): MemoPrimitives {
    // id·userId·content는 VO의 value로, createdAt·updatedAt은 Temporal.Instant 그대로
  }
}
```

| 파일                                                                                                                        | 핵심                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [`memo-id.vo.ts`](../src/modules/notes/memos/domain/memo-id.vo.ts)                                                          | `MemoId extends EntityId<number>`, `reconstitute`만(시퀀스 id)                                                                           |
| [`memo-content.vo.ts`](../src/modules/notes/memos/domain/memo-content.vo.ts)                                                | `create`가 `1 <= length && length <= MEMO_LIMITS.MAX_CONTENT_LENGTH` 검사                                                                |
| [`memo-ordering.domain-service.ts`](../src/modules/notes/memos/domain/memo-ordering.domain-service.ts)                      | `planMoveRelativeTo`·`planMoveToEdge`가 `{ sortOrder, shift }` 계획을 돌려줌                                                             |
| [`application/memos.lock-keys.ts`](../src/modules/notes/memos/application/memos.lock-keys.ts)                               | `MemoLockKeys.memo`·`sortOrder`(문자열은 voice 계획 저장과 같은 잠금), 있는 메모를 바꾸는 UseCase는 `existingMemo`로 두 키를 함께 잡는다 |
| [`create-memo.use-case.ts`](../src/modules/notes/memos/application/use-cases/create-memo.use-case.ts)                       | 잠금 → 한도 → 내용 검증 → `nextId` → `Memo.create` → `save` → 로그                                                                       |
| [`infrastructure/persistence/memo-row.mapper.ts`](../src/modules/notes/memos/infrastructure/persistence/memo-row.mapper.ts) | `toMemo(row)`·`toMemoRow(memo)`                                                                                                          |
| [`presentation/http/v1/memo-response.mapper.ts`](../src/modules/notes/memos/presentation/http/v1/memo-response.mapper.ts)   | 응답 문구 `MEMO_RESPONSE_MESSAGES`와 `toIsoString` 직렬화                                                                                |
