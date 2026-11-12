# 모바일 테스트

자동 테스트는 제품 규칙과 계약 경계에만 쓴다. 화면 배치·키보드·성능은 실제 기기에서 확인한다. 공통 규칙(GWT 주석, 한국어 제목, stub 우선, 외부 API 금지, 일괄 교체 금지)은 [루트 공통 코드 규칙](../../../AGENTS.md#공통-코드-규칙)과 [테스트 파일 이름과 형식](../../../docs/conventions/testing.md)에 있다. 이 문서는 앱에만 해당하는 내용이다.

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
| 공용 도구         | `src/testing/` (아래)                                                                       |
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

lint 규칙마다 baseline 지시문이 0이다. `oxlint-disable`로 건너뛰지 않고 아래 방법으로 바꾼다.

- `jest.useFakeTimers` 직접 호출. `setupFakeTimersPerTest(config)`만 쓴다(`{ now }`로 시각을 맞추고, 중간에 시각을 옮길 때는 `jest.setSystemTime`).
- 실제 sleep. 마이크로태스크만 비우면 `await jest.advanceTimersByTimeAsync(0)`, 일정 시간 동안 안 열리는지는 `await act(() => jest.advanceTimersByTimeAsync(600))`로 본다. 쿼리 알림이 다 나가기를 기다릴 때는 `src/testing`의 `deliverQueryNotifications()` 하나를 쓴다.
- spy: `Date.now`(`setupFakeTimersPerTest({ now })`나 시각을 인자로 받는 순수 함수), `AppState`(`createAppLifecycleGatewayStub`을 쓴다), `queryClient.invalidateQueries`(쿼리를 `setQueryData`로 넣어 두고 `getQueryState(key)?.isInvalidated`로 단언한다. 마운트한 쿼리라면 `queryFn` 재호출 횟수를 본다).
- 스타일 단언.
- `app/` 아래 테스트 파일(ls-lint).
- 테스트의 `new QueryClient`.

## 격리

설정이 `clearMocks`와 `restoreMocks`를 켠다. `clearMocks`는 호출 기록만, `restoreMocks`는 `jest.spyOn` spy만 되돌린다. `jest.fn()`에 정한 `mockReturnValue`·`mockImplementation`은 지우지 않는다(`resetMocks`는 공용 stub 구현까지 지워 켜지 않는다).

- 상태를 가진 stub·fake, `QueryClient`, 저장소는 테스트마다 새로 만든다. 모듈 수준 공유 인스턴스를 두지 않는다. 모듈 수준 `let`은 `beforeEach`에서 다시 만든다.
- fake timer는 `setupFakeTimersPerTest(config)`로만 켠다. `beforeEach`에서 켜고 `afterEach`에서 ① 화면을 내리고(`cleanup`) ② 남은 타이머를 한 번 흘린 뒤(`jest.runOnlyPendingTimers`) ③ 진짜 타이머로 되돌린다. 파일에서 바로 `jest.useRealTimers()`를 부르면 화면을 내릴 때 생긴 타이머가 남아 worker가 끝나지 못한다. 모듈 수준에서 켜지 않는다.
- 화면을 떠난 뒤 오는 응답·토스트는 `findBy*`로 기다려 확인하거나 fake timer 안에 가둔다. 결과를 확인하지 않고 끝내지 않는다.
- 이미 `jest.fn()`인 대상(`View.prototype.measure` 등)에 `jest.spyOn(...).mockImplementation`을 걸면 `restoreMocks`가 되돌리지 못한다. `afterEach`에서 `mockReset()`한다.
- 테스트는 늘 무작위 순서다(`randomize: true`, `showSeed: true`). 실패하면 출력된 seed로 `pnpm --filter @aido/mobile test --seed <seed>`를 실행해 재현하고 순서 의존을 고친다.
- "worker process has failed to exit gracefully"나 "Jest did not exit"는 누수다. 영역별로 나눠 파일을 좁히고 남은 타이머를 만든 테스트를 위 규칙으로 고친다. `workerIdleMemoryLimit`·`forceExit`로 덮지 않는다.
- `QueryClient`는 `createTestQueryClient()`로만 만든다(`retry: false`, `gcTime: Infinity`). `jest.setup.ts`의 `afterEach`가 화면을 먼저 unmount한 뒤 클라이언트를 비운다(`clearTestQueryClients`). 테스트 안에서 `queryClient.clear()`를 부르지 않는다.

## Jest 설정

- 전역 옵션(`testTimeout`·`randomize`·`maxWorkers` 등)은 `module.exports`에, 프로젝트 옵션(`cacheDirectory`·`setupFilesAfterEnv` 등)은 `base`에 둔다. 반대로 두면 Jest가 조용히 무시한다(`jest --showConfig`로 확인).
- 유지: `randomize`+`showSeed`, `workerIdleMemoryLimit`, `maxWorkers` 50%(`AIDO_TEST_WORKERS`로 조절, `@aido/test-config`의 `resolveTestWorkers`), `clearMocks`·`restoreMocks`, 테스트에서도 React Compiler.
- 추가한 것: 프로젝트마다 `cacheDirectory`(`node_modules/.cache/jest`), 전역 `testTimeout` 15초·`errorOnDeprecated`(지원 중단 Jest API를 바로 실패시킨다), CI(`CI=true`)에서 `logHeapUsage`(`--ci`는 Jest가 CI 환경에서 스스로 켠다), `test:handles`(`--runInBand --detectOpenHandles`), RNTL `asyncUtilTimeout` 3초, 테스트마다 `clearTestQueryClients`.
- Node 내장 러너 테스트(`scripts/**/__tests__`, `plugins/**/__tests__`, 스토어 그림 `store-metadata/art`)는 `pnpm test:node`가 돌리고 turbo `test:node` 태스크로 CI에 걸린다. `store-listing.test.mjs`는 릴리스 `release.json`이 있어야 해 `test:store-listing`으로 따로 돈다.
- `moduleNameMapper`의 `@aido/api*`는 한 줄이다. `jest.resolver.cjs`는 RN 0.88 preset의 경로 해석을 유지하고 실제 Reanimated·Worklets 패키지 경로만 공식 resolver로 보낸다. pnpm peer suffix에 `react-native-worklets`가 있다는 이유로 ExpoModulesCore까지 웹 구현으로 바꾸면 안 된다([Reanimated 4 Jest testing](https://docs.swmansion.com/react-native-reanimated/docs/guides/testing/)).
- 기기 시간대에 기대는 테스트(피커·자정·서머타임)는 파일 docblock에 `@jest-environment <rootDir>/jest.time-zone-environment.cjs`와 `@time-zone America/New_York`을 적는다. 테스트 안의 `process.env.TZ`는 사본이라 Date·Intl이 따르지 않고, 이 환경이 그 파일 동안만 worker의 시간대를 바꾸고 되돌린다(`time-picker.test.tsx`).
- `jest.setup.ts`는 Hermes에 없는 `toSorted`·`Array.fromAsync`를 Node에서 지워 앱에서만 죽는 호출을 테스트에서도 드러낸다.
- 규모와 실행 시간(1.15.2 [31/32], 2026-11-12): 테스트 파일 588 → 514개, 줄 82,957 → 76,197, `it(`·`it.each(` 호출 3,774 → 3,430(`it.each`가 펼치는 케이스까지 센 전체는 5,733개). 전체 Jest를 worker 1개(`AIDO_TEST_WORKERS=1 --maxWorkers=1`)로 돌리면 514 suite가 약 144초(`time` 기준 2분 25초, 벽시계)이고 `act` 경고와 worker 종료 경고는 0이다. worker를 늘리면 더 짧아지지만 다른 러너와 함께 돌 때는 위 값으로 줄인다.
- jest는 앱과 달리 렌더 중 컴파일러 버그(`getValues()` 등)를 잡지 못한다. 시뮬레이터에서만 보인다.

## `src/testing/`

| 위치                                                                      | 내용                                                                                                                                                                             |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ports/{port}.stub.ts`                                                    | 포트 하나에 도구 하나. `create{Port}Stub()`(`jest.fn`으로 호출을 기록하는 빈 구현)                                                                                               |
| `fakes/{name}.fake.ts`                                                    | 동작을 흉내 내는 구현. `create{Port}Fake`, `createMemory{X}`(메모리에 저장)                                                                                                      |
| `mocks/{module}.ts`                                                       | `moduleNameMapper`·`jest.setup.ts`가 가리키는 SDK 대체(expo-router, MMKV, Skia 등). 테스트 파일이 직접 import하지 않는다                                                         |
| `render.tsx`                                                              | `renderScreen`, `renderScreenHook`(`initialProps`), `createTestProviders`(두 render와 `renderAppRoute`가 함께 쓰는 Provider)                                                     |
| `di.ts`                                                                   | `createTestPorts`, `createTestDi({ ports, seeds })` → `TestDi`(운영 조립 + `queryClient`)                                                                                        |
| `render-route-hook.tsx`                                                   | `renderRouteHook`(진짜 Expo Router 위에서 훅을 돌린다), `renderAppRoute(routes, { url, di })`(route 파일 표를 앱 Provider 위에 올린다), `renderRoutes`(Provider 없이 route 표만) |
| `query-client.ts`, `timers.ts`, `mock-method.ts`, `fixture.ts`, `core.ts` | `createTestQueryClient`·`deliverQueryNotifications`, `setupFakeTimersPerTest`, `mockMethod`, `defineFixture`, 가벼운 공용 export(`render.tsx` 제외)                              |

- 도구는 `function` 선언이고 `jest.Mocked<포트>`를 돌려준다. 메서드는 `mockMethod<Port['method']>(구현)`으로 포트에서 타입을 가져와, 포트가 바뀌면 기본값도 컴파일되지 않게 한다. 같은 일을 하는 도구를 따로 만들지 않는다. feature 전용 도구는 이유가 있을 때만 그 feature의 `__tests__`에 둔다.
- **stub 기본값**은 정상 기기와 빈 데이터다(알림 허용, 클립보드 비어 있음, 요금제·구독 없음, 로그인 창 닫음). 값이 있어야 하는 메서드(`HttpClient`, `JsonFetcher`, 좌표)는 정하지 않고 부르면 `createXStub: get 응답을 정하지 않았습니다`처럼 이름을 대며 실패한다. 어긋난 기본값은 테스트가 반환된 `jest.fn`을 바꿔 준다. 포트를 넓히면 stub도 같은 커밋에서 넓힌다.
- 상태를 보는 stub: `createNetworkStatusGatewayStub`(`emit(isOnline)`, `getListenerCount()`), `createAppLifecycleGatewayStub(initial)`(`emit(state)`), `createPurchasesGatewayStub`(`isConfigured()`, `getListenerCount()`), `createPushNotificationGatewayStub(overrides)`(수신·응답을 `emit*`로 흘림), `createMemoryObservableSyncStorage`(남은 구독 수), `createMemorySyncStorage`(`keys`·`clear` 포함), `createMemoryTokenStore(tokens)`, `createIdGeneratorStub`(호출마다 다른 id).
- SDK를 `jest.mock`하는 `shared/infra` 어댑터 테스트는 `core.ts` 대신 도구 파일을 직접 import한다. 앱 전체가 가로챈 SDK보다 먼저 읽히지 않게 하기 위해서다.
- 기타: 끝나는 시점·실패를 테스트가 정하는 Promise는 내장 `Promise.withResolvers<T>()`를 쓴다(앱 코드는 lint가 막는다). 그 위의 `createPendingResponse(value)`(정한 값으로 끝나는 HTTP 응답, 두 번 누름·늦은 응답), `respondByPath({ path: 응답 })`(HTTP stub 하나가 URL마다 다른 응답), `createWidgetBridgeStub()`, `createRouteParamsFake(initial)`(공용 expo-router mock의 URL을 움직임), `stubWindowDimensions(width)`, `OverlayStateContext.Provider`(시트 활성 여부를 값으로 준다).
- fake timer가 켜진 테스트에서 마이크로태스크를 비울 때는 `await Promise.resolve()` 대신 `await jest.advanceTimersByTimeAsync(0)`를 쓴다.

|                                     | `jest.mock`                 | stub·fake                                |
| ----------------------------------- | --------------------------- | ---------------------------------------- |
| 바꾸는 것                           | 모듈 경로를 통째로 가로챈다 | 포트 구현체 하나를 넣는다                |
| 타입                                | 포트와 어긋나도 모른다      | 어긋나면 컴파일 오류다                   |
| 실행되는 코드                       | 가로챈 만큼 가짜다          | 포트 안쪽 서비스·모델·화면은 실제 코드다 |
| 파일을 옮기거나 라이브러리를 바꾸면 | 테스트가 깨진다             | 그대로다                                 |

결과는 상태(저장소 값, 쿼리 캐시, 화면, stub이 기록한 상태)로 본다. 서버 요청의 method·path·body, 오류 보고·분석·햅틱·네이티브처럼 앱 밖으로 나가는 호출만 호출 확인으로 본다.

### 서비스 테스트

실제 Service에 포트 stub을 끼운다.

```ts
const gateway = createAppStoreReviewGatewayStub();
const service = new StoreReviewService(storeReviewStoredValue, gateway, () => NOW);

it('끝낸 날이 모자라면 기다리지도 요청하지도 않는다', async () => {
  // Given
  service.recordActiveDay(ACCOUNT, '2026-10-27');

  // When
  const outcome = await service.requestReviewAt(ALL_DONE, presentable);

  // Then
  expect(outcome).toBe('not_engaged');
  expect(gateway.requestReview).not.toHaveBeenCalled();
});
```

### 화면 테스트

`renderScreen` + `createTestDi({ ports })` + `createHttpClientStub`이다. 서비스를 mock하지 않고 HTTP 응답만 정한다.

```tsx
const httpClient = createHttpClientStub();
httpClient.post.mockRejectedValue(new NetworkError());
await renderScreen(<InquiryRoute />, {
  withOverlay: true,
  di: createTestDi({ ports: { httpClient } }),
});
await fireEvent.changeText(screen.getByTestId('inquiry-content-input'), CONTENT);

await fireEvent.press(screen.getByTestId('inquiry-submit'));

expect(screen.getByTestId('inquiry-content-input').props.value).toBe(CONTENT);
```

- `createTestDi`에는 이 테스트가 바꾸는 **포트**(`ports: { httpClient, analytics }`)와 포트로 만들지 않는 메모리 상태 store(`seeds: { authSessionStore }`)만 넣는다. Service·Api·저장소는 넣을 수 없고 늘 `createAppContainer`가 포트로 조립해 운영과 같은 그래프다. 새 Service는 `createAppContainer`에 더하면 테스트에도 생긴다.
- Api마다 응답이 다르면 HTTP stub 하나에 `respondByPath`로 URL별 응답을 정한다. Api마다 stub을 따로 만들어 Service를 손으로 조립하지 않는다.
- 값을 미리 넣거나 결과를 볼 때는 만든 DI의 저장소·Service를 쓴다(`const di = createTestDi(…); di.draftService.save(…)`, `renderScreen` 결과의 `di`). 같은 저장소 위에 저장소 객체를 하나 더 만들지 않는다(스냅숏 캐시가 갈라진다).
- 오늘 날짜를 읽거나 시트를 띄우면 `withLocalDate`·`withOverlay` 옵션을 켠다. 시트는 Portal로 `OverlayProvider`의 PortalHost에 그려지고 `useOverlay`는 Provider 밖에서 던진다.
- `renderRouteHook(useHook, { url })`는 진짜 라우터 위에서 훅을 돌려 URL을 본다(`jest.unmock('expo-router')`). 실제 Router가 필요한 화면·레이아웃 테스트는 `renderAppRoute(routes, { url, di })`로 route 파일 표를 `renderScreen`과 같은 Provider(+ 테마) 위에 올린다. Provider를 손으로 감싸지 않는다. `render-route-hook.tsx`는 `expo-router/testing-library`를 읽어 gesture·reanimated 목보다 먼저 실제 모듈을 끌어오므로 `render.tsx`·`core.ts`에 합치지 않고 직접 import한다. `render.tsx`도 `core.ts`에 다시 내보내지 않는다.
- 앱 Provider 트리(`AppProviders`)는 `createCompositionRoot`에 `createTestPorts`를 넘기고, `renderRoutes`(Provider 없이 route 표만 올림)로 루트 레이아웃(`AppProviders` + `AuthGateLayout`)과 앱 화면 묶음 레이아웃을 실제 라우터에 올린다(`app-providers.test.tsx`). 루트 "다시 시도"가 프로세스 수명 객체를 재사용하는지, 조회 캐시 저장 경로에서 계정을 바꿔도 이전 계정 캐시가 남지 않는지, 저장소를 못 연 실행의 로그아웃이 정리를 표시하는지, 내린 뒤 포트 구독(앱 수명·네트워크·저장소·푸시·결제·들어오는 링크·음성 인식)과 타이머가 남지 않고 이벤트(알림·세션 만료·할 일 생성·언어 변경)가 상태를 바꾸지 않는지를 본다.

### expo-router 공용 mock

`jest.setup.ts`가 `expo-router`를 `src/testing/mocks/expo-router.tsx`로 바꾸고 `beforeEach`의 `resetExpoRouterMock()`이 기본값으로 되돌린다. 테스트 파일에서 `jest.mock('expo-router', …)`를 새로 쓰지 않는다.

- 제공: `router`(`push`, `replace`, `back`, `navigate`, `setParams`, `canGoBack`), `useLocalSearchParams`, `useIsFocused`, `useRouter`, `useNavigation`, `Redirect`, `Stack.Screen`, `Stack.Toolbar`.
- `Stack.Toolbar.Button`은 접근성 이름이 있는 버튼으로 그려진다(`getByLabelText`).
- 여기에 없는 export(`useFocusEffect` 등)는 `undefined`다. 쓰는 화면을 테스트하려면 먼저 이 파일에 더한다.
- 이동은 호출을 확인한다. 실제 내비게이션은 기기에서 확인한다.

## Fixture

`defineFixture(schema, defaults)`가 기본값을 스키마로 검증해 모델과 어긋난 fixture로 통과하는 테스트를 막는다. 필드가 늘면 한 곳만 고친다. Mapper의 DTO는 계약 스키마로 검증해 만든다(`memoListResponseSchema.parse({ … })`). 서버 계약이 바뀌면 테스트가 먼저 깨지게 하기 위해서다.

```ts
// features/notes/memo/__tests__/memo.fixtures.ts
export const createMemo = defineFixture(memoSchema, {
  id: 1,
  content: '장보기',
  isPinned: false,
  createdAt: '2026-11-06T00:00:00.000Z',
  updatedAt: '2026-11-06T00:00:00.000Z',
});
// 사용: createMemo({ content: ' 장보기 \n우유\n계란' })
```

## 빌드에서 뺀다

- Metro `blockList`가 `*.test.*`·`*.spec.*`·`__tests__`·`src/testing/`·`*.fixtures.ts`를 번들에서 뺀다.
- `.easignore`가 테스트·`.maestro`·`docs`·`store-metadata`를 EAS 업로드에서 뺀다.

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

`apps/mobile/.maestro/`의 흐름이 개발 서버에 붙은 개발 빌드에서 기능별 핵심 경로를 실제로 누른다. 구조·환경·흐름 목록은 [.maestro/README](../.maestro/README.md)에 있다.

- **언제**: 출시 빌드마다 `e2e:smoke`, 출시 전 회귀에 `e2e` 전체, 기능을 고친 PR은 `e2e:feature <기능>`. 서버 계약이나 화면 동작을 바꿨으면 그 기능 흐름도 고친다.
- **무엇을**: 사용자 목표 하나(로그인, 할 일 추가·완료·삭제, 카테고리 삭제, 메모, 알림함, 친구 초대, 페이월, 오프라인 복구). 업무 규칙 분기·오류 코드는 단위 테스트로 지킨다.
- **이름**: `flows/<기능>/<사용자-목표>.yaml`(kebab-case), 기능 폴더 이름을 태그로 단다. 동작은 `subflows/<기능>/<동작>.yaml`이고 입력은 UPPER_SNAKE env다.
- **태그**: `smoke`, `regression`, 기능 태그, `needs-second-account`, `android-only`(비행기 모드처럼 iOS 시뮬레이터에 없는 기능).
- **선택자**: `testID`(`<feature>-<element>[-<action>]`)를 `id:`로 찾고, 이름은 `.maestro/scripts/selectors.js` 한 곳에만 둔다.
- **데이터**: 계정 비밀번호·토큰은 흐름에 쓰지 않는다. `pnpm e2e:accounts create`가 git이 무시하는 `.maestro/.env.maestro`에 쓰고, 흐름은 `onFlowStart`에서 개발 API로 `E2E ` 접두 데이터를 만들고 `onFlowComplete`에서 지운다.
- **흐름 추가**: testID → `selectors.js` → 필요하면 subflow → 흐름(Given/When/Then 한국어 주석) → `maestro check-syntax <파일>` → `pnpm e2e:feature <태그>`.
- **못 하는 것**: 실제 푸시 도착(APNs·FCM), 앱이 꺼진 상태의 푸시 열기, iOS 오프라인, 외부 공유 시트, 스토어 결제, 위젯은 README의 수동 확인 목록으로 실기기에서 본다.

```bash
pnpm --filter @aido/mobile e2e:accounts create   # 처음 한 번: main·second 개발 테스트 계정
pnpm --filter @aido/mobile e2e:smoke
pnpm --filter @aido/mobile e2e                   # 전체(시작할 때 초대 수락 기록을 되돌린다)
pnpm --filter @aido/mobile e2e:feature category  # 한 기능 태그만
```

## 실행 명령

```bash
pnpm --filter @aido/mobile test                       # 전체. PR 전에 한 번
pnpm --filter @aido/mobile test src/features/notes/memo  # 한 기능
pnpm --filter @aido/mobile test:changed               # 마지막 커밋 이후 바뀐 파일에 닿는 테스트
pnpm --filter @aido/mobile test:related src/features/notes/memo/domains/memo.model.ts
pnpm --filter @aido/mobile test:watch
pnpm --filter @aido/mobile test --seed <seed>         # 실패한 순서 재현
pnpm --filter @aido/mobile test --runInBand --detectOpenHandles
pnpm check                                            # 루트: 형식·이름·lint·경계·안 쓰는 코드·타입
```

작업을 마칠 때는 바꾼 파일의 테스트와 정적 검증을 먼저 실행한다. 전체 테스트는 공유 코드·공통 설정을 바꿨거나 릴리스 전 회귀 확인이 필요할 때 실행한다.
