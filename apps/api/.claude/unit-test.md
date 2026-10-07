# 서버 Unit 테스트

순수 Domain/Application은 직접 생성한다. 상태나 발송 기록이 필요하면 기존 fixture와 작은 Port Stub/Fake를 사용한다. 전체 실행 선택은 [testing-guide.md](./testing-guide.md)를 참고한다.

## 의미 있는 케이스

- `describe("CreateTodo — 할 일 생성")`, `it("권한이 없으면 저장 없이 오류를 반환한다")`처럼 한국어로 조건과 결과를 쓴다. Given / When / Then 순서는 유지하되 코드로 충분한 단계에 긴 주석을 붙이지 않는다.
- 정상·누락·null·false·0·중복·만료·권한·retry는 실제 계약에 필요한 경우만 검증한다. 입력이 다른데 같은 행동을 반복하는 케이스는 모을 수 있다.
- Aggregate/VO의 생성·`reconstitute()`와 공개 행동을 사용한다. private/protected state나 내부 메서드를 spy하지 않는다. 상태 없는 조회/전달 테스트를 위해 Aggregate·DB를 만들지 않는다.
- 결과·저장/발송 상태·실패 우선순위를 확인한다. 반복 횟수·batch miss·외부 호출0·민감정보 비노출이 요구일 때는 호출 관찰도 의미 있다. 단순 forwarding이나 구현의 줄별 복사 테스트는 피한다.

## fixture와 의존성

생성자에는 소비자가 실제 사용하는 의존성을 명시적으로 전달한다. `ConstructorParameters<typeof UseCase>[0]["dependency"]` 또는 기존 consumer Port의 좁은 타입을 사용할 수 있다. full Port로 cast하거나 lazy deep mock을 spread해 타입/필드를 숨기지 않는다.

- 반환값과 mutable 상태·발송 기록은 작은 Stub이 소유한다. 한 spec에서만 쓰면 그 spec에 두고, 여러 곳에서 실제 재사용될 때만 `test/mocks`로 옮긴다. 전체 Port를 재조합하는 범용 fake framework는 필요 없다.
- 기존 `test/builders`, `test/fixtures`, `test/mocks`를 먼저 확인한다. 의미 있는 새 필드는 소유 fixture 기본값 한곳에 추가하고 각 시나리오에서는 차이만 덮어쓴다. 실제 raw 공급자 응답은 기본 정상값과 자동 merge하지 않는다. 필수 누락·잘못된 타입이 원래 schema에서 거절되는지 확인한다.
- 타입에 `implements`/기존 Port를 연결하고 실제 mutable 설정을 `clear()`/resetter로 복원한다. ID 고정값은 관계·경쟁·에러의 의미를 명확히 하는 fixture에서 사용할 수 있다. 모든 값을 Builder로 만들 필요는 없다.
- 상호작용 검증은 설치된 Vitest와 `vitest-mock-extended`를 재사용한다. 반환값만 필요한 의존성에 deep mock을 기본으로 쓰지 않는다. 특정 matcher helper나 새 mock 라이브러리를 의무화하지 않는다.
- `createUnitOfWorkMock()`과 callback Stub은 실행 순서·실패 전달만 검증한다. CLS·DB rollback·row lock·durable attempt는 [실제 PG](./integration-test.md)에서 검증한다.

실제 예제:

- [TransactionalEmailSender](../src/modules/notification/application/senders/email/transactional-email.sender.spec.ts): state Stub에 실제 템플릿·태그·결과를 기록한다.
- [ReconcilePushReceipts](../src/modules/notification/application/use-cases/delivery/reconcile-push-receipts.use-case.spec.ts): 캐시 상태와 commit gate로 실패 전달/커밋 뒤 무효화를 검증한다. 실제 receipt rollback 증거와 분리한다.
- [Weather 조건 조회](../src/modules/weather/application/use-cases/forecast/get-weather-conditions.use-case.spec.ts): 실제 Application 흐름과 fixture의 시간·날짜·부분 결과 경계를 확인한다.

## 날짜와 timer

날짜 판단만 필요한 테스트는 Date만 fake하고 `finally` 또는 `afterEach`에서 복원한다. PostgreSQL/socket/job가 사용하는 native timer는 유지한다.

```ts
vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date("2026-07-23T16:00:00Z"));
try {
  // Given / When / Then: 같은 instant에서 요구한 날짜·시간 결과 확인
} finally {
  vi.useRealTimers();
}
```

UTC 저장 instant, calendar DATE, 사용자 timezone, 공급자 timezone을 구분한다. KST 자정·UTC 날짜 교차·Sunday ISO week·DST 전환은 변경한 판단이 영향을 받는 경우에 넣는다. 같은 instant를 process TZ만 바꿨을 때 결과가 달라져야 하는지 먼저 정한다. Dayjs timezone 값에 단순 add/subtract가 DST offset을 보정한다고 가정하지 않고 실제 요청 기간의 UTC 경계를 확인한다. 기존 timezone helper를 재사용하며 테스트용 새 시간 API를 만들지 않는다.

timer 자체가 계약인 retry/backoff 테스트는 fake timer를 쓸 수 있다. DB가 없는 격리된 suite에서 공식 timer advancement로 진행하고 globals/env/timer를 복원한다. 임의 sleep이나 polling으로 완료를 추측하지 않는다.

## Infrastructure·Presentation과 공급자 wire

Nest metadata/DI가 필요한 대상은 기존 `TestBed.solitary()` 또는 `Test.createTestingModule()`을 사용할 수 있다. 실제 Module 조립이 요구라면 운영 factory provider를 재사용하는 Integration/HTTP로 확인한다. Application factory를 bare class provider로 바꾸거나 테스트 전용 조립을 정답으로 삼지 않는다.

현재 서버의 공급자 검증은 설치된 실제 SDK + fetch/HTTP Stub + fixture `Response`를 사용한다. MSW 공통 harness는 현재 서버에 없다. 기존 Stub으로 충분하면 문서 패턴을 맞추려고 MSW나 다른 의존성을 추가하지 않는다. 해당 작업에 이미 MSW 환경이 있는 경우에도 unmatched 요청을 차단하고 테스트 사이 handlers를 복원하는 같은 격리 원칙을 적용한다.

- [Resend Adapter](../src/modules/notification/infrastructure/adapters/email/resend-email-sender.adapter.spec.ts), [StubResendHttp](../test/mocks/resend-http.stub.ts): SDK의 payload·헤더·오류를 고정 HTTP 응답으로 확인한다. 미준비 요청은 실제 네트워크로 전달하지 않는다.
- [Gemini Adapter](../src/modules/ai-assistance/infrastructure/adapters/parsing/gemini-ai.adapter.spec.ts): 실제 Google factory/설치 SDK의 wire와 schema-invalid raw JSON 거절을 확인한다. Fake/schema 통과는 실제 모델의 의미 품질이나 유료 가치 증거가 아니다.
- fetch 주입 또는 해당 suite의 `vi.stubGlobal`/spy를 이용한다. global/env 교체는 비동시 suite에서만 하고 `afterEach`에 복원한다. SDK 전체 mock은 기본으로 쓰지 않는다. 불가피한 경우 실제 오류 타입·schema 검증 경계를 남기고 검증하지 못한 wire 범위를 기록한다.

ORM mock의 `.all()` 결과는 `nativeRows(databaseFixture(...))`, 단건은 필요한 projection 필드와 실제 null을 반환한다. `assertNativeWhere`/`assertNativeOrder`로 AST·바인딩을 확인할 수 있지만 SQL의 실제 실행 의미를 입증하지는 않는다.
