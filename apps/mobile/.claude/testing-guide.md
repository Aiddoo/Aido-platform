# Mobile Testing Guide

모바일 테스트는 제품 규칙과 계약 경계를 작게 검증한다. React Native 프레임워크 배선이나 화면 모양을 테스트 코드로 복제하지 않는다.

공통 규칙(범위, `// Given`·`// When`·`// Then`, 한국어 제목, stub 우선, 외부 API 금지, 일괄 교체 금지)은 [루트 공통 코드 규칙](../../../AGENTS.md#공통-코드-규칙)에 있다. 이 문서는 앱에만 해당하는 내용을 담는다. 왜 이 범위인지는 [테스트 전략](../docs/testing-strategy.md)을 본다.

## 무엇을 테스트하나

| 대상                           | 검증하는 것                                                                            |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| Model·Policy                   | 상태 조합의 허용·거부, 입력 정규화, 날짜·수치 경계                                     |
| Service·Mapper                 | method·path·query·body, 응답 스키마 검증, DTO→모델 변환, `AbortSignal` 전달, 오류 전달 |
| 순수 util·view-model·공용 유틸 | 경계값과 분기별 입출력, 캐시 변환의 identity, 정렬·중복 제거·평탄화                    |

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

| 대상                 | 위치와 이름                                          |
| -------------------- | ---------------------------------------------------- |
| Model·Policy         | `domains/{entity}.model.test.ts`                     |
| Mapper               | `apis/{entity}.mapper.test.ts`                       |
| Service              | `apis/{feature}.service.test.ts`                     |
| 피처 순수 util       | `utils/{name}.test.ts`                               |
| view-model           | `utils/view-models/{name}.view-model.test.ts`        |
| 공용 유틸            | `shared/utils/{name}.test.ts`                        |
| 테스트 데이터 팩토리 | `features/{feature}/__tests__/{entity}.factories.ts` |

테스트 파일은 구현 파일 옆에 둔다. `.test.ts`가 기본이고 JSX가 꼭 필요할 때만 `.test.tsx`다.

## 작성 규칙

- `// When / Then` 합본이나 `// Given - 설명` 꼬리 설명을 쓰지 않는다.
- 의미 있는 성공·실패·경계 분기만 남긴다. 줄을 실행하기 위한 케이스를 만들지 않는다.
- `jest.fn()`·spy는 호출 자체가 계약일 때(요청 path, 토큰 해제 순서)와 시간·UUID 같은 실제 경계에만 둔다.
- 새 테스트의 모듈 `jest.mock`은 어댑터 경계 테스트(`expo-push-notification.gateway.test.ts`)에서만 쓴다. 공용 jest 설정이 처리하는 RN·Expo 런타임은 예외다.
- 여러 프레임워크 mock을 조립하기 시작하면 순수 로직 추출을 먼저 검토한다.
- 실제 타이머를 기다리지 않는다. 시간 값을 인자로 주거나 fake timer를 쓴다.
- 테스트끼리 QueryClient, mock, 전역 상태를 공유하지 않는다.
- 픽스처는 `createX(overrides)` 한 패턴이다. 필드가 늘면 한 곳만 고친다. Mapper 픽스처는 계약 스키마로 검증해 만든다.
- 타임존 테스트는 윤년과 다른 국가(서울·LA) 경계 정도만 본다.

## Stub 우선 DI 테스트

서비스가 포트에 기대면 실제 서비스에 stub 포트를 끼운다. 호출 여부보다 결과 상태를 확인한다.

|                                     | `jest.mock`                 | stub·fake                                  |
| ----------------------------------- | --------------------------- | ------------------------------------------ |
| 바꾸는 것                           | 모듈 경로를 통째로 가로챈다 | 포트 구현체 하나를 넣는다                  |
| 타입                                | 포트와 어긋나도 모른다      | 어긋나면 컴파일 오류다                     |
| 실행되는 코드                       | 가로챈 만큼 가짜다          | 포트 안쪽의 서비스·모델·화면은 실제 코드다 |
| 파일을 옮기거나 라이브러리를 바꾸면 | 테스트가 깨진다             | 그대로다                                   |

| 도구                                                    | 용도                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------ |
| `features/{f}/__tests__/{f}.factories.ts`               | DTO·모델·포트 stub 팩토리(`createX(overrides)`)              |
| `renderUi(ui, { di, queryClient })`                     | 실제 provider 위에 `di` 필드만 덮어써 렌더                   |
| `createMockDIContainer(overrides)` + `StaticDIProvider` | 훅 테스트용 컨테이너. 넣지 않은 것에 손대면 이름을 대며 실패 |
| `createMemorySyncStorage()`                             | MMKV 대신 메모리 저장소. 저장소 주입에 쓴다                  |
| `createMockHttpClient()`                                | HTTP 포트 stub                                               |
| `createTestQueryClient()`                               | 테스트용 QueryClient                                         |
| `createPurchasesGatewayStub()`                          | 결제 포트 stub                                               |
| `createSpeechRecognizerStub()`                          | 음성 인식 포트 stub                                          |
| `createLocalFileSystemFake()`                           | 파일 시스템 fake                                             |
| `createHapticsStub()`, `createErrorReporterStub()`      | 햅틱·오류 보고 stub                                          |

```tsx
// Given
const gateway = createPushNotificationGatewayStub({
  requestPermission: jest.fn(async () => createPushPermissionResponse({ status: 'granted' })),
});
const pushPromptService = new PushPromptService(
  createPushPromptRepository(createMemorySyncStorage()),
);

// When
await renderUi(<PushPermissionCard />, {
  di: { pushPromptService, pushDeviceService: new PushDeviceService(gateway /* … */) },
  queryClient,
});
```

예시: `push-permission-card.test.tsx`(홈 안내 단계별 동작), `use-push-device-sync.test.tsx`(보고 시점·debounce). 계약이 사용자 결과로 이어지는 흐름이라 둔 것이다. 이 방식을 기본으로 늘리지 않는다.

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

## 실행 명령

```bash
# 모바일 전체 단위 테스트
pnpm --filter @aido/mobile test --runInBand

# 특정 파일
pnpm --filter @aido/mobile test --runInBand todo-comment.service.test.ts

# 재현 순서·종료 핸들
pnpm --filter @aido/mobile test --runInBand --randomize --seed <number> --showSeed
pnpm --filter @aido/mobile test --runInBand --detectOpenHandles

# 정적 검증
pnpm --filter @aido/mobile lint
pnpm --filter @aido/mobile format:check
pnpm --filter @aido/mobile typecheck
pnpm --filter @aido/mobile check:conventions
pnpm --filter @aido/mobile test:conventions
```

작업을 마칠 때는 바꾼 파일의 테스트와 정적 검증을 먼저 실행한다. 전체 테스트는 공유 코드나 공통 설정을 바꿨거나 릴리스 전 회귀 확인이 필요할 때 실행한다.
