# Mobile Testing Guide

모바일 테스트는 제품 규칙과 계약 경계를 작게 검증한다. React Native 프레임워크 배선이나 화면 모양을 테스트 코드로 복제하지 않는다.

공통 규칙(범위, `// Given`·`// When`·`// Then`, 한국어 제목, stub 우선, 외부 API 금지, 일괄 교체 금지)은 [루트 공통 코드 규칙](../../../AGENTS.md#공통-코드-규칙)에 있다. 이 문서는 앱에만 해당하는 내용을 담는다. 왜 이 범위인지는 [테스트 전략](../docs/testing-strategy.md)을 본다.

## 테스트 범위

클라이언트 테스트는 유저 엣지 케이스와 중요한 비즈니스 로직만 둔다. 테스트가 줄어도 좋다. 단 규칙을 지키던 테스트를 형식 때문에 지우지 않는다.

- **쓴다:** Policy와 업무 순수 함수의 규칙·경계값, 돈·권한·한도·시간대·자정·서머타임, 초안과 입력값 보존, 오프라인·서버 500·토큰 만료, 두 번 누름, 삭제된 대상, 다른 계정 섞임, 저장 값·공개 링크 호환, 재현된 버그.
- **쓰지 않는다:** 단순 세터, 필드 그대로 옮기는 mapper, 표시만 하는 컴포넌트, 라이브러리 동작, 스타일과 스냅샷, 구현 세부(호출 횟수만 보는 테스트), 커버리지를 채우려는 테스트, hook·Provider·Query Options의 단순 배선.
- 기존 테스트가 "쓰지 않는다"에 들면 사유를 적어 지워도 된다. 판단이 애매하면 남긴다.

| 대상                           | 검증하는 것                                                                            |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| Model·Policy                   | 상태 조합의 허용·거부, 입력 정규화, 날짜·수치 경계                                     |
| Service·Mapper                 | method·path·query·body, 응답 스키마 검증, DTO→모델 변환, `AbortSignal` 전달, 오류 전달 |
| 순수 util·view-model·공용 유틸 | 경계값과 분기별 입출력, 캐시 변환의 identity, 정렬·중복 제거·평탄화                    |
| 화면·훅 동작(유저 엣지 케이스) | 저장 실패·오프라인·두 번 누름처럼 계약이 사용자 결과로 이어지는 흐름                   |

경계(오늘·자정·DST·언어, 라우트·푸시·위젯 URI 해석, 저장 JSON 버전)는 순수 함수 테스트로 고정한다([날짜 경계](../../../docs/conventions/dates.md#4-테스트할-경계)).

## 만들지 않는 테스트

- 컴포넌트 렌더, snapshot, className·prop 전달 확인
- hook, Provider, Query Options의 호출 순서와 라이브러리 배선
- Router, Keyboard, FlashList, 애니메이션 동작을 mock으로 재현하는 테스트
- 번역 문자열 존재, 아이콘 이름, 고정 라벨처럼 정적 검사로 확인할 수 있는 내용
- getter, 상수, 한 줄 위임 함수, 값을 넘기기만 하는 래퍼
- 같은 시나리오를 여러 레이어에서 반복하는 테스트

컴포넌트·hook 회귀가 걱정되면 그 판단을 순수 함수(model·policy·view-model·resolver)로 빼서 그 함수를 테스트한다.

## 파일 위치

| 대상           | 위치와 이름                                                   |
| -------------- | ------------------------------------------------------------- |
| Model·Policy   | `domains/{entity}.model.test.ts`                              |
| 폼 스키마      | `schemas/{name}-form.schema.test.ts`                          |
| Mapper         | `apis/{entity}.mapper.test.ts`                                |
| Service        | `apis/{feature}.service.test.ts`                              |
| 피처 순수 util | `utils/{name}.test.ts`                                        |
| view-model     | view-model 파일 옆 `{name}.view-model.test.ts`                |
| 공용 유틸      | `shared/utils/{name}.test.ts`                                 |
| 테스트 fixture | `features/{area}/{feature}/__tests__/{entity}.fixtures.ts`    |
| 테스트 DI 조립 | `features/{area}/{feature}/__tests__/{feature}.test-utils.ts` |

테스트 파일은 구현 파일 옆에 둔다. `.test.ts`가 기본이고 JSX가 꼭 필요할 때만 `.test.tsx`다.

## 작성 규칙

- 새 테스트는 `it`을 쓰고 `// Given`·`// When`·`// Then` 블록과 한국어 제목을 둔다. `// When / Then` 합본이나 `// Given - 설명` 꼬리 설명을 쓰지 않는다. 같은 입력 표는 `it.each`다.
- 의미 있는 성공·실패·경계 분기만 남긴다. 줄을 실행하기 위한 케이스를 만들지 않는다.
- `jest.fn()`·spy는 호출 자체가 계약일 때(요청 path, 토큰 해제 순서)와 시간·UUID 같은 실제 경계에만 둔다.
- 모듈 `jest.mock`은 `shared/infra` 어댑터 테스트의 SDK에만 쓴다(현재 20개 파일, `@src` 대상 0). `@src/…` 모듈은 mock하지 않고 포트 stub을 넣는다. 네이티브 모듈은 `jest.setup.ts`나 `jest.config.js`의 `moduleNameMapper`에 둔다. `check:conventions`가 허용 목록 없이 막는다. 실제 라우터를 쓰는 테스트의 `jest.unmock('expo-router')`는 mock이 아니라 허용한다.
- 여러 프레임워크 mock을 조립하기 시작하면 순수 로직 추출을 먼저 검토한다.
- `env.ts`를 파일별로 mock하지 않는다. `jest.setup.ts`가 앱 시작과 같은 경로(`expo-constants`)로 값을 준다.
- 실제 타이머를 기다리지 않는다. 시간 값을 인자로 주거나 fake timer를 쓴다. 비동기가 섞이면 `await jest.advanceTimersByTimeAsync(ms)`를 쓴다(Jest 30).
- 타임존 테스트는 윤년과 다른 국가(서울·LA) 경계 정도만 본다.

## 테스트 격리

설정이 이미 `clearMocks`와 `restoreMocks`를 켠다. `clearMocks`는 호출 기록만, `restoreMocks`는 `jest.spyOn`으로 만든 spy만 되돌린다. `jest.fn()`에 정한 `mockReturnValue`·`mockImplementation`은 지우지 않는다(`resetMocks`는 공용 stub의 구현까지 지워 켜지 않는다). 그래서 다음을 지킨다.

- 상태를 가진 stub·fake, `QueryClient`, 저장소는 테스트마다 새로 만든다. 모듈 수준 `const logger = createLoggerStub()`처럼 공유 인스턴스를 두지 않는다.
- 모듈 수준 `let`은 `beforeEach`에서 다시 만든다. `jest.mock` factory가 참조해야 하는 `mock*` 변수만 예외로 두고 `beforeEach`에서 초기화한다.
- fake timer는 `setupFakeTimersPerTest(config)`(`src/shared/__tests__`)로만 켠다. `describe` 안에서 부르면 `beforeEach`에서 켜고, `afterEach`에서 ① fake timer가 켜진 채 화면을 내리고(`cleanup`) ② 남은 타이머를 한 번 흘린 뒤(`jest.runOnlyPendingTimers`) ③ 진짜 타이머로 되돌린다. Jest는 안쪽 `afterEach`를 공용 `jest.setup.ts`보다 먼저 부르므로, 파일에서 바로 `jest.useRealTimers()`를 부르면 화면을 내릴 때 생긴 타이머(토스트 자동 닫힘, 늦은 녹음 대기)가 진짜 타이머로 남아 worker가 끝나지 못한다([Jest Timer Mocks](https://jestjs.io/docs/timer-mocks), [Testing Library: Using Fake Timers](https://testing-library.com/docs/using-fake-timers/)). 모듈 수준에서 켜지 않는다.
- 화면을 떠난 뒤 오는 응답·토스트처럼 테스트가 끝난 다음에 이어지는 비동기 흐름이 있으면, 그 결과(토스트 문구 등)를 `findBy*`로 기다려 확인하거나 위 도우미로 fake timer 안에 가둔다. 결과를 확인하지 않고 끝내지 않는다.
- 이미 `jest.fn()`인 대상(RN의 `View.prototype.measure` 등)에 `jest.spyOn(...).mockImplementation`을 걸면 `restoreMocks`가 되돌리지 못한다. `afterEach`에서 `mockReset()`한다.
- 순서를 바꿔도 통과해야 한다. `jest.config.js`가 `randomize: true`·`showSeed: true`라 매 실행이 무작위 순서다. 실패하면 출력된 seed로 `pnpm --filter @aido/mobile test --seed <seed>`를 실행해 재현하고 순서 의존을 고친다.
- 끝난 뒤 "worker process has failed to exit gracefully"나 "Jest did not exit"가 나오면 누수다. 영역별로 나눠 실행해 파일을 좁히고, 그 파일에서 남은 타이머를 만든 테스트를 찾아 위 두 규칙으로 고친다. `workerIdleMemoryLimit`·`forceExit`로 덮지 않는다.

## Fixture

fixture는 `createX(overrides)` 한 패턴이다. 필드가 늘면 한 곳만 고치면 되고, 기본값을 스키마로 검증해 모델과 어긋난 fixture로 통과하는 테스트를 막는다.

```ts
// features/notes/memo/__tests__/memo.fixtures.ts
const DEFAULT_MEMO = memoSchema.parse({
  id: 1,
  content: '장보기',
  isPinned: false,
  createdAt: '2026-11-06T00:00:00.000Z',
  updatedAt: '2026-11-06T00:00:00.000Z',
});

export function createMemo(overrides: Partial<Memo> = {}): Memo {
  return { ...DEFAULT_MEMO, ...overrides };
}
```

```ts
// features/notes/memo/domains/memo.model.test.ts
describe('getMemoPreview', () => {
  it('첫 줄을 제목으로, 나머지를 본문으로 나눈다', () => {
    // Given
    const memo = createMemo({ content: ' 장보기 \n우유\n계란' });

    // When
    const preview = MemoPolicy.getMemoPreview(memo);

    // Then
    expect(preview).toEqual({ title: '장보기', body: '우유\n계란' });
  });
});
```

Mapper의 DTO는 계약 스키마로 검증해 만든다(`memo.mapper.test.ts`의 `memoListResponseSchema.parse({ … })`). 서버 계약이 바뀌면 테스트가 먼저 깨지게 하기 위해서다.

## Stub 우선 DI 테스트

서비스가 포트에 기대면 실제 서비스에 stub 포트를 끼운다. mock이 아니라 stub이다.

- **결과는 상태로 본다.** 저장소 값, 쿼리 캐시, 화면, stub이 기록한 상태(`getListenerCount()`, `isConfigured()`)를 확인한다. 내부 포트를 몇 번 불렀는지는 구현 세부라 보지 않는다.
- **호출 확인은 가장 바깥 경계에서만 한다.** 서버 요청은 서버 계약이라 method·path·body가 곧 결과다(`httpClient.post`). 오류 보고·분석 이벤트처럼 앱 밖으로 나가는 기록도 같다.

|                                     | `jest.mock`                 | stub·fake                                  |
| ----------------------------------- | --------------------------- | ------------------------------------------ |
| 바꾸는 것                           | 모듈 경로를 통째로 가로챈다 | 포트 구현체 하나를 넣는다                  |
| 타입                                | 포트와 어긋나도 모른다      | 어긋나면 컴파일 오류다                     |
| 실행되는 코드                       | 가로챈 만큼 가짜다          | 포트 안쪽의 서비스·모델·화면은 실제 코드다 |
| 파일을 옮기거나 라이브러리를 바꾸면 | 테스트가 깨진다             | 그대로다                                   |

### 공용 도구 (`src/shared/__tests__`, `index.ts`로 공개)

포트 하나에 도구 하나다. 모든 도구는 `function` 선언이고 `jest.Mocked<포트>`를 돌려준다. 메서드의 인자와 반환 타입은 `mockMethod<Port['method']>(구현)`으로 포트에서 가져와 포트가 바뀌면 기본값도 컴파일되지 않는다(`jest.fn()`은 무엇이든 받는다). 이름은 `create{Port}Stub`(`jest.fn`으로 호출을 기록하는 빈 구현), `create{Port}Fake`(동작을 흉내 냄), `createMemory{X}`(메모리에 저장하는 구현)다. 같은 일을 하는 도구를 따로 만들지 않는다. feature 전용 도구는 이유가 있을 때만 그 feature의 `__tests__`에 둔다.

| 포트                                   | 도구                                                                                                           |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `Logger`                               | `createLoggerStub()`                                                                                           |
| `Analytics`                            | `createAnalyticsStub()`                                                                                        |
| `ErrorReporter`                        | `createErrorReporterStub()`                                                                                    |
| `HapticsGateway`                       | `createHapticsGatewayStub()`                                                                                   |
| `ScreenOrientationGateway`             | `createScreenOrientationGatewayStub()`                                                                         |
| `IdGenerator`                          | `createIdGeneratorStub()` (호출마다 다른 id)                                                                   |
| `HttpClient`                           | `createHttpClientStub()`                                                                                       |
| `Storage`                              | `createMemoryStorage()` (`jest.Mocked`, 메모리에 JSON으로 왕복)                                                |
| `SyncStorage`, `EnumerableSyncStorage` | `createMemorySyncStorage()` (`keys`·`clear`까지 있는 `jest.Mocked`)                                            |
| `ObservableSyncStorage`                | `createMemoryObservableSyncStorage()` (`getListenerCount()`로 남은 구독 수를 본다)                             |
| `TokenStore`                           | `createMemoryTokenStore(tokens)`                                                                               |
| `DeviceIdStore`                        | `createMemoryDeviceIdStore(initial)`                                                                           |
| `LocalFileSystem`                      | `createLocalFileSystemFake()`                                                                                  |
| 말로 메모 초안·녹음 저장소             | `createVoiceNoteStorageFake(files, { storage, logger })` (`service`, `drafts`, `recordings`, `di`)             |
| `ExternalLinkGateway`                  | `createExternalLinkGatewayStub()`                                                                              |
| `IncomingLinkGateway`                  | `createIncomingLinkGatewayStub()`                                                                              |
| `ClipboardGateway`                     | `createClipboardGatewayStub()`                                                                                 |
| `SystemShareGateway`                   | `createSystemShareGatewayStub()`                                                                               |
| `SocialShareGateway`                   | `createSocialShareGatewayStub()`                                                                               |
| `LocationGateway`                      | `createLocationGatewayStub()`                                                                                  |
| `NetworkStatusGateway`                 | `createNetworkStatusGatewayStub()` (`emit(isOnline)`, `getListenerCount()`)                                    |
| `ViewCaptureGateway`                   | `createViewCaptureGatewayStub()` (항상 파일 uri 하나를 찍은 것으로 답함)                                       |
| `AppLifecycleGateway`                  | `createAppLifecycleGatewayStub(initial)` (`emit(state)`로 전환을 흘림, 앱 상태를 `AppState` spy로 잡지 않는다) |
| `AppStoreReviewGateway`                | `createAppStoreReviewGatewayStub()`                                                                            |
| `AppStoreListingGateway`               | `createAppStoreListingGatewayStub()`                                                                           |
| `AppIconGateway`                       | `createAppIconGatewayStub()`                                                                                   |
| `InstallReferrerGateway`               | `createInstallReferrerGatewayStub()`                                                                           |
| `InstallationIdGateway`                | `createInstallationIdGatewayStub()`                                                                            |
| `VendorIdGateway`                      | `createVendorIdGatewayStub()`                                                                                  |
| `JsonFetcher`                          | `createJsonFetcherStub()`                                                                                      |
| `NativeApplicationMetadataGateway`     | `createNativeApplicationMetadataGatewayStub(installation)`                                                     |
| `PurchasesGateway`                     | `createPurchasesGatewayStub()` (`isConfigured()`, `getListenerCount()`)                                        |
| `PushNotificationGateway`              | `createPushNotificationGatewayStub(overrides)` (수신·응답을 `emit*`로 흘림)                                    |
| `SocialAuthGateway`                    | `createSocialAuthGatewayStub()`                                                                                |
| `SpeechRecognizer`                     | `createSpeechRecognizerStub()`                                                                                 |

**stub 기본값 규칙.** 기본은 정상 기기와 빈 데이터다(알림을 허용했고, 클립보드는 비었고, 요금제와 구독은 없고, 사용자는 로그인 창을 닫는다). 값이 있어야 하는 메서드(`HttpClient`, `JsonFetcher`, 좌표·장소)는 정하지 않고 부르면 `createXStub: get 응답을 정하지 않았습니다`처럼 이름을 대며 실패한다. 같은 포트의 모든 도구가 이 규칙을 따른다. 어긋난 기본값이 필요하면 테스트가 반환된 `jest.fn`을 바꾼다. 포트를 넓히면 stub도 같은 커밋에서 넓힌다.

SDK를 `jest.mock`하는 `shared/infra` 어댑터 테스트는 `index.ts` 대신 도구 파일을 직접 import한다. index가 `createTestDi`를 통해 앱 전체와 어댑터를 불러와 테스트가 가로챈 SDK보다 먼저 읽히기 때문이다.

| 도구                                                            | 용도                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createTestDi({ httpClient, …overrides })`                      | stub 포트(`createTestPorts`)로 운영과 같은 `createAppContainer`를 부른 DI. 응답은 `httpClient`에 정한다(공개·인증 클라이언트가 함께 쓴다. 나눠 보려면 `publicHttpClient`·`authHttpClient`). 기기 저장소 `syncStorage` 하나를 모든 저장소가 함께 쓴다. 포트를 넣으면 그 포트를 쓰는 Service가 모두 다시 조립되고, Service를 넣으면 그 키만 바뀐다 |
| `createTestPorts(overrides)`                                    | `AppContainerPorts`의 stub 기본값. 앱 Provider 트리를 올리는 테스트가 `createCompositionRoot`에 넘긴다                                                                                                                                                                                                                                           |
| `renderUi(ui, { di, queryClient, withLocalDate, withOverlay })` | 실제 provider 위에 `di`(`TestDiOverrides`)를 얹어 렌더. `di: createTestDi(...)`를 다시 넘기지 않는다. 오늘 날짜를 읽거나 시트를 띄우면 옵션을 켠다                                                                                                                                                                                               |
| `renderUiHook(useHook, { di, … })`                              | `renderUi`와 같은 provider 위에서 훅을 돌린다                                                                                                                                                                                                                                                                                                    |
| `renderRouteHook(useHook, { url })`                             | 진짜 Expo Router 위에서 훅을 돌려 URL을 본다(`index`가 아니라 `render-route-hook`을 직접 import하고 `jest.unmock('expo-router')`)                                                                                                                                                                                                                |
| `createTestQueryClient()`                                       | 테스트용 QueryClient                                                                                                                                                                                                                                                                                                                             |
| `createPendingResponse()`                                       | 끝나는 시점을 테스트가 정하는 응답(두 번 누름, 늦은 응답)                                                                                                                                                                                                                                                                                        |
| `createRouteParamsFake(initial)`                                | 공용 expo-router mock의 URL을 움직인다. `router.setParams`가 값을 바꾸면 param을 읽는 컴포넌트가 다시 그려진다(요금제 고르기, 달력 날짜)                                                                                                                                                                                                         |
| `stubWindowDimensions(width)`                                   | 창 폭·글꼴 배율. spy라 테스트가 끝나면 되돌아간다                                                                                                                                                                                                                                                                                                |
| `OverlayStateContext.Provider`                                  | 시트·다이얼로그 활성 여부를 읽는 훅 테스트. `@src/shared/ui`를 mock하지 않고 값을 준다                                                                                                                                                                                                                                                           |
| `features/{area}/{f}/__tests__/{entity}.fixtures.ts`            | 모델 fixture(`createX(overrides)`)                                                                                                                                                                                                                                                                                                               |

`mocks/`는 `jest.config.js`의 `moduleNameMapper`와 `jest.setup.ts`가 가리키는 SDK 모듈 대체(expo-router, MMKV, Skia 등)다. 포트 stub이 아니라 jest가 모듈을 바꿔 끼우는 층이고, 테스트 파일이 직접 import하지 않는다.

### 서비스 단위 테스트

실제 Service에 포트 stub을 끼운다. `jest.mock`으로 모듈을 가로채지 않는다.

```ts
// features/device/store-review/apis/store-review.service.test.ts
const createFixture = () => {
  const gateway = createAppStoreReviewGatewayStub();
  const repository = createStoreReviewRepository(createMemorySyncStorage());
  const service = new StoreReviewService(repository, gateway, () => NOW);
  return { gateway, service };
};

it('끝낸 날이 모자라면 기다리지도 요청하지도 않는다', async () => {
  // Given
  const { gateway, service } = createFixture();
  service.recordActiveDay(ACCOUNT, '2026-10-27');

  // When
  const outcome = await service.requestReviewAt(ALL_DONE, presentable);

  // Then
  expect(outcome).toBe('not_engaged');
  expect(gateway.requestReview).not.toHaveBeenCalled();
});
```

### 화면 테스트

`renderUi` + `createTestDi` + `createHttpClientStub`이다. 서비스를 mock하지 않고 HTTP 응답만 정한다.

```tsx
// features/support/inquiry/__tests__/inquiry-screen.test.tsx
it('연결이 끊겨 실패해도 입력값을 지키고 화면에 머문다', async () => {
  // Given
  const httpClient = createHttpClientStub();
  httpClient.post.mockRejectedValue(new NetworkError());
  await renderUi(<InquiryRoute />, {
    withOverlay: true,
    di: { httpClient, haptics: createHapticsGatewayStub() },
  });
  await fireEvent.changeText(screen.getByTestId('inquiry-content-input'), CONTENT);

  // When
  await fireEvent.press(screen.getByTestId('inquiry-submit'));

  // Then
  expect(screen.getByTestId('inquiry-content-input').props.value).toBe(CONTENT);
  expect(router.back).not.toHaveBeenCalled();
});
```

`di`에는 이 테스트가 바꾸는 포트만 더한다(`di: { httpClient, analytics }`). 포트는 `createAppContainer`를 거쳐 그 포트를 쓰는 Service 모두에 들어간다. `di: { xService: new XService(httpClient) }`처럼 Service를 직접 조립하지 않는다. Service를 넣으면 그 키만 바뀌고, 그 Service를 쓰는 다른 Service(`LogOutDeviceService`의 `authService` 등)는 원래 것을 써서 운영과 다른 그래프가 된다. 값을 미리 넣을 때는 저장소가 아니라 `syncStorage`에 넣는다(`createTestDi().syncStorage.set(key, value)` 또는 `di: { syncStorage }`). 새 Service는 `createAppContainer`에 더하면 테스트에도 생긴다.

앱 Provider 트리 전체(`AppProviders`)는 `createCompositionRoot`에 `createTestPorts`를 넘겨 올린다(`app-providers.test.tsx`). 루트 "다시 시도"처럼 다시 올려도 같은 프로세스 수명 객체를 쓰는지, 내린 뒤 구독·타이머가 남지 않는지를 여기서 본다.

## expo-router 공용 mock

`jest.setup.ts`가 `expo-router`를 `src/shared/__tests__/mocks/expo-router.tsx`로 바꾸고, `beforeEach`의 `resetExpoRouterMock()`이 테스트마다 기본값으로 되돌린다. `clearMocks`는 호출 기록만 지워 `mockReturnValue`가 다음 테스트로 새기 때문이다. 테스트 파일에서 `jest.mock('expo-router', …)`를 새로 쓰지 않는다.

```tsx
// features/notes/memo/components/memo-editor.test.tsx
jest.mocked(useLocalSearchParams).mockReturnValue({ memoId: String(MEMO_ID) });
```

- 제공하는 것: `router`(`push`, `replace`, `back`, `navigate`, `setParams`, `canGoBack`), `useLocalSearchParams`, `useIsFocused`, `useRouter`, `useNavigation`, `Redirect`, `Stack.Screen`, `Stack.Toolbar`.
- `Stack.Toolbar.Button`은 Jest에서 그려지지 않는 네이티브 헤더 대신 접근성 이름이 있는 버튼으로 그려진다. `getByLabelText`로 누른다.
- 여기에 없는 export(`useFocusEffect` 등)는 `undefined`다. 쓰는 화면을 테스트하려면 먼저 이 파일에 더한다.
- 이동은 호출을 확인한다(`router.push`). 실제 내비게이션은 앱에서 확인한다.

## Portal 시트 테스트

시트는 Portal로 `OverlayProvider`의 PortalHost에 그려지고, `useOverlay`는 Provider 밖에서 오류를 던진다. 시트와 시트를 여는 컴포넌트는 앱과 같게 `OverlayProvider`로 감싼다. `useToday`를 쓰면 `LocalDateProvider`도 함께 둔다.

```tsx
// features/notes/memo/components/memo-editor.test.tsx
await renderUi(
  <LocalDateProvider>
    <OverlayProvider>
      <Suspense fallback={null}>
        <MemoEditor
          toolbar={toolbar === 'stack' ? MemoEditor.StackToolbar : MemoEditor.PaneToolbar}
          onLeave={onLeave}
        />
      </Suspense>
    </OverlayProvider>
  </LocalDateProvider>,
```

## QueryClient와 종료

- QueryClient는 `createTestQueryClient()`로만 만든다(`retry: false`, `gcTime: Infinity`). `check:conventions`가 테스트의 `new QueryClient`를 막는다. 각 테스트가 만들면 정리 타이머가 남아 Jest 종료를 붙잡는다.
- `jest.setup.ts`의 `afterEach`가 `cleanup()`으로 화면을 먼저 unmount한 뒤 클라이언트를 비운다. 순서가 반대면 unmount 때 `gcTime` 타이머가 다시 걸린다. 테스트 안에서 `queryClient.clear()`를 부르지 않는다.
- 구독·대기 중인 idle callback을 해제한다. `--forceExit`로 감추지 않는다.

## 함정

- `jest.setup.ts`는 Hermes에 없는 `toSorted`·`Array.fromAsync`를 Node에서 지운다. 앱에서만 죽는 호출을 테스트에서도 드러내기 위해서다.
- jest는 React Compiler 없이 돈다. 렌더 중 `getValues()` 같은 컴파일러 버그는 시뮬레이터에서만 보인다.
- `jest.resolver.cjs`는 RN 0.88 preset의 경로 해석을 유지하고 실제 Reanimated·Worklets 패키지 경로만 공식 resolver로 보낸다. pnpm peer suffix에 `react-native-worklets`가 있다는 이유로 ExpoModulesCore까지 웹 구현으로 바꾸면 안 된다. 공식 문서: [Reanimated 4 Jest testing](https://docs.swmansion.com/react-native-reanimated/docs/guides/testing/).
- `renderUi`는 실제 HeroUI provider를 유지하고 config로 애니메이션만 끈다. 경로 이동은 `expo-router` 경계에서 대체한다. 실제 내비게이션은 앱에서 확인한다.
- 시뮬레이터 영상은 동작과 레이아웃 증거일 뿐 60/120 FPS를 증명하지 않는다. 성능 수치는 Release 실기기에서 잰다.

## 아직 옮기지 않은 것

기존 테스트는 일괄 교체하지 않고 손대는 파일부터 옮긴다.

| 규칙                       | 지금 코드 (2026-11-11 grep)                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| 폼 스키마와 계약 교차 검증 | 폼 스키마와 계약 스키마가 같은 값을 통과시키는지 mapper 테스트로 확인하는 곳이 아직 없다 |
| `di`에는 포트만            | Service·저장소를 직접 만들어 `di`에 넣는 곳 48개(키 기준). 손댈 때 포트로 옮긴다         |

## UI와 native 검증

단위 테스트가 대신할 수 없는 항목은 실제 앱에서 확인한다.

| 영역    | 확인 항목                                                             |
| ------- | --------------------------------------------------------------------- |
| 키보드  | 첫 focus, 닫기/재열기, 마지막 항목 가림, interactive dismiss          |
| 목록    | 첫 frame 위치, prepend 유지, 빈 frame·skeleton flash·layout shift     |
| 접근성  | VoiceOver/TalkBack, focus 순서, 동작 이름, Reduce Motion              |
| 큰 글꼴 | 긴 한글·무공백 영문, multiline 입력, 44pt touch target                |
| 테마    | light/dark semantic color와 대비                                      |
| 성능    | Release 실기기의 JS/UI frame time, keyboard animation, 긴 목록 메모리 |

## Maestro E2E

`apps/mobile/.maestro/`의 Maestro 흐름이 개발 서버에 붙은 개발 빌드에서 기능별 핵심 경로를 실제로 누른다. 구조·환경·흐름 목록은 [.maestro/README](../.maestro/README.md)에 있다.

- **언제**: 출시 빌드마다 `e2e:smoke`, 출시 전 회귀 확인에 `e2e` 전체, 기능을 고친 PR은 `e2e:feature <기능>`. 서버 계약이나 화면 동작을 바꿨으면 그 기능 흐름을 함께 고친다.
- **무엇을**: 사용자 목표 하나(로그인, 할 일 추가·완료·삭제, 카테고리 삭제, 메모, 알림함, 친구 초대, 페이월, 오프라인 복구). 업무 규칙의 분기·오류 코드는 단위 테스트로 지키고 Maestro로 옮기지 않는다.
- **이름**: `flows/<기능>/<사용자-목표>.yaml`(kebab-case), 기능 폴더 이름을 태그로 단다. 동작은 `subflows/<기능>/<동작>.yaml`이고 입력은 UPPER_SNAKE env다.
- **태그**: `smoke`(몇 분 안의 핵심), `regression`(지난 버그·정책 경계), 기능 태그, `needs-second-account`(두 번째 계정), `android-only`(비행기 모드처럼 iOS 시뮬레이터에 없는 기능).
- **선택자**: React Native `testID`(`<feature>-<element>[-<action>]`)를 `id:`로 찾고 이름은 `.maestro/scripts/selectors.js` 한 곳에만 둔다. 화면이 바뀌면 그 파일이나 해당 subflow만 고친다.
- **데이터**: 계정 비밀번호·토큰은 흐름에 쓰지 않는다. `pnpm e2e:accounts create`가 git이 무시하는 `.maestro/.env.maestro`에 쓰고, 흐름은 `onFlowStart`에서 개발 API로 `E2E ` 접두 데이터를 만들고 `onFlowComplete`에서 지운다.
- **흐름 추가**: testID를 달고 → `selectors.js`에 더하고 → 필요하면 subflow → 흐름(Given/When/Then 한국어 주석) → `maestro check-syntax <파일>` → `pnpm e2e:feature <태그>`. 상세 순서는 README의 "흐름 추가하기"다.
- **못 하는 것**: 실제 푸시 도착(APNs·FCM), 앱이 꺼진 상태의 푸시 열기, iOS 오프라인, 외부 공유 시트, 스토어 결제, 위젯은 README의 수동 확인 목록으로 실기기에서 본다.

```bash
pnpm --filter @aido/mobile e2e:accounts create      # 처음 한 번: main·second 개발 테스트 계정
pnpm --filter @aido/mobile e2e:smoke                # smoke 태그
pnpm --filter @aido/mobile e2e                      # 전체 (시작할 때 초대 수락 기록을 되돌린다)
pnpm --filter @aido/mobile e2e:feature category     # 한 기능 태그만
maestro check-syntax apps/mobile/.maestro/flows/category/delete-move-todos.yaml
```

## 실행 명령

```bash
# 모바일 전체 단위 테스트(워커는 설정의 maxWorkers 50%). PR 전에 한 번 돌린다
pnpm --filter @aido/mobile test

# 특정 파일
pnpm --filter @aido/mobile test todo-comment.service.test.ts

# 작업 중: 마지막 커밋 이후 바뀐 파일에 닿는 테스트만(수 초)
pnpm --filter @aido/mobile test:changed
# 커밋 전: 지정한 소스 파일을 import하는 테스트만
pnpm --filter @aido/mobile test:related src/features/notes/memo/domains/memo.model.ts
# 감시 모드
pnpm --filter @aido/mobile test:watch

# 무작위 순서는 기본값이다. 실패한 순서를 같은 seed로 재현한다
pnpm --filter @aido/mobile test --seed <seed>

# 종료 핸들
pnpm --filter @aido/mobile test --runInBand --detectOpenHandles

# 정적 검증
pnpm --filter @aido/mobile lint
pnpm --filter @aido/mobile format:check
pnpm --filter @aido/mobile typecheck
pnpm --filter @aido/mobile check:conventions
pnpm --filter @aido/mobile test:conventions
```

작업을 마칠 때는 바꾼 파일의 테스트와 정적 검증을 먼저 실행한다. 전체 테스트는 공유 코드나 공통 설정을 바꿨거나 릴리스 전 회귀 확인이 필요할 때 실행한다.
