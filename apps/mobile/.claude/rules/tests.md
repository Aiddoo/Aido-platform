---
paths:
  - '**/*.test.{ts,tsx}'
  - 'src/testing/**'
---

# 테스트

무엇을 테스트할지는 [모바일 테스트](../../docs/testing.md#도구와-범위), 파일 이름·본문 형식은 [테스트 파일](../../../../docs/conventions/testing.md), 공용 도구·fixture는 [테스트 도구](../../docs/testing-tools.md)가 원본이다. 아래는 lint가 막는 것이다.

- 본문 단계 주석 형식(`aido/test-gwt-comments`).
- 모듈 `jest.mock`은 `shared/infra` 어댑터 테스트의 SDK에만 쓴다(`aido/no-jest-module-mock`).
- `jest.useFakeTimers`를 직접 부르지 않고 `setupFakeTimersPerTest`를 쓴다(`jest/no-restricted-jest-methods`).
- 실제 sleep, `Date.now`·`AppState`·`queryClient.invalidateQueries` spy, 스타일 단언, 스냅숏을 쓰지 않는다(`aido/no-real-sleep`·`aido/test-spy-target`·`aido/no-style-assertion`·`jest/no-restricted-matchers`).
- 테스트의 `QueryClient`는 `createTestQueryClient`다(`no-restricted-imports`).

전체 금지 목록과 대신 쓸 것은 [금지(lint)](../../docs/testing.md#금지lint)다.
