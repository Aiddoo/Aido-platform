# 서버 구조와 책임

모듈 경계나 상태·트랜잭션 소유를 바꿀 때 참고한다. 작성 형식은 [api-conventions.md](api-conventions.md), 저장소 구현은 [prisma.md](prisma.md)에 있다. 이 문서는 설계 기준과 실제 사례를 구분한다. 전체 전환 이력은 [migration.md](../../../docs/server/migration.md)가 소유한다.

## 의존성과 실행 흐름

Aido 서버는 PostgreSQL 기반 모듈러 모놀리스다. `modules/<context>`의 slice가 업무를 소유하고 Nest Module/factory provider가 경계를 조립한다.

```text
HTTP → Guard/Interceptor → Controller → endpoint UseCase
                                     → Domain 규칙 + Application Port
                                                        ↑ 구현
                                          Infrastructure → DB/Redis/queue/vendor
```

| 위치             | 소유하는 책임                                                  |
| ---------------- | -------------------------------------------------------------- |
| `domain`         | 상태 전이, 값의 검증·불변성, 순수 업무 판단                    |
| `application`    | 흐름·권한·UoW 조정, Port, read model, 메시지·프롬프트 조립     |
| `infrastructure` | ORM/SQL·Redis·queue·SDK I/O와 해당 표현의 변환                 |
| `presentation`   | HTTP DTO 검증, 입력 변환, Swagger·상태·응답 매핑               |
| Context root     | Module, factory provider, 실제 소비하는 공개 capability        |
| `platform`       | DB transaction runtime, HTTP filter, Nest logging 등 실행 기술 |
| `shared`         | Context가 공통으로 쓰는 순수 규칙·Application 계약             |

Domain/Application은 Nest·ORM·vendor SDK·platform 구현에 의존하지 않는다. Domain은 Application/Infrastructure/Presentation을 모른다. 다른 Context의 구현 경로를 직접 import하지 않는다. 순수 `es-toolkit`, `ts-pattern`, 날짜 helper 등은 역할에 맞게 사용할 수 있으며 라이브러리 호출 자체를 새 wrapper로 감쌀 필요는 없다.

Controller는 UseCase를 직접 호출한다. 같은 요청을 한 번 더 전달하는 Facade는 추가하지 않는다. Application에서 실제 업무 조정이나 실패 격리를 제공하는 클래스는 전달 전용 클래스와 구분한다.

## 상태 모델과 조회 모델

Aggregate는 함께 일관성을 지켜야 하는 단건 상태와 행동이 있을 때 선택한다. 식별되는 모델은 Entity, 검증·동등성·불변성이 필요한 값은 VO, 입력으로 결과를 계산하는 규칙은 순수 함수/Policy로 표현할 수 있다. 모든 필드에 VO를 만들거나 모든 Entity를 Aggregate로 승격하지 않는다.

현재 사례:

- [Todo](../src/modules/planning/domain/aggregates/todos/todo.aggregate.ts)는 생성 계획·완료 등 업무 행동을 소유한다. DB 생성 ID를 얻기 전 `planCreation()`과 저장 상태의 `reconstitute()`를 구분한다.
- [Notification](../src/modules/notification/domain/aggregates/delivery/notification.aggregate.ts)은 읽음 상태·소유권·멱등 행동을 소유한다. 조회 컬럼과 transport action은 [NotificationRecord](../src/modules/notification/application/read-models/delivery/notification.read-model.ts)로 분리한다.
- [AiReport](../src/modules/ai-assistance/domain/entities/reports/ai-report.entity.ts)는 저장 결과의 불변 snapshot이다. 상태 전이가 없는데 형식적으로 AggregateRoot를 상속하지 않는다. 표시 label과 응답은 [Application read-model의 toAiReportView](../src/modules/ai-assistance/application/read-models/reports/ai-report.read-model.ts)가 조립한다.
- [Coordinate](../src/modules/weather/domain/value-objects/forecast/coordinate.vo.ts)의 전역 좌표 검증과 KMA의 한국 지원·투영 정책은 다르다. provider 정책/계산을 Domain 좌표에 섞지 않는다.

`readonly`는 참조 재할당을 막을 뿐 `Date`·배열·원소를 깊게 고정하지 않는다. 상태 snapshot의 가변 값은 입력·출력에서 복사한다. 저장 복원은 생성 정책을 다시 실행하는 것과 구분한다.

조회·집계·렌더링은 read model/함수로 충분할 수 있다. batch claim/counter 같은 집합 원자성은 명명된 Port 뒤 DB 연산이 소유한다. 단건 Aggregate를 행마다 만들었다는 사실로 DB 동시성이 보장되지 않는다.

## Port와 공개 capability

Port는 소비자가 필요한 외부 공급자·캐시·큐·cross-context capability·원자적 저장 동작을 표현한다. 기존 구현을 그대로 한 번 전달하기 위한 인터페이스나 DB 호출마다 Port를 추가하지 않는다. UseCase dependency는 실제 사용하는 메서드의 `Pick`으로 좁힐 수 있다.

현재 Weather는 하나의 provider에 새 Registry를 추가하지 않고 Module에서 직접 연결한다. 외부에는 [weather-forecast.public.ts](../src/modules/weather/weather-forecast.public.ts)의 read model과 최소 Reader만 공개한다. 내부 KMA token·resolver·ancillary provider를 함께 export하지 않는다.

```ts
// weather-forecast.module.ts의 실제 조립 발췌
{ provide: WEATHER_FORECAST_READER, useExisting: WeatherForecastReader },
{ provide: WEATHER_GRID_RESOLVER, useClass: KmaWeatherGridResolver },
```

`useExisting`은 이미 조립된 객체를 공개 token과 연결한다. 필요 없는 forwarding reader를 하나 더 만들지 않는다. 구현 선택이 여러 개이고 실제 선택 정책이 있을 때만 Registry/Strategy가 유용하다.

Module은 `<context>-<slice>.module.ts`, 순수 Application 조립은 `<context>-<slice>-application.providers.ts`, 공개 경계는 `<context>-<slice>.public.ts`에 둔다. public에는 실제 소비되는 value/type만 명시 export한다. queue 작업자·Health 등 runtime 소비에는 별도 jobs public 경계가 쓰이기도 하며, 일반 업무 public과 같은 것으로 취급하지 않는다.

Module 순환과 type-only 참조를 구분한다. public barrel이 module을 재export하면 runtime import가 늘 수 있다. 양방향 Module import를 추가하기 전에 소유자의 좁은 capability와 조립 방향을 확인한다.

## 트랜잭션과 외부 작업

UoW 콜백은 transaction client를 인자로 받지 않는다. Repository/Reader가 CLS의 활성 transaction을 읽는다. 필요한 동시성은 canonical lock·conditional update·constraint 등 실제 DB 수단으로 보장한다.

```text
필요한 외부 조회/생성
UoW: 잠금 → 최신 자격/상태 확인 → 업무 변경 → 저장
commit
후속 publish/enqueue/cache 정리
```

이는 모든 흐름의 고정 recipe가 아니다. 작업의 원자성·기존 격리 의미를 먼저 확인한다. 외부 AI·push·email I/O를 긴 DB transaction 안에서 실행하지 않는다. DB 안에서 수행하는 다른 Context의 업무 workflow는 같은 Required UoW에 참여할 수 있다.

실제 사례:

- [CreateTodo](../src/modules/planning/application/use-cases/todos/create-todo.use-case.ts)는 UoW/정렬 잠금 아래 저장하고 커밋 뒤 기존 생성 효과를 발행한다.
- [GenerateReport](../src/modules/ai-assistance/application/use-cases/reports/generate-report.use-case.ts)는 유료 자격을 AI 호출 전 확인하고, 외부 호출 후 account lock을 잡은 UoW에서 최신 자격·중복을 재확인해 저장한다. enqueue 시점의 cached 자격만으로 실행·저장을 허용하지 않는다.
- [ReconcilePushReceipts](../src/modules/notification/application/use-cases/delivery/reconcile-push-receipts.use-case.ts)는 외부 receipt 조회를 밖에서 하고 terminal 상태 기록·토큰 비활성화를 하나의 UoW로 묶는다. 비활성화 실패 시 retry 대상을 잃지 않도록 함께 rollback하며 cache 정리는 commit 뒤 격리한다.

부수효과 실패를 모두 같은 방식으로 처리하지 않는다. durable outbox, 기존 best-effort, 실패 전파·재시도 계약을 구분한다. callback mock이 성공한 결과는 native rollback/동시성의 증거가 아니다.

## 캐시·큐·시간·표시의 소유

- Application은 모듈 cache Port를 사용한다. Redis key, TTL, sentinel, pattern invalidation은 해당 Infrastructure keyspace가 소유하며 운영 키를 임의로 바꾸지 않는다.
- queue/job 이름, payload schema, retry/backoff, attempt 의미, enqueue 조건은 queue 소유 Context의 계약이다. 외부 입력은 신뢰하지 않으며 producer/consumer가 같은 schema를 사용한다.
- Date instant, DB DATE/calendar label, 사용자 timezone을 구분한다. 날짜 문자열을 process timezone의 instant로 바꾼 뒤 요일을 계산하지 않는다. DST 기간은 각 경계를 대상 zone에 다시 해석한다. 기존 shared date helper를 사용한다.
- locale별 사용자 copy·AI 지시문·response schema는 Application의 typed catalog나 Presentation이 소유한다. Domain 숫자 판단과 상태 규칙은 번역 문자열을 만들거나 파싱하지 않는다. 예: AI `application/prompts`, Notification `application/messages`, Email `application/services/email/email-message.factory.ts`·`application/templates/email`.
- Provider의 wire JSON/SDK 타입은 Infrastructure에서 변환한다. Application의 이메일 HTML이나 관리자 채널 표시처럼 순수 렌더링을 둔 기존 흐름은 I/O 구현과 구분한다.

## 댓글 읽기 모델의 현재 결정

댓글 overview/conversation은 높은 변경성과 viewer 상태·cursor/focus 문맥 때문에 Redis 공유 payload를 사용하지 않는다. [PrismaTodoCommentReader](../src/modules/engagement/infrastructure/persistence/comments/prisma-todo-comment.reader.ts)는 root keyset, descendant 집계·DFS window를 SQL로 읽고 page 단위 like를 합친다. [Conversation presenter](../src/modules/engagement/application/presenters/comments/todo-conversation.presenter.ts)가 lane/focus 표시를 조립한다.

상세 조회수는 unique key로 멱등 기록하며 별도 기록 endpoint를 만들지 않는다. 삭제된 부모는 살아 있는 후손의 문맥을 위해 묘비로 남을 수 있다. 서명 cursor는 todo/sort/thread/scope를 묶는다. POPULAR traversal은 보지 않은 root의 실시간 순위 변경까지 고정하는 snapshot이 아니다. 변경 시 해당 UseCase·reader·presenter와 구 앱/HTTP 계약을 함께 확인한다.

## 검증과 현재 전환 범위

Oxlint import/cycle 규칙은 일부 기계적 경계를, 타입 검사는 계약 연결을 확인한다. 상태 소유·추상화 가치·실제 Module 조립·transaction은 코드 검토와 적절한 실행 증거가 필요하다. 새 소스 파싱 검사나 중복 architecture test를 기본으로 추가하지 않는다.

문서의 기준이 모든 기존 코드에 적용됐다고 가정하지 않는다. Operations/Support/AppConfig 등에는 후속 전환 대상이 남아 있으며 계획된 경로를 현재 경로로 링크하지 않는다. 작업 범위의 코드와 [전환 기록](../../../docs/server/migration.md)을 확인하고, 위험에 맞는 검증은 [testing-guide.md](testing-guide.md)에서 선택한다.
