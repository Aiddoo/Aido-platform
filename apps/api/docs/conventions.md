# 이름 사전과 서버 코드 규칙

파일·클래스·메서드·상수 이름을 정하거나 값 목록을 선언할 때 읽는다. 서버·앱 공통 코드 규칙은 [루트 AGENTS](../../../AGENTS.md#공통-코드-규칙)에 있고, 여기에는 서버에만 해당하는 사전과 근거를 둔다.

## 역할별 이름

| 역할            | 파일                                                                 | 클래스·심볼                                         | 메서드 규칙                                                                               |
| --------------- | -------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Aggregate Root  | `memo.aggregate.ts`                                                  | `Memo`                                              | `static create`·`static reconstitute(primitives)`·`toPrimitives()`(타입 `MemoPrimitives`) |
| 하위 Entity     | `todo-item.entity.ts`                                                | `TodoItem`                                          | 같음                                                                                      |
| 식별자 VO       | `memo-id.vo.ts`                                                      | `MemoId`                                            | `static generate()`(앱 생성) 또는 Repository `nextId()`(DB 시퀀스), `static reconstitute` |
| 값 VO           | `memo-content.vo.ts`                                                 | `MemoContent`                                       | `static create(raw)`(검증)·`static reconstitute(raw)`·`value`·`equals`                    |
| 도메인 이벤트   | `todo-changed.event.ts`                                              | `TodoChangedEvent`                                  | `eventName`은 `<context>.<aggregate>.<과거형>`(`planning.todo.completed`), `toPayload()`  |
| 도메인 서비스   | `memo-ordering.domain-service.ts`                                    | 순수 함수 `planMoveRelativeTo()`                    | 입력은 이름 붙은 객체 하나, 반환은 값 또는 판별 유니온, `now`는 인자                      |
| UseCase         | `create-memo.use-case.ts`                                            | `CreateMemoUseCase`                                 | `execute(command)` 하나. 입력 `CreateMemoCommand`·`ListMemosQuery`                        |
| Port            | `memo.repository.port.ts`                                            | `abstract class MemoRepositoryPort`                 | 아래 Repository 규칙                                                                      |
| Read Port       | `todo-comment.reader.port.ts`                                        | `TodoCommentReaderPort`                             | Aggregate가 아닌 projection만                                                             |
| Read Model      | `todo-comment.read-model.ts`                                         | `TodoCommentThreadReadModel`(type)                  | 불변 데이터                                                                               |
| Repository 구현 | `drizzle-memo.repository.ts`                                         | `DrizzleMemoRepository`                             |                                                                                           |
| 행 매퍼         | `memo-row.mapper.ts`                                                 | `toMemo(row)`·`toMemoRow(memo)`                     |                                                                                           |
| 외부 어댑터     | `expo-push-sender.adapter.ts`                                        | `ExpoPushSenderAdapter`                             | 공급자 이름은 이 파일·클래스·`*.wire.ts`에만                                              |
| 외부 wire       | `weatherkit.wire.ts`                                                 | `weatherKitWeatherSchema`                           | 응답은 모두 Zod `parse`                                                                   |
| 큐 정의·소비    | `todo-reminder.queue.ts`·`todo-reminder-queue.processor.ts`          | `TODO_REMINDER_QUEUE`·`TodoReminderQueueProcessor`  | 이름·payload schema·재시도·DLQ는 `defineQueue` 한곳                                       |
| 주기 작업       | `timezone-reminder-sweep.scheduler.ts`                               | `TimezoneReminderSweepScheduler`                    |                                                                                           |
| 이벤트 구독     | `invitee-activity.event-handler.ts`                                  | `InviteeActivityEventHandler`                       |                                                                                           |
| HTTP            | `http/v1/memo.controller.ts`·`memo.dto.ts`·`memo-response.mapper.ts` | `MemoController`·`CreateMemoDto`·`toMemoResponse()` | DTO는 컨트롤러별 한 파일, 응답 문구는 매퍼                                                |
| 로그·경보·오류  | `memos.log-events.ts`·`forecasts.alerts.ts`·`memos.errors.ts`        | `MemoLogEvent`·`ForecastAlerts`·`memoNotFound()`    | 로그 상수는 이벤트 이름 상수와 겹치지 않게                                                |

- 메모 이름은 실제 코드다: [notes/memos](../src/modules/notes/memos), 테스트 [fixture](../test/fixtures/notes/memo.fixture.ts)·[InMemory 저장소](../test/doubles/notes/in-memory-memo.repository.ts)·[계약](../test/contracts/notes/memo-repository.contract.ts).
- 허용하는 역할 접미사는 [check-conventions.mjs](../scripts/check-conventions.mjs)의 `ROLE_SUFFIXES` 하나이고 `.ls-lint.yml`과 같아야 한다(검사가 비교한다). `.policy`는 `<vendor>-outbound.policy.ts`에만 쓴다.
- 구현은 기술 접두사(`DrizzleMemoRepository`, `InMemoryMemoRepository`)로 짓고 `Impl`을 쓰지 않는다.
- `Manager`·전달 전용 Facade·`TodoService` 같은 만능 이름으로 역할을 감추지 않는다. 행동 하나가 UseCase 하나다.
- 라이브러리와 겹치는 이름(`HttpService`·`CacheService`·`Logger`)을 새로 만들지 않는다(`CacheStorePort`, `requestVendorJson`).

## Repository 메서드

| 접두사              | 반환        | 비고                            |
| ------------------- | ----------- | ------------------------------- |
| `find*`             | `T \| null` |                                 |
| `list*`             | `T[]`       |                                 |
| `count*`            | `number`    |                                 |
| `exists*`           | `boolean`   |                                 |
| `nextId()`          | Id VO       | 묶음은 `nextIds(count)` 한 쿼리 |
| `save(aggregate)`   | `void`      | insert-or-update                |
| `delete(aggregate)` | `void`      |                                 |

집합 원자 연산은 업무 이름(`shiftSortOrders`)으로 짓는다. `-1` 같은 sentinel 대신 `null`을 쓴다. Repository는 로그·enqueue·캐시 정리를 하지 않는다(부수효과는 UseCase에 보이게).

## 용어

- 쓰기 모델은 Entity·Aggregate·VO, 조회 결과는 Read Model, HTTP는 Dto 세 용어만 쓴다. `record`·`model`·`view`·`types`를 같은 뜻으로 쓰지 않는다.
- Entity를 평범한 값으로 꺼내는 메서드는 `toPrimitives()`, 타입은 `<Noun>Primitives`다. `snapshot`은 이벤트 소싱의 저장 사본과 헷갈려 쓰지 않는다. Temporal 값은 불변이라 primitives에 그대로 둔다.
- 순수 판단 함수 모음은 `*.domain-service.ts`다. `policy`는 바깥 호출 정책(`<vendor>-outbound.policy.ts`)에만 쓴다.

## 비공개 멤버는 `#`

- 비공개 필드·메서드·getter는 모두 `#`이다. TS `private`·`public` 키워드와 생성자 파라미터 프로퍼티(`constructor(private readonly x)`)를 쓰지 않는다.
- Nest가 주입하는 의존성도 `readonly #x` 필드에 생성자에서 대입한다. DI는 생성자 파라미터 타입만 본다.
- `protected`는 `shared/domain/model` 베이스 클래스의 확장점(`props`, `raise`)과 그 `override` 재정의에만 허용한다.
- 강제(src·test·scripts 전체): TS `erasableSyntaxOnly: true`(파라미터 프로퍼티·TS `enum` 컴파일 오류), oxlint `typescript/parameter-properties`(`prefer: "class-property"`), `private`·`public`·`protected` 키워드 검사(`check:conventions`). 정적 비공개 멤버는 Nest 데코레이터 클래스에 쓸 수 없어 모듈 함수·상수로 뺀다.

## 없음의 모양

비교와 `== null` 규칙은 [nullish](../../../docs/conventions/nullish.md)다. 층별 모양은 다음으로 고정한다.

| 층                                      | 없음                                     |
| --------------------------------------- | ---------------------------------------- |
| Domain props·Repository 반환·Read Model | `null`                                   |
| 함수 선택 인자·Command의 생략 가능 필드 | `?:`(undefined)                          |
| HTTP 응답                               | 계약의 `.nullable()`(필드를 빼지 않는다) |
| PATCH 입력                              | `undefined`는 미제공, `null`은 초기화    |

## 변수·상수

- 단위 접미사(`timeoutMs`, `ttlSeconds`), boolean은 `is/has/can/should`, 컬렉션은 복수형, id는 `memoId`. `data`·`info`·`item` 같은 뭉뚱그린 이름을 쓰지 않는다. 배포된 DTO·DB·payload 이름은 바꾸지 않는다(코드 `seriesId` ↔ DB `recurrenceGroupId`).
- 상수는 `UPPER_SNAKE`이고 단위를 이름에 넣는다. 매직 넘버를 쓰지 않는다.

| 종류                                 | 위치                                                  |
| ------------------------------------ | ----------------------------------------------------- |
| 서버·앱 공통 값(한도·enum 튜플·플랜) | `@aido/api/vocabulary`                                |
| 한 slice의 업무 숫자                 | `domain/<slice>.constants.ts`                         |
| 인프라 튜닝(TTL·배치·폴링·타임아웃)  | 그 어댑터 옆 `*.constants.ts` 또는 `defineQueue` 정의 |
| 운영에서 바꾸는 값                   | env([설정](configuration.md))                         |
| 잠금·캐시 키                         | `<slice>.lock-keys.ts`, `<noun>.keyspace.ts`          |

## 공유 값은 한 곳에서 선언한다

| 값의 성격                              | 선언 한 곳                               | 유도                                                              |
| -------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| 앱·서버가 함께 아는 값(상태·종류·언어) | `@aido/api/vocabulary`의 `as const` 튜플 | `(typeof X)[number]`, `z.enum(X)`, `pgEnum("Name", X)`, 앱 import |
| 서버만 아는 업무 값                    | slice `domain/<slice>.constants.ts` 튜플 | 같은 방식. 손으로 쓴 리터럴 유니온 금지                           |
| 서버 설정 값                           | config schema 안 튜플                    | 같은 방식(예: `ADMIN_NOTIFIER_PROVIDERS`)                         |
| 외부 공급자 값                         | `*.wire.ts` Zod                          | `z.infer`                                                         |
| HTTP 요청·응답                         | `@aido/api` 계약 Zod                     | `z.infer`                                                         |
| DB 행                                  | Drizzle 테이블                           | `$inferSelect`/`$inferInsert`                                     |

- `pgEnum`은 튜플로만 선언한다. 리터럴 배열 `pgEnum`은 `check:conventions`가 막는다. 튜플로 바꿀 때 값 목록·순서가 지금 DB와 같아야 하고 `db:generate`가 빈 diff여야 한다. 계약 튜플과 순서만 다르면(`AccountProvider`) 소유 slice에 DB 순서 튜플을 두고 `satisfies`로 같은 값만 담게 한다.
- vocabulary에는 Zod를 넣지 않는다. 도메인 모델은 계약·DB 타입과 독립이고 변환은 매퍼 한 곳이다.

## 서버에서 지키는 코드 규칙

- UseCase는 "잠금 → 읽기 → 도메인 행동 → 저장 → 발행"이 위에서 아래로 읽히게 쓴다. SQL·SDK는 어댑터에 둔다.
- v1·v2 응답은 각 버전 매퍼에서 만든다. 버전·권한 분기를 한 함수에 섞지 않는다.
- 함께 바뀌지 않으면 버그가 나는 것(계약·큐 payload·잠금 키)은 한 파일에 응집한다. Context 사이 매퍼 중복은 허용한다.
- 계층을 그대로 통과하는 인자(tx·userId 드릴링)는 CLS·Command 객체로 없앤다.
- 재발명하지 않는다: es-toolkit(`groupBy`·`keyBy`·`chunk`·`isEqual`·`retry`·`clamp`), ts-pattern, Zod, Temporal. `JSON.stringify` 비교는 `isEqual`로, 직접 짠 재시도 루프는 `retry` 또는 pg-boss 재시도로 바꾼다.
- 서버에서 남길 주석 이유의 예: 잠금 순서, Required UoW, 재시도·멱등, 오류 우선순위, 구 앱 호환.

## Nest 공식 패키지 판단

| 패키지                                              | 판단      | 이유                                                                              |
| --------------------------------------------------- | --------- | --------------------------------------------------------------------------------- |
| `@nestjs/http-client`                               | 사용      | named client, `retry: false`(재시도 층 하나), 응답은 `*.wire.ts`로 직접 검증      |
| `@nestjs/i18n`                                      | 사용      | [다국어](i18n.md)                                                                 |
| `@nestjs/mail`                                      | 사용      | 설정만으로 공급자 전환, 언어별 템플릿, `idempotencyKey`                           |
| `@nestjs/config`                                    | 사용      | namespace 설정([설정](configuration.md))                                          |
| `@nestjs/drizzle`                                   | 사용      | `DatabaseModule`이 Pool 수명주기를 맡긴다. 트랜잭션은 `@nestjs-cls/transactional` |
| `@nestjs/event-emitter`                             | 사용      | 커밋 뒤 in-process 전달([작업과 이벤트](jobs-and-events.md))                      |
| `@nestjs/outbox`·`@nestjs/cache-manager`            | 쓰지 않음 | pg-boss 트랜잭션 enqueue가 이미 아웃박스, Keyv에 패턴 삭제 없음(`lru-cache` 사용) |
| `@nestjs/schedule`·`@nestjs/cqrs`·`@nestjs/observe` | 쓰지 않음 | 메모리 cron은 중복·유실, 버스가 호출 경로를 숨김, 별도 APM 필요                   |

0.0.x 공식 패키지는 catalog에 정확히 고정하고 사용처를 어댑터 한 파일로 가둔다.
