---
paths:
  - '**/*.test.{ts,tsx}'
  - 'src/testing/**'
---

# 테스트

**무엇을**

- 쓴다: 모델·Policy 경계값, 비자명한 mapper(fixture는 계약으로 검증), 저장 키 호환·이주·깨진 값 복구, cache·낙관적 갱신·롤백(캐시 상태로 단언), 인증·결제·푸시 탭·딥링크·권한 같은 핵심 흐름, 두 번 제출·실패 시 입력 유지 같은 사용자 결과.
- 쓰지 않는다: 문구·아이콘·배치·variant·빈 상태 렌더, 스냅숏, 스타일 단언, 기하·애니메이션·분석 라벨, `parseApiResponse`가 보장하는 4xx·파싱 반복, 내부 호출 횟수.

**이름과 자리**

- 대상 옆 `*.test.ts(x)`다(JSX가 없으면 `.ts`). 원본 하나에 파일 하나, 여러 모듈 흐름은 `.flow.test.tsx`, Android 전용은 `*.android.test.ts(x)`.
- route 화면 테스트는 `src/features/{feature}/__tests__/{route}-screen.test.tsx`다. `app/`에 테스트를 두지 않는다.
- 맨 위 `describe`는 대상의 코드 이름, 안쪽은 한국어 시나리오다. `// When`·`// Then`은 필수이고 `// Given`은 준비가 있을 때만 쓴다.

**도구**

- fixture는 `__tests__/{entity}.fixtures.ts`에 `defineFixture(schema, defaults)`로 만든다.
- 공용 도구는 `src/testing/`(`ports/*.stub.ts`, `render.tsx`, `render-route-hook.tsx`의 `renderAppRoute`, `di.ts`의 `createTestPorts`·`createTestDi({ ports, seeds })`, `query-client.ts`, `timers.ts`)다. 늦게 끝나는 Promise는 `Promise.withResolvers()`다. DI에는 포트와 상태 store만 넣고 Service를 손으로 조립하지 않는다.
- mock보다 포트 stub이다. 모듈 `jest.mock`은 `shared/infra` 어댑터 테스트의 SDK에만 쓴다. 외부 API를 부르지 않는다.
- 타이머는 `setupFakeTimersPerTest`만 쓴다. `jest.useFakeTimers`를 직접 부르지 않는다.
- 금지: 실제 sleep, `Date.now`·`AppState`·`queryClient.invalidateQueries` spy. 시간은 주입한 `now`와 fake timer로 다룬다.
- 누름 동작은 RNTL 통과 뒤 기기에서도 확인한다.

자세히: [테스트 범위·격리](../../docs/testing.md) · [테스트 도구](../../docs/testing-tools.md)
