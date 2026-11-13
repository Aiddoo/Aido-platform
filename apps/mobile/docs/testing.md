# 모바일 테스트

자동 테스트는 제품 규칙과 계약 경계에만 쓴다. 화면 배치·키보드·성능은 실제 기기에서 확인한다. 공통 규칙(GWT 주석, 한국어 제목, stub 우선, 외부 API 금지, 일괄 교체 금지)은 [루트 공통 코드 규칙](../../../AGENTS.md#공통-코드-규칙)과 [테스트 파일 이름과 형식](../../../docs/conventions/testing.md)에 있다. 이 문서는 앱에만 해당하는 범위·격리 규칙이고, 공용 도구·fixture·Jest 설정은 [testing-tools](./testing-tools.md)에 있다.

## 도구와 범위

Jest + `jest-expo`(Expo 권장, Vitest로 바꾸지 않는다), React Native Testing Library, E2E는 Maestro다. 테스트 개수와 커버리지 수치는 목표가 아니다.

| 쓴다                                                                 | 쓰지 않는다                                              |
| -------------------------------------------------------------------- | -------------------------------------------------------- |
| 모델·Policy 경계값(`it.each`)                                        | 문구·아이콘·배치·variant·빈 상태 렌더                    |
| 비자명한 mapper(fixture는 계약으로 검증)                             | `parseApiResponse`가 보장하는 4xx·파싱을 메서드마다 확인 |
| 저장 키 호환·이주·깨진 값 복구                                       | 기하·파티클·애니메이션·분석 라벨                         |
| cache·낙관적 갱신·롤백(캐시 상태로 단언)                             | 스냅숏, 스타일 단언                                      |
| 핵심 흐름: 인증, 토큰 갱신, 푸시 탭, 결제, 딥링크, 권한·동의         | 모델 테스트를 화면으로 다시 확인                         |
| 사용자 결과: 두 번 제출, 실패해도 입력 유지, 키보드 첫 탭, 다시 시도 | 내부 호출 횟수(바깥 경계 HTTP·분석·햅틱·네이티브만 본다) |

- 돈·권한·한도·시간대·자정·서머타임, 오프라인·서버 500·토큰 만료, 삭제된 대상, 다른 계정 섞임, 재현된 버그도 쓴다.
- 단순 세터, 필드 그대로 옮기는 mapper, 라이브러리 동작, getter·상수·한 줄 위임, hook·Provider·Query Options의 배선, Router·Keyboard·FlashList를 mock으로 재현하는 테스트는 쓰지 않는다.
- 컴포넌트·hook 회귀가 걱정되면 판단을 순수 함수(model·policy·view-model·resolver)로 빼서 그 함수를 테스트한다.
- 기존 테스트가 "쓰지 않는다"에 들면 사유를 적어 지워도 된다. 규칙을 지키던 테스트를 형식 때문에 지우지는 않는다.
- 경계(오늘·자정·DST·언어, route·푸시·위젯 URI 해석, 저장 JSON 버전)는 순수 함수 테스트로 고정한다([날짜 경계](../../../docs/conventions/dates.md#4-테스트할-경계)).

## 파일 위치와 이름

접미사(`*.test.ts(x)`, `*.flow.test.tsx`, `*.android.test.ts(x)`), 원본 하나에 테스트 파일 하나, `describe`·GWT 형식은 [테스트 파일 이름과 형식](../../../docs/conventions/testing.md)이 원본이다. 앱에만 있는 자리는 아래다.

| 종류              | 자리·이름                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------- |
| route 화면        | `src/features/{feature}/__tests__/{route}-screen.test.tsx`(`app/`에는 route만 둔다)         |
| 기능 fixture·도구 | `__tests__/{entity}.fixtures.ts`, `{feature}.test-utils.tsx`                                |
| 공용 도구         | `src/testing/`([testing-tools](./testing-tools.md))                                         |
| E2E               | `.maestro/flows/{feature}/*.yaml`, `subflows/`, `scripts/`                                  |
| 설정·스크립트     | `plugins/__tests__/*.test.mjs`, `scripts/__tests__/*.test.mjs`(node:test, `pnpm test:node`) |

## 작성 규칙

- 의미 있는 성공·실패·경계 분기만 남긴다.
- `jest.fn()`·spy는 호출 자체가 계약일 때(요청 path, 토큰 해제 순서)와 시간·UUID 같은 실제 경계에만 둔다.
- 모듈 `jest.mock`은 `shared/infra` 어댑터 테스트의 SDK에만 쓴다. `@src/…` 모듈은 mock하지 않고 포트 stub을 넣는다. 네이티브 모듈 대체는 `jest.setup.ts`·`jest.config.js`의 `moduleNameMapper`에 둔다. 실제 라우터를 쓰는 테스트의 `jest.unmock('expo-router')`는 허용한다.
- `env.ts`를 파일별로 mock하지 않는다. `jest.setup.ts`가 앱 시작과 같은 경로(`expo-constants`)로 값을 준다.
- 실제 타이머를 기다리지 않는다. 시간을 인자로 주거나 fake timer를 쓰고, 비동기가 섞이면 `await jest.advanceTimersByTimeAsync(ms)`를 쓴다.
- 렌더 뒤 `waitFor`·`findBy*`로 팝오버·토스트를 기다리는 파일은 describe 전체에 fake timer를 걸면 순서에 따라 흔들린다. 시간이 필요한 테스트만 안쪽 `describe`로 묶어 그 안에서 `setupFakeTimersPerTest`를 쓴다(`advanceTimers: true`는 사용자 입력이 함께 도는 경우만).
- 여러 프레임워크 mock을 조립하기 시작하면 순수 로직 추출을 먼저 검토한다.

### 금지(lint)

아래는 lint가 막고 남은 예외 지시문이 없다. `oxlint-disable`로 건너뛰지 않고 대신 쓸 것으로 바꾼다.

- `jest.useFakeTimers`·`useRealTimers`(`jest/no-restricted-jest-methods`) → `setupFakeTimersPerTest(config)`(`{ now }`로 시각, 중간에 옮길 때 `jest.setSystemTime`).
- 실제 sleep(`aido/no-real-sleep`) → 마이크로태스크만 비우면 `await jest.advanceTimersByTimeAsync(0)`, 일정 시간 안 열리는지는 `await act(() => jest.advanceTimersByTimeAsync(600))`, 쿼리 알림은 `deliverQueryNotifications()`.
- `Date.now`·`AppState`·`queryClient.invalidateQueries` spy(`aido/test-spy-target`) → `setupFakeTimersPerTest({ now })`, `createAppLifecycleGatewayStub`, `setQueryData` 뒤 `getQueryState(key)?.isInvalidated` 단언(마운트한 쿼리면 `queryFn` 재호출 횟수).
- 스타일 단언(`aido/no-style-assertion`), 스냅숏(`jest/no-restricted-matchers`), `app/` 아래 테스트(ls-lint), 테스트의 `new QueryClient`(`no-restricted-imports` → `createTestQueryClient`).

## 격리

설정이 `clearMocks`와 `restoreMocks`를 켠다. `clearMocks`는 호출 기록만, `restoreMocks`는 `jest.spyOn` spy만 되돌린다. `jest.fn()`에 정한 `mockReturnValue`·`mockImplementation`은 지우지 않는다(`resetMocks`는 공용 stub 구현까지 지워 켜지 않는다).

- 상태를 가진 stub·fake, `QueryClient`, 저장소는 테스트마다 새로 만든다. 모듈 수준 공유 인스턴스를 두지 않는다. 모듈 수준 `let`은 `beforeEach`에서 다시 만든다.
- fake timer는 `setupFakeTimersPerTest(config)`로만 켠다. `beforeEach`에서 켜고 `afterEach`에서 ① 화면을 내리고(`cleanup`) ② 남은 타이머를 한 번 흘린 뒤(`jest.runOnlyPendingTimers`) ③ 진짜 타이머로 되돌린다. 파일에서 바로 `jest.useRealTimers()`를 부르면 화면을 내릴 때 생긴 타이머가 남아 worker가 끝나지 못한다. 모듈 수준에서 켜지 않는다.
- 화면을 떠난 뒤 오는 응답·토스트는 `findBy*`로 기다려 확인하거나 fake timer 안에 가둔다. 결과를 확인하지 않고 끝내지 않는다.
- 이미 `jest.fn()`인 대상(`View.prototype.measure` 등)에 `jest.spyOn(...).mockImplementation`을 걸면 `restoreMocks`가 되돌리지 못한다. `afterEach`에서 `mockReset()`한다.
- 테스트는 늘 무작위 순서다(`randomize: true`, `showSeed: true`). 실패하면 출력된 seed로 `pnpm --filter @aido/mobile test --seed <seed>`를 실행해 재현하고 순서 의존을 고친다.
- "worker process has failed to exit gracefully"나 "Jest did not exit"는 누수다. 영역별로 나눠 파일을 좁히고 남은 타이머를 만든 테스트를 위 규칙으로 고친다. `workerIdleMemoryLimit`·`forceExit`로 덮지 않는다.
- `QueryClient`는 `createTestQueryClient()`로만 만든다(`retry: false`, `gcTime: Infinity`). `jest.setup.ts`의 `afterEach`가 화면을 먼저 unmount한 뒤 클라이언트를 비운다(`clearTestQueryClients`). 테스트 안에서 `queryClient.clear()`를 부르지 않는다.

## 실제 기기 확인

단위 테스트가 대신할 수 없는 항목이다. 시뮬레이터 영상은 동작·레이아웃 증거일 뿐 60/120 FPS를 증명하지 않는다. 성능 수치는 Release 실기기에서 잰다.

| 영역    | 확인 항목                                                                             |
| ------- | ------------------------------------------------------------------------------------- |
| 키보드  | 첫 focus, 닫기·재열기, 마지막 항목 가림, interactive dismiss, 첫 탭에 버튼이 눌리는가 |
| 목록    | 첫 frame 위치, prepend 유지, 빈 frame·skeleton flash·layout shift                     |
| 접근성  | VoiceOver/TalkBack, focus 순서, 동작 이름, Reduce Motion                              |
| 큰 글꼴 | 긴 한글·무공백 영문, multiline 입력, 44pt touch target                                |
| 테마    | light/dark semantic color와 대비                                                      |
| 성능    | Release 실기기의 JS/UI frame time, keyboard animation, 긴 목록 메모리                 |

## Maestro E2E

출시 빌드마다 `e2e:smoke`, 출시 전 회귀에 `e2e` 전체, 기능을 고친 PR은 `e2e:feature <기능>`을 돌린다. 업무 규칙 분기·오류 코드는 단위 테스트가 지키고, 흐름 구조·이름·태그·추가 순서·자동화하지 않는 수동 확인은 [.maestro/README](../.maestro/README.md)가 원본이다.

## 실행 명령

```bash
pnpm --filter @aido/mobile test                       # 전체. PR 전에 한 번
pnpm --filter @aido/mobile test src/features/notes/memo  # 한 기능
pnpm --filter @aido/mobile test:changed               # 마지막 커밋 이후 바뀐 파일에 닿는 테스트
pnpm --filter @aido/mobile test:related src/features/notes/memo/domains/memo.model.ts
pnpm --filter @aido/mobile test:watch
pnpm --filter @aido/mobile test --seed <seed>         # 실패한 순서 재현
pnpm --filter @aido/mobile test --runInBand --detectOpenHandles
```

작업을 마칠 때는 바꾼 파일의 테스트와 정적 검증을 먼저 실행한다. 전체 테스트는 공유 코드·공통 설정을 바꿨거나 릴리스 전 회귀 확인이 필요할 때 실행한다.
