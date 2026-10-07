# 서버 코드 작성 기준

Controller·UseCase·Port를 작성하거나 역할을 정리할 때 참고한다. 경계의 이유는 [architecture.md](architecture.md), 공개 HTTP 계약은 [rest-contracts.md](rest-contracts.md), 이름의 기준은 [naming.md](../../../docs/server/naming.md)에 있다. 수정 대상과 가까운 실제 구현을 사례로 선택한다.

## 책임과 추상화

한 클래스는 함께 바뀌는 업무 책임을 맡는다. 작은 클래스 수나 인터페이스 수 자체가 품질 지표는 아니다. 한 줄 전달 Facade, 형식적인 Aggregate, 필드마다 생기는 VO, 구현 하나를 다시 전달하는 Registry를 추가하지 않는다. 역할이 사라진 helper·forwarder·export는 실제 소비를 확인해 제거한다. API·DB·queue/cache 운영 호환에 필요한 경계는 함께 제거하지 않는다.

현재 사례에서 판단할 수 있는 기준:

| 기준                               | 실제 사례                                                           |
| ---------------------------------- | ------------------------------------------------------------------- |
| 상태 행동과 조회 projection 분리   | Notification Aggregate와 Application NotificationRecord             |
| 작은 consumer 계약                 | UpsertLocation이 location 저장·cache invalidate·grid resolve만 소비 |
| 공급자 구현에서 정책/계산 격리     | Coordinate와 KmaWeatherGridResolver                                 |
| 한 객체를 최소 공개 token으로 연결 | WeatherForecastReader의 `useExisting` binding                       |
| 사용자 표시와 숫자 규칙 분리       | AI report read model/locale label과 Domain report 집계              |

SOLID를 새 Base class나 계층을 만드는 이유로 사용하지 않는다. 실제 변경 이유, 교체 지점, 필요한 capability로 설명한다.

## TypeScript와 입력 의미

- 파일·폴더는 kebab-case, 클래스·타입은 PascalCase, 변수·필드는 camelCase다. ESM 상대 import는 `.js`, 별칭은 `#api/*`/`#test/*`를 사용한다.
- 순수 Application은 생성자 객체로 의존성을 받고 `readonly #dependencies`에 보관한다. 입력의 재할당 없는 속성도 readonly로 표현한다. 가변 Domain 상태를 기계적으로 readonly로 만들지는 않는다.
- 의존성 타입은 전체 공급자 API보다 실제 사용하는 `Pick`이 명확할 수 있다. 단일 메서드 Port는 그 자체로 최소 계약일 수 있으므로 Pick을 반복할 필요는 없다.
- null/undefined presence는 의미를 드러내는 비교를 사용한다. boolean은 `!flag`로 검사할 수 있지만 `0`·`false`·빈 문자열을 입력 누락으로 바꾸지 않는다.
- PATCH의 `undefined`는 미제공, 허용된 `null`은 초기화다. 초기화 가능한 필드에 `input.field ?? existing.field`를 쓰지 않는다.
- Repository의 조회 실패, cache miss 등은 각 Port의 기존 null/undefined 계약을 따른다. 값을 확인하지 않고 cast/non-null assertion으로 넘기지 않는다.
- snapshot의 Date/배열/중첩 가변 값은 필요한 깊이만큼 방어적으로 복사한다. `readonly`만으로 외부 mutation이 차단되지는 않는다.

코드가 설명하는 동작을 주석으로 반복하지 않는다. lock 순서, Required UoW, retry/idempotency, 오류 우선순위, 구 앱 호환처럼 코드만으로 드러나지 않는 이유는 남긴다.

## Controller와 DTO

Controller는 decorator/guard/Swagger, DTO 검증, 원시값의 Application 입력 변환, 결과의 HTTP 매핑을 담당한다. Repository·SDK·transaction·업무 상태 판단은 Controller에 두지 않는다. UseCase를 직접 주입한다.

[TodoController](../src/modules/planning/presentation/controllers/todos/todo.controller.ts)의 실제 시그니처 발췌:

```ts
async create(
  @CurrentUser() user: CurrentUserPayload,
  @Body({ schema: CreateTodoDto }) dto: CreateTodoDto,
  @Timezone() timezone: string,
): Promise<CreateTodoResponseDto> {
```

이 경계는 `user.userId`, DATE `parseDateOnly`, 사용자 zone의 시각 `parseLocalDateTime`을 입력으로 만든다. `CurrentUser("id")`나 존재하지 않는 `scheduledAt` 예제를 새 코드의 계약으로 복사하지 않는다. shared schema의 optional/null/default는 [REST 계약](rest-contracts.md) 기준으로 유지한다.

## UseCase와 Domain

UseCase는 `<Verb><Object>` 이름과 `execute` 진입점을 사용한다. 한 endpoint 또는 명확한 background workflow의 입력·권한·port 호출·transaction 순서를 조정한다. 유사 코드가 있다는 이유만으로 unrelated 흐름을 범용 executor에 합치지 않는다.

[GetMemo](../src/modules/notes/application/use-cases/memos/get-memo.use-case.ts)의 실제 흐름 발췌:

```ts
async execute(input: GetMemoInput): Promise<GetMemoResult> {
  const memo = await this.#dependencies.repository.findByIdAndUserId(input.memoId, input.userId);
  if (memo === null) {
    throw new ApplicationException(ErrorCode.MEMO_2001, {
      memoId: input.memoId,
    });
  }

  return { memo: toMemoView(memo) };
}
```

읽기 UseCase에는 상태 없는 Aggregate를 만들지 않는다. 상태 전이는 해당 모델의 명명된 행동으로, 여러 입력의 순수 판단은 함수/Policy로 표현한다. 일부 필드만 바꾸는 입력은 presence 확인 후 해당 행동을 호출하며 범용 `Object.assign`으로 invariant를 우회하지 않는다.

생성 정책과 저장 복원을 구분한다. 계획된 신규 상태는 해당 모델의 create/planCreation 규칙으로, 신뢰한 영속 상태는 reconstitute로 복원한다. 모든 primitive에 VO를 요구하지 않는다.

## Port·Adapter·조립

Port는 Application의 언어로 외부 경계를 표현한다. ORM row/client와 vendor SDK 타입을 UseCase에 반환하지 않는다. Adapter는 기존 SDK/ORM API를 사용해 경계 표현을 변환하며 공급자 policy를 중립 Domain에 넣지 않는다.

[UpsertLocation](../src/modules/weather/application/use-cases/forecast/upsert-location.use-case.ts)의 실제 최소 의존성:

```ts
readonly weatherLocationRepository: Pick<
  WeatherLocationRepositoryPort,
  "findByUserId" | "upsert"
>;
readonly weatherCache: Pick<WeatherCachePort, "invalidateGrid">;
readonly weatherGridResolver: Pick<WeatherGridResolverPort, "resolveGrid">;
```

순수 Application에 Nest decorator를 붙이지 않는다. Context root의 factory provider가 실제 token/구현을 주입한다. [Notes factory](../src/modules/notes/notes-memos-application.providers.ts)의 실제 발췌:

```ts
export const getMemoProvider: FactoryProvider<GetMemo> = {
  provide: GetMemo,
  inject: [MEMO_REPOSITORY],
  useFactory: (repository: ConstructorParameters<typeof GetMemo>[0]["repository"]) =>
    new GetMemo({ repository }),
};
```

타 Context에는 실제 필요한 value/type만 public으로 연결한다. 내부 UseCase·concrete Repository·테스트 helper를 묶어 export하지 않는다. 단순 public forwarding 파일이 필요한지와 runtime cycle을 함께 확인한다.

## 저장·효과·캐시

업무 원자성은 UoW와 실제 DB lock/constraint/conditional write로 구현한다. 활성 transaction은 CLS에서 읽고 tx 인자를 계층마다 전달하지 않는다. 실패 기록, commit 뒤 publish/queue, best-effort cache settle은 각 흐름의 기존 의미를 따른다. 외부 AI·push·email 호출은 긴 DB transaction 밖에 둔다.

캐시에는 의미 기반 Port를 사용한다. raw key·TTL·pattern·Redis command는 Infrastructure keyspace에 둔다. queue name/payload/attempt/backoff/재시도 의미도 소유 Context에 응집한다. 제거하거나 바꾸려면 실제 운영 소비자와 전환 범위를 함께 처리한다.

## 순수 라이브러리와 표시

단순 map/filter/guard는 그대로 둔다. 묶기·중복 제거 등에서 의미가 분명하면 기존 es-toolkit을 직접 사용한다. [recorded-activity-evidence.ts](../src/modules/ai-assistance/domain/services/suggestions/recorded-activity-evidence.ts)는 다음 실제 호출로 활동을 한 번 그룹화한다.

```ts
Object.entries(groupBy(todos, (todo) => todo.title));
```

구분 가능한 union의 누락 없는 분기에는 기존 ts-pattern `match(...).with(...).exhaustive()`가 유용하다. boolean guard를 match로 늘리지 않는다. SDK 기본 기능을 대체하는 retry/timeout/serialization wrapper를 만들기 전에 설치된 API와 현재 호출을 확인한다.

사용자 표시 copy·locale label·AI prompt/schema는 Application typed catalog 또는 Presentation에서 다룬다. Domain은 숫자·상태 판단을 소유한다. 기존 locale/기본값/문구 호환을 유지하며 작은 두 언어 선택에 범용 i18n registry를 도입하지 않는다.

## 오류와 확인

Domain invariant는 DomainException, Application 거부는 ApplicationException과 기존 ErrorCode를 사용한다. HTTP 변환은 platform filter가 담당한다. 원문 개인정보·prompt·공급자 error를 로그에 전달하지 않는다. [logging-guide.md](logging-guide.md)에 형식과 실제 사례가 있다.

코드·문서 변경 위험에 맞는 검증을 [testing-guide.md](testing-guide.md)에서 선택한다. 구조 검토에서는 실제 consumer/module 연결을, transaction 검토에서는 native DB 증거를, HTTP 변경에서는 계약 테스트를 확인한다. 통과한 전체 검사를 파일마다 반복하거나 구현과 같은 소스 파싱 테스트를 새로 만들지 않는다.
