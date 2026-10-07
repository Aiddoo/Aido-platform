# 서버 Unit 테스트

순수 Domain/Application은 직접 생성하고 fixture 기반 Port Stub/Fake를 우선 사용한다.
Nest DI가 필요한 Infrastructure/Presentation은 기존 `@suites/unit`을 사용한다.
관련 실행·격리 규칙은 [testing-guide.md](./testing-guide.md)를 따른다.

## 이름과 구조

- `describe("CreateTodo — 할 일 생성")`처럼 클래스명과 한국어 업무 설명을 함께 쓴다.
- `it("한도를 초과하면 저장 없이 오류를 반환한다")`처럼 조건과 관찰 가능한 결과를 쓴다.
- 기술 용어, 필드명, HTTP method, 오류 코드, Given / When / Then은 영어를 유지해도 된다.
- 대상 파일 옆에 `<name>.spec.ts`를 둔다. Integration은 `.integration-spec.ts`, E2E는 `.e2e-spec.ts`다.
- Given / When / Then 순서를 유지한다. 단계 주석은 간단히 쓰고 코드 동작을 설명하는 긴 주석은 추가하지 않는다.
- 정상·누락·null·false·0·중복·만료·권한 거부·재시도 분기를 실제 업무 요구에 따라 검증한다.

## Application 의존성 fixture

- consumer-owned Port를 구현한 작은 Stub을 주입한다. 테스트 결과와 발송·저장 기록으로 업무 동작을 검증한다.
- 상태가 필요하면 기존 `FakeEmailService` 등 Fake를 재사용한다. 타입에 `implements`를 명시해 Port 변경을 컴파일 단계에서 확인한다.
- 한 파일에서만 쓰는 작은 Stub은 spec에 둔다. 여러 spec에서 재사용할 때 `test/mocks/<capability>.stub.ts`로 추출한다. 운영 public barrel에 테스트 도구를 export하지 않는다.
- 생성자에는 명시적인 의존성 객체를 전달한다. lazy deep mock을 spread하면 아직 읽지 않은 dependency가 복사되지 않을 수 있으므로 사용하지 않는다.
- 단순 반환값, 발송 기록과 실패 횟수는 Stub이 소유한다. 모든 Port를 다시 조합하는 범용 fake framework는 만들지 않는다.
- 새로운 필드는 소유 fixture의 기본값 한곳에 추가하고, 시나리오별 override만 유지한다.
- Domain 상태는 Aggregate/VO의 `reconstitute()`로 복원한다. protected/private state에 spy하지 않는다.
- mock/spy는 retry·batch 호출 수·민감정보 비노출 등 상호작용 자체가 계약일 때 사용한다. 기존 `vitest-mock-extended`를 재사용하며 반환값만 필요한 Port에는 깊은 mock을 기본으로 만들지 않는다.
- `createUnitOfWorkMock()`은 콜백 실행만 검증한다. 실제 CLS·rollback·durable attempt 증가는 PostgreSQL Integration에서 검증한다.

실제 예제:

- [TransactionalEmailSender spec](../src/modules/notification/application/senders/email/transactional-email.sender.spec.ts): `EmailSenderPort` Stub에 메시지를 기록하고 템플릿·태그·결과를 검증한다.
- [VerificationService spec](../src/modules/identity/application/services/auth/verification.service.spec.ts): 기존 `FakeEmailService`를 재사용해 발송된 코드와 실패 시 미발송을 검증한다. Repository/security/logger의 typed mock은 현재 남아 있으며 Identity 전환 단계에서 필요한 상태 fixture를 정리한다.

## Infrastructure·Presentation

Nest decorator/token 연결이 필요한 클래스는 `TestBed.solitary()` 또는 `Test.createTestingModule()`로
검증한다. Application factory provider를 bare class provider로 대체하지 않는다. 실제 Module 조립은
Integration/E2E가 검증한다. 외부 API Adapter는 실제 SDK와 fixture `Response`를 사용해 wire 형식과 오류 정규화를 검증한다.
`fetch` 주입이 가능하면 생성자로 Stub을 전달한다. SDK가 이를 지원하지 않으면 격리된 spec에서
Vitest의 `vi.stubGlobal("fetch", stub.fetch)`를 사용하고 `afterEach`에서 `vi.unstubAllGlobals()`로
복원한다. 해당 suite에서 concurrent 테스트를 실행하지 않으며 준비되지 않은 요청은 실패시키고
실제 네트워크로 전달하지 않는다. SDK 전체 mock을 기본으로 사용하지 않는다.

[Resend Adapter spec](../src/modules/notification/infrastructure/adapters/email/resend-email-sender.adapter.spec.ts)은
실제 Resend SDK, JSON fixture와 HTTP Stub을 조합한다. retry는
[이메일 Integration](../test/integration/email.integration-spec.ts)에서 fake timer의 공식
`runAllTimersAsync()`로 진행한다. 대기 완료를 polling하거나 non-null assertion으로 결과를 반환하지 않는다.

Repository는 `createMockDatabaseContext()`와 `createMockTransactionHost(context)`를 사용한다.
Prisma 8의 재귀 generic 타입을 Suites의 DeepPartial로 확장하거나 타입 단언으로 우회하지 않는다.
`.all()` 결과는 `nativeRows(databaseFixture(model, rows))`, 단건은 `databaseFixture(model, row)`로
만든다. 조건·정렬은 기존 `assertNativeWhere`·`assertNativeOrder`로 검증한다.
실제 rollback·row lock·동시 실행·constraint는 PostgreSQL Integration에서 확인한다.

## 데이터와 격리

- `#test/builders/index`의 Builder로 상태를 표현하고 `#test/fixtures/index`의 fixture를 재사용한다.
- DB 삽입에는 `test/setup/user-database-fixture.ts` 같은 소유 fixture를 사용한다.
- `clearMocks`·`restoreMocks`와 fixture ID reset은 전역 setup이 소유한다.
- spy는 `beforeEach`에서 생성한다. `beforeAll` spy는 첫 테스트 전에 복원될 수 있다.
- 테스트 간 mutable 상태를 공유하지 않는다. Date 입력/출력과 nullable 상태도 실제 계약으로 검증한다.
- 외부 결과와 부수효과를 검증한다. private 메서드, 내부 변수명, 단순 구현 복사 테스트는 만들지 않는다.
- 타입 단언이나 테스트 기대값 변경으로 회귀를 숨기지 않는다.

```bash
pnpm --filter @aido/server test
pnpm --filter @aido/server test get-feature-discovery.use-case.spec.ts
pnpm --filter @aido/server test:cov
```

## 중요한 결과와 결정적인 실행

테스트는 사용자 동작·권한·저장 정합성·중복 발송·쿼리 수·재시도 계약을 보호한다. 인스턴스 존재,
단순 필드 shape, private 메서드 호출, mock 호출만으로 CLS/rollback을 증명하는 테스트는 추가하지 않는다.
같은 업무 흐름의 중복 검증은 하나의 시나리오로 모으며, 개수를 늘리기 위해 테스트를 나누지 않는다.

- 날짜·만료·쿨다운은 `vi.useFakeTimers()`와 `vi.setSystemTime()` 또는 주입한 고정 Clock을 사용한다. 순수 Unit은 매 테스트 후 `vi.useRealTimers()`로 복원한다.
- 실제 DB/socket/job runtime의 timer 전체를 fake로 바꾸지 않는다. 날짜만 제어하거나 영속 timestamp를 명시하고 I/O 수명주기는 실제로 실행한다.
- 입력에 따라 반환이 달라지는 mock은 설치된 Vitest 5의 `vi.when(spy, { onUnmatched: 'throw' }).calledWith(...).thenResolve(...)`를 사용할 수 있다. 정확한 matcher를 먼저 등록하고 무관한 호출이 성공 결과를 받지 않게 한다. 새로운 spy를 매 테스트에서 생성한다.
- 비동시 테스트에서만 globals/env를 대체하고 매 테스트 후 복원한다. 동시 요청 검증은 배열 인덱스 대신 업무 식별자로 결과를 비교한다.
- 변경된 핵심 경로는 순서 shuffle seed와 timezone을 바꿔 반복한다. 통과 조건·seed를 기록하되 유한한 반복으로 flake가 영구적으로 없다고 보장하지 않는다.

공식 API: [Vitest conditional mocking](https://vitest.dev/guide/recipes/conditional-mocking), [fake timers](https://vitest.dev/api/vi.html#vi-usefaketimers).
