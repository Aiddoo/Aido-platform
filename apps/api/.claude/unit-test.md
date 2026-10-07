# 서버 Unit 테스트

순수 Domain/Application은 직접 생성하고 `vitest-mock-extended`로 의존성을 대체한다.
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

생성자 의존성 타입을 재정의하지 않는다. 라이브러리의 typed deep mock과 기존 fixture를 사용한다.

```ts
import { mockDeep } from 'vitest-mock-extended';

import { GetFeatureDiscovery } from './get-feature-discovery.use-case.js';

describe('GetFeatureDiscovery — 기능 발견 설정 조회', () => {
  it('기능이 비활성화되어 있으면 비활성 설정을 반환한다', () => {
    // Given
    const dependencies = mockDeep<ConstructorParameters<typeof GetFeatureDiscovery>[0]>();
    dependencies.config.getFeatureDiscovery.mockReturnValue({ enabled: false });
    const useCase = new GetFeatureDiscovery(dependencies);

    // When
    const result = useCase.execute();

    // Then
    expect(result).toEqual({ enabled: false });
  });
});
```

- 공통 의존성은 `beforeEach`에서 준비하고 해당 시나리오의 반환값만 테스트 안에서 설정한다.
- transaction 콜백을 실제로 실행해야 하면 기존 `createUnitOfWorkMock()`을 주입한다.
- nested mock 생성은 라이브러리에 맡긴다. 모든 port 메서드를 테스트마다 수동으로 복제하지 않는다.
- 특별한 실행 의미를 가진 기존 port fixture는 재사용한다. 새로운 fake framework를 만들지 않는다.
- 새 필드는 소유 fixture의 기본값 한곳에 추가하고 시나리오별 override만 유지한다.
- 순수 Domain 상태는 Aggregate/VO의 `reconstitute()`로 복원한다. private state에 접근하지 않는다.

## Infrastructure·Presentation

Nest decorator/token 연결이 필요한 클래스는 `TestBed.solitary()` 또는 `Test.createTestingModule()`로
검증한다. Application factory provider를 bare class provider로 대체하지 않는다. 실제 Module 조립은
Integration/E2E가 검증한다. SDK module mock은 `vi.hoisted`·`vi.mock`을 사용하고 오류 클래스와
순수 검증 함수는 `importOriginal`로 유지한다.

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
