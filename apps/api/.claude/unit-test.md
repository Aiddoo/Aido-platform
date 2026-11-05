# 서버 Unit 테스트

순수 Domain/Application은 직접 생성한다. 상태나 발송 기록이 필요하면 기존 fixture와 작은 Port Stub/Fake를 쓴다. 실행 선택은 [testing-guide.md](./testing-guide.md)에 있다.

## 의미 있는 케이스

```ts
describe("CreateTodo — 할 일 생성", () => {
  it("권한이 없으면 저장 없이 오류를 반환한다", async () => {
    // Given
    const repository = new StubTodoRepository();

    // When
    const result = useCase.execute(input);

    // Then
    await expect(result).rejects.toThrow(ApplicationException);
    expect(repository.saved).toEqual([]);
  });
});
```

- `// Given`·`// When`·`// Then`은 각각 한 줄이다. `// When / Then` 합본과 `// Given - 설명` 꼬리 설명은 쓰지 않는다.
- 정상·누락·null·false·0·중복·만료·권한·retry는 계약에 필요한 경우만 본다. 입력이 다른데 행동이 같은 케이스는 모은다.
- Aggregate/VO의 생성·`reconstitute()`와 공개 행동을 쓴다. private 상태나 내부 메서드를 spy하지 않는다.
- 결과·저장/발송 상태·실패 우선순위를 확인한다. 호출 횟수·외부 호출 0·민감정보 비노출이 요구일 때만 호출을 관찰한다.

## fixture와 의존성

생성자에는 실제 쓰는 의존성을 명시적으로 넘긴다. `ConstructorParameters<typeof UseCase>[0]["dependency"]`나 consumer Port의 좁은 타입을 쓴다. full Port로 cast하거나 deep mock을 spread하지 않는다.

- 반환값과 상태·발송 기록은 작은 Stub이 소유한다. 한 spec에서만 쓰면 그 spec에 두고, 여러 곳에서 쓸 때만 `test/mocks`로 옮긴다.
- 기존 `test/builders`, `test/fixtures`, `test/mocks`를 먼저 찾는다. 새 필드는 소유 fixture 기본값 한곳에 더하고 시나리오에서는 차이만 덮어쓴다.
- 공급자 raw 응답은 기본값과 자동 merge하지 않는다. 필수 누락·잘못된 타입이 schema에서 거절되는지 본다.
- 호출 자체가 계약일 때만 Vitest와 `vitest-mock-extended`를 쓴다. 새 mock 라이브러리를 더하지 않는다.
- `createUnitOfWorkMock()`과 callback Stub은 실행 순서·실패 전달만 본다. CLS·rollback·row lock·durable attempt는 [실제 PG](./integration-test.md)에서 본다.

사례:

- [InMemoryPushDeviceStore](../test/mocks/in-memory-push-device.store.ts): 기기 기록과 토큰을 메모리에 두고 등록·소유권 이전·세션별 삭제를 상태로 확인한다.
- [StubSessionPushDeviceReleaser](../test/mocks/ports/auth-session.stub.ts): 해제를 요청한 sessionId를 순서대로 기록한다.
- [TransactionalEmailSender](../src/modules/notification/application/senders/email/transactional-email.sender.spec.ts): 큐·예산 Stub에 템플릿·태그·발송 결과를 기록한다.
- [ReconcilePushReceipts](../src/modules/notification/application/use-cases/delivery/reconcile-push-receipts.use-case.spec.ts): 캐시 상태와 commit gate로 실패 전달과 커밋 뒤 무효화를 본다.
- [Weather 조건 조회](../src/modules/weather/application/use-cases/forecast/get-weather-conditions.use-case.spec.ts): 시간·날짜·부분 결과 경계를 본다.

## 날짜와 timer

날짜 판단만 필요한 테스트는 Date만 fake하고 복원한다. PostgreSQL/socket/job의 native timer는 유지한다.

```ts
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-07-23T16:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});
```

UTC 순간, 달력 날짜, 사용자 시간대, 공급자 시간대를 구분한다. 경계 목록은 [날짜 규칙](../../../docs/conventions/dates.md#4-테스트할-경계)에 있다. 변경한 판단이 영향을 받는 경계만 넣는다. dayjs 값의 단순 add/subtract가 DST를 보정한다고 가정하지 않는다. 테스트용 새 시간 API를 만들지 않는다.

timer 자체가 계약인 retry/backoff는 fake timer를 쓸 수 있다. 임의 sleep이나 polling으로 완료를 추측하지 않는다.

## Infrastructure·Presentation과 공급자 wire

Nest metadata/DI가 필요한 대상은 `TestBed.solitary()` 또는 `Test.createTestingModule()`을 쓴다. 실제 Module 조립이 요구라면 운영 factory provider를 재사용하는 Integration/HTTP로 본다.

공급자 검증은 설치된 실제 SDK + fetch/HTTP Stub + fixture `Response`다. 미준비 요청은 실제 네트워크로 보내지 않는다. SDK 전체 mock은 기본으로 쓰지 않는다.

- [Resend Adapter](../src/modules/notification/infrastructure/adapters/email/resend-email-sender.adapter.spec.ts), [StubResendHttp](../test/mocks/resend-http.stub.ts): `describeEmailSenderContract`와 SDK의 payload·헤더·오류·회로를 본다.
- [AI SDK Generator](../src/modules/ai-assistance/infrastructure/adapters/generation/ai-sdk.generator.spec.ts): 실제 SDK의 wire와 schema-invalid JSON 거절을 본다. 모델 품질의 증거는 아니다.
- global/env 교체는 비동시 suite에서만 하고 `afterEach`에 복원한다.

SQL 문장을 볼 때는 [drizzle.mock.ts](../test/mocks/drizzle.mock.ts)의 `createFakeDatabase`·`createFakeTransactionHost`(실제 Drizzle + 가짜 pg Pool), `renderSql`, `createMockDrizzleTransactionHost`를 쓴다. SQL의 실제 실행 의미는 증명하지 못한다.
