# 모바일 테스트 도구

테스트를 새로 쓰거나 공용 도구(`src/testing/`)·Jest 설정을 고칠 때 읽는다. 무엇을 테스트하고 어떻게 격리하는지는 [testing](./testing.md)이 원본이다.

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
const user = userEvent.setup();
await user.type(screen.getByRole('textbox', { name: '문의 내용' }), CONTENT);

await user.press(screen.getByRole('button', { name: '문의 보내기' }));

expect(screen.getByRole('textbox', { name: '문의 내용' })).toHaveDisplayValue(CONTENT);
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

## Jest 설정

- 전역 옵션(`testTimeout`·`randomize`·`maxWorkers` 등)은 `module.exports`에, 프로젝트 옵션(`cacheDirectory`·`setupFilesAfterEnv` 등)은 `base`에 둔다. 반대로 두면 Jest가 조용히 무시한다(`jest --showConfig`로 확인).
- 유지: `randomize`+`showSeed`, `workerIdleMemoryLimit`, `maxWorkers` 50%(`AIDO_TEST_WORKERS`로 조절, `@aido/test-config`의 `resolveTestWorkers`), `clearMocks`·`restoreMocks`, 테스트에서도 React Compiler.
- 추가한 것: 프로젝트마다 `cacheDirectory`(`node_modules/.cache/jest`), 전역 `testTimeout` 15초·`errorOnDeprecated`(지원 중단 Jest API를 바로 실패시킨다), CI(`CI=true`)에서 `logHeapUsage`(`--ci`는 Jest가 CI 환경에서 스스로 켠다), `test:handles`(`--runInBand --detectOpenHandles`), RNTL `asyncUtilTimeout` 3초, 테스트마다 `clearTestQueryClients`.
- Node 내장 러너 테스트(`scripts/**/__tests__`, `plugins/**/__tests__`, 스토어 그림 `store-metadata/art`)는 `pnpm test:node`가 돌리고 turbo `test:node` 태스크로 CI에 걸린다. `store-listing.test.mjs`는 릴리스 `release.json`이 있어야 해 `test:store-listing`으로 따로 돈다.
- `moduleNameMapper`의 `@aido/api*`는 한 줄이다. `jest.resolver.cjs`는 RN 0.88 preset의 경로 해석을 유지하고 실제 Reanimated·Worklets 패키지 경로만 공식 resolver로 보낸다. pnpm peer suffix에 `react-native-worklets`가 있다는 이유로 ExpoModulesCore까지 웹 구현으로 바꾸면 안 된다([Reanimated 4 Jest testing](https://docs.swmansion.com/react-native-reanimated/docs/guides/testing/)).
- 기기 시간대에 기대는 테스트(피커·자정·서머타임)는 파일 docblock에 `@jest-environment <rootDir>/jest.time-zone-environment.cjs`와 `@time-zone America/New_York`을 적는다. 테스트 안의 `process.env.TZ`는 사본이라 Date·Intl이 따르지 않고, 이 환경이 그 파일 동안만 worker의 시간대를 바꾸고 되돌린다(`time-picker.test.tsx`).
- `jest.setup.ts`는 Hermes에 없는 `toSorted`·`Array.fromAsync`를 Node에서 지워 앱에서만 죽는 호출을 테스트에서도 드러낸다.
- jest는 앱과 달리 렌더 중 컴파일러 버그(`getValues()` 등)를 잡지 못한다. 시뮬레이터에서만 보인다.
