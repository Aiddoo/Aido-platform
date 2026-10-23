# Mobile App Architecture Guide

**Version**: 1.2.0 · **Last Updated**: 2026-10-14 · **Owner**: Aido Mobile Team

Feature-based Layered Architecture 기반 React Native/Expo 앱입니다.
새 기능 추가 시 이 문서의 패턴을 **반드시** 따릅니다.

---

## 디렉토리 구조

```
src/
├── bootstrap/providers/          # 앱 초기화 (DI, Auth, Query 등)
│   ├── di-provider.tsx           # 의존성 주입 컨테이너 생성
│   ├── di-context.tsx            # DIContainer 타입과 use{Feature}Service 훅
│   ├── auth-provider.tsx         # 인증 상태 관리
│   └── query-provider.tsx        # TanStack Query 설정
│
├── core/ports/                   # Port 인터페이스 (HttpClient, Storage, Logger, Analytics …)
│
├── features/{feature}/           # 기능별 모듈 (단수 kebab-case: todo, nudge, preference …)
│   ├── apis/                     # {feature}.service.ts + {entity}.mapper.ts (+ 로컬 저장소 repository)
│   ├── domains/                  # {entity}.model.ts(스키마·타입·Policy) + {feature}.error.ts
│   ├── constants/                # {feature}-query-keys.ts, 라벨·옵션 상수
│   ├── queries/                  # get-…-query-options.ts, use-…-mutation-options.ts, {feature}-cache.ts
│   ├── components/               # 의미 있는 UI 블록 (Loading·Error·Empty·Item namespace 포함)
│   ├── hooks/                    # 단일 책임 훅 (라우트 읽기, 상태 튜플, 전환 조정)
│   ├── utils/                    # 순수 계산, navigation resolver, view-models/
│   └── __tests__/                # {entity}.factories.ts
│
└── shared/
    ├── errors/                   # Result, ApiError, InfraError
    ├── hooks/                    # 공유 React 훅
    ├── infra/                    # Port 구현체
    ├── ui/                       # 공유 UI 컴포넌트
    ├── config/                   # 환경 설정
    └── utils/                    # 유틸리티
```

> **예외**: HTTP가 아닌 로컬 저장소(SecureStore, MMKV, 위젯 bridge)는 `apis/{name}.repository.ts`로 두고
> Service가 감싼다. 위젯의 네이티브 경계는 `features/widget/bridge/`에 둔다.

---

## 의존성 흐름

```
Presentation (components, queries)
  │  use{Feature}Service() 훅으로 서비스 주입
  ▼
Service (HTTP 호출 + Zod 검증 + Mapper 변환 + Policy 검증)
  │  this.#httpClient.get/post() 호출
  ▼
Infrastructure - Port 구현체 (KyHttpClient, SecureStorage)
```

**핵심 규칙**: 의존성은 항상 안쪽(Domain)을 향합니다.

---

## Core Ports

`src/core/ports/`에 위치하는 인터페이스입니다.

```typescript
// core/ports/http.ts
export interface HttpClient {
  get<T>(url: string, config?: RequestConfig): Promise<Result<T, ApiError>>;
  post<T>(url: string, data?: unknown, config?: RequestConfig): Promise<Result<T, ApiError>>;
  put<T>(url: string, data?: unknown, config?: RequestConfig): Promise<Result<T, ApiError>>;
  patch<T>(url: string, data?: unknown, config?: RequestConfig): Promise<Result<T, ApiError>>;
  delete<T>(url: string, config?: RequestConfig): Promise<Result<T, ApiError>>;
}
```

| Port                    | 구현체                                                    | 위치                                         |
| ----------------------- | --------------------------------------------------------- | -------------------------------------------- |
| `HttpClient`            | `KyHttpClient`                                            | `shared/infra/http/ky-client.ts`             |
| `Storage`               | `SecureStorage`                                           | `shared/infra/storage/secure-storage.ts`     |
| `EnumerableSyncStorage` | 초안 전용 MMKV 인스턴스(AES-256)                          | `shared/infra/storage/mmkv-draft-storage.ts` |
| `Logger`                | `ConsoleLogger` / `SentryLogger`(prod, composite)         | `shared/infra/logger/`                       |
| `Analytics`             | `FirebaseAnalytics`(prod) / `ConsoleAnalytics`(dev)       | `shared/infra/analytics/`                    |
| `ErrorReporter`         | `SentryErrorReporter`(prod) / `ConsoleErrorReporter`(dev) | `shared/infra/error-reporter/`               |

> 포트는 `core/ports/`에 정의, 벤더(`@sentry/*`·`@react-native-firebase/*`) 코드는 어댑터에만 격리. core/도메인/presentation은 벤더를 직접 import하지 않는다.

| 클라이언트                  | 용도                                 |
| --------------------------- | ------------------------------------ |
| `createPublicClient()`      | 인증 전 요청 (로그인, 회원가입)      |
| `createAuthClient(storage)` | 인증 후 요청 (Bearer 토큰 자동 첨부) |

### 관측(Observability) 스택

역할을 **분리**하되 타입 어휘를 통일한다. 상세 규칙: [observability.md](./observability.md)

| 도구                   | 담당                                                   | 진입점                                                                     |
| ---------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| **Sentry**             | 크래시·에러·검색가능 이벤트·breadcrumb (severity 판정) | `ErrorReporter` 포트 (`captureException`/`captureMessage`/`addBreadcrumb`) |
| **Firebase Analytics** | 제품 지표(이벤트/화면/유저 속성)                       | `Analytics` 포트 + 타입 카탈로그 `track()`/`useTrack()`                    |

- **Crashlytics는 사용하지 않는다** (Sentry로 크래시까지 일원화, 2026-07 정리).
- Breadcrumb 카테고리는 `BreadcrumbCategory` union(`http`·`navigation`·…)으로 고정 — 매직 문자열 금지.
- Analytics 이벤트는 `AppEventMap`(`shared/analytics/events/*.events.ts`)에만 정의, raw `trackEvent` 직접호출 금지.

---

## 에러 시스템

### 예측 가능 vs 예측 불가능

| 구분            | 에러 종류                                          | 처리 방식                         |
| --------------- | -------------------------------------------------- | --------------------------------- |
| **예측 가능**   | 서버 비즈니스 에러 (4xx), 클라이언트 검증 에러     | `Result.err()` 반환 → UI가 핸들링 |
| **예측 불가능** | 서버 장애 (5xx), 네트워크, 타임아웃, 스키마 불일치 | `throw` → ErrorBoundary가 catch   |

### 에러 계층

```
예측 가능 (Result.err로 반환)
─────────────────────────────
  BusinessError (interface)
    ├── ApiError              ← 서버 4xx 비즈니스 에러
    └── {Feature}Error        ← 클라이언트 도메인 에러

예측 불가능 (throw)
─────────────────────────────
  InfraError (abstract class)
    ├── ServerError           ← 5xx
    ├── NetworkError          ← 인터넷 연결 끊김
    ├── TimeoutError          ← 요청 시간 초과
    └── ParseError            ← Zod 응답 검증 실패
```

### Result 타입

```typescript
export type Result<T, E extends BusinessError = BusinessError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E extends BusinessError>(error: E): Result<never, E> => ({ ok: false, error });
export const unwrap = <T, E extends BusinessError>(result: Result<T, E>): T => {
  if (result.ok) {
    return result.value;
  }
  throw result.error;
};
```

---

## 레이어별 규칙

### 화면 조립과 서버 상태

- route 화면은 주요 섹션을 JSX에서 바로 조립해 화면 구성을 파일 진입점에서 읽을 수 있게 한다.
- `app/`의 첫 화면 컴포넌트는 실제 `Screen` 구성을 보여 준다. 화면 전체를 feature의 `pages/`로
  옮겨 재수출하거나 `Content → Header → Section` 같은 중간 조립 컴포넌트로 숨기지 않는다.
- 컴포넌트는 대상과 역할로 이름 짓는다. `AmountInput`, `CalculationResult`, `ProductList`처럼
  이름만으로 무엇을 입력·표시·조작하는지 드러나야 한다. 위치만 뜻하는 `Header`, `Section`, `Body`를
  분리 근거로 삼지 않는다. 간격·구분선·화면 순서는 Screen에서 조립하고, 작은 화면 전용 컴포넌트는
  같은 파일 아래에 둔다. 단순히 줄 수를 줄이기 위한 wrapper는 만들지 않는다.
- `useForm`, `useFormState`, `useQuery`, `useMutation`은 사용하는 컴포넌트에서 직접 호출한다.
  Screen의 줄 수를 줄이려고 조회·폼·저장·화면 이동·키보드 제어를 `useEditor`, `useActions` 같은
  포괄적인 훅에 묶지 않는다. 훅 추출에는 독립적인 단일 책임이 있어야 하며, 이름 변경이나 코드 이동만으로
  단일 책임을 충족했다고 판단하지 않는다. 순수 요청 데이터 변환은 순수 함수로, 의미 있는 UI는 컴포넌트로 분리한다.
- 탭·단계·상호 배타적인 화면 상태는 실제 union에 `match(...).with(...).exhaustive()`를 사용한다.
  외부 URL과 UI 라이브러리가 주는 문자열은 스키마로 검증한 뒤 상태에 넣는다. `as TabValue`로
  검증을 건너뛰지 않는다. 단순 표시 여부나 두 가지 문구에는 `&&`·삼항식을 그대로 쓸 수 있다.
- Suspense query나 Provider 소비 때문에 부모가 필요한 경우에는 같은 파일 아래의 `Route`가
  검증·Provider·화면 전체의 실패/로딩 경계만 맡는다. 실제 `Screen`은 파일 위에서 읽히게 유지한다.
  경계를 없애려고 query hook을 자기 자신의 Suspense 위로 옮기거나 네비게이터 전체로 경계를 넓히지 않는다.
- 가상 목록의 `ListHeaderComponent` 안에도 카드·정렬바·구분선 조립을 직접 적는다. 헤더를 목록
  밖으로 이동해 스크롤·초기 위치를 바꾸지 않는다. 네이티브 API의 `header`나 `ListHeaderComponent`는
  위치가 정해진 슬롯 계약이므로 이름만 보고 제거하지 않는다.
- 정상 목록과 오류 화면이 같은 native 슬롯 구성을 쓰면 Screen 안의 JSX 상수로 한 번 정의해 공유할 수
  있다. `listHeader`의 실제 조립은 같은 Screen에 두고, 별도 `Header`·`Section` 컴포넌트로 숨기지 않는다.
- route의 `todoId`, search param, 현재 mode 같은 화면 식별자를 여러 단계의 props로 배포하지 않는다.
  feature block이 검증된 Expo Router hook에서 직접 읽고, 이미 조회된 row 데이터나 순수 layout 값만 props로
  받는다.
- 한 번 전달하는 query options는 `useSuspenseQuery(useGet...QueryOptions(...))`처럼 사용처에서 직접 호출한다.
  `queryKey`나 `enabled`를 재사용하는 경우에만 옵션을 지역 변수에 둔다.
- 서버 상태는 `queryOptions`/`infiniteQueryOptions`/`mutationOptions` factory로 정의한다. component는
  식별자를 읽어 factory를 호출하되 query key, queryFn, cache 정책을 인라인으로 만들지 않는다.
- 순수 `get...QueryOptions(service, { ...dependencies })`는 `get-...-query-options.ts`에 둔다.
  같은 파일의 `useGet...QueryOptions`는 DI/locale 의존성만 주입한다. 서버 GET의 queryFn은
  TanStack Query AbortSignal을 Service → HttpClient/Ky에 전달한다.
- 옵션 팩토리의 인자는 `{ todoId, sort, focusCommentId }`처럼 이름 있는 객체로 받고, query key에도
  같은 직렬화 가능한 객체를 넣는다. 이 저장소는 Expo Router + TanStack Query + Ky를 사용하므로
  TanStack Router의 `loaderDeps`나 oRPC 패턴을 억지로 추가하지 않는다. 전환 전 데이터가 필요하면
  기존 query options로 prefetch한 뒤 URL search state를 바꾼다.
- 특정 목록에만 결합된 `Loading`, `Error`, `Empty`, `Item`은 `TodoComments.Loading`처럼 compound
  namespace로 묶는다. 독립적으로 재사용되지 않는 상태 UI를 전역 이름으로 흩뜨리지 않는다.
- 한 화면 block에서만 의미가 있는 작은 조립 조각은 소유 파일의 지역 컴포넌트로 둔다. 둘 이상의
  화면 surface가 공유할 때만 독립 파일로 승격하고, 함께 바뀌는 목록·행·작성기 family는 같은 하위
  폴더에 모은다. 폴더 `index.ts` re-export는 만들지 않고 정의 파일에서 직접 import한다.
- HTTP transport 성공 데이터는 `unknown`이다. Service가 공유 응답 스키마 전체를 검증한 뒤
  mapper로 독립적인 client model을 만든다. 응답 타입을 generic HTTP 인자나 DTO Omit으로 단정하지 않는다.
- form과 wire schema는 가능한 한 `@aido/api`를 단일 원본으로 사용한다. 모바일 전용 Date,
  policy, 화면 view-model만 model/mapper에서 별도로 표현한다.
- 페이지 단위 폼은 가장 가까운 session 부모가 `useForm`, Zod resolver, submit mutation을 소유하고
  지역 `FormProvider`로 field에 전달한다. `shared/ui/FormField`만 `Controller`를 소유하고 field는
  제어형 Input의 `value/onChange/onBlur`와 해당 fieldState를 소비한다. 액션은 `useFormState`/`useWatch`의
  좁은 구독을 사용한다. 폼 값을 전역 Context나 별도 전역 상태에 복제하지 않는다.
- hook은 라우트 읽기, 전환 조정, mutation 상태, field focus처럼 하나의 변화 이유만 갖는다. 계산은
  순수 함수/Policy로 빼고 화면 hook은 작은 계약을 조합한다. 한 컴포넌트에서만 쓰는 작은 hook은
  소유 파일에 둘 수 있다.
- 날짜 표시는 `shared/utils/date`의 호환 wrapper를 재사용한다. 순수 포맷 구현은
  `date-format.ts`의 Intl.DateTimeFormat에 locale/timeZone을 명시해 호출한다. 오늘 기준은
  `useToday`/`useTodayKey`로 읽고 render 중 `new Date()`를 기준 상태로 만들지 않는다.
  날짜 산술과 YYYY-MM-DD API key는 기존 dayjs 유틸을 유지한다.
- 미디어 업로드는 실제 API 계약이 있을 때만 도입한다. Expo 호환성과 유지 상태가 검증된 라이브러리를
  우선하고, 없다면 선택·검증·전송을 각각 작은 hook/service로 분리한다. API가 없는 기능을 미리 만들지 않는다.
- 상세 조회와 함께 발생해야 하는 서버 의미(예: 멱등 조회수)는 별도 `useEffect` mutation으로 호출하지 않는다. GET endpoint가 원자적으로 처리한다.
- 알림 wire payload는 `@aido/api`를 단일 원본으로 사용한다. 내부 화면 경로는
  `utils/navigation`의 순수 resolver가 검증된 route 재료로 결정한다. domain Policy와 화면
  컴포넌트는 Expo Router나 raw metadata를 알지 않는다.

### 컴포넌트 계약

**추출은 추상화가 아니다.** Screen이 길다는 이유만으로 JSX를 다른 파일로 옮기면 읽는 사람이 파일을
오가야 할 뿐 변경 이유는 줄지 않는다. 독립 파일 컴포넌트는 다음 중 하나일 때만 만든다.

- 이름이 입력·표시·조작 대상을 드러내고(`AmountInput`, `CalculationResult`, `ProductList`)
  내부에서 데이터 구독·변환·상태 UI를 책임진다.
- 둘 이상의 화면이 같은 계약으로 쓴다.

한 화면에서만 쓰는 입력·행은 Screen 파일 아래 지역 컴포넌트로 둔다. 내부가 BottomSheet여도 값을
입력받는다면 `SelectRepeatInput`처럼 `…Input`으로 이름 짓는다.

**입력 래퍼는 원본 계약을 살린다.** shared Input이나 HeroUI 컴포넌트를 감쌀 때는 원본 props를
`Omit<ComponentProps<typeof X>, …>`로 확장하고, 바꾸는 prop만 다시 선언한다. 사용처는 원본처럼
`value`/`onChange`/`label`/`placeholder`를 쓴다.

```tsx
interface CategoryColorInputProps extends Omit<ComponentProps<typeof HStack>, 'children'> {
  value: string;
  onChange: (color: string) => void;
}
```

- shared `Input`·`TextArea`는 `value`/`onChange(text)` 계약을 쓴다. raw `TextInput`·`onChangeText`를 다시 쓰지 않는다.
- HeroUI의 선택형(Checkbox, Switch, ControlField)은 원본 이름 `isSelected`/`onSelectedChange`,
  `RadioGroup`은 `value`/`onValueChange`, 비활성은 `isDisabled`를 그대로 쓴다. `disabled`·`selected`·`onToggle`처럼
  같은 의미의 다른 이름을 만들지 않는다.
- 오버레이 시트·다이얼로그는 `isOpen`/`onOpenChange` 계약을 따른다.

**도메인 식별자는 Props로 받지 않는다.** 화면 식별자(`todoId`, `friendId`, 선택된 항목 id)는 검증된
`use…ScreenParams()`나 상태 튜플 훅에서 컴포넌트가 직접 읽는다. 값이 `== null`이면 `.Empty`를 보여 준다.
그래야 식별자가 없는 화면에서도 같은 컴포넌트를 쓸 수 있다. 목록 행의 id, 루트 Overlay에서 렌더되어
라우트 문맥이 없는 시트의 대상 id는 예외로 Props로 받는다.

```tsx
export function FriendCalendar() {
  const { friendId } = useFriendScreenParams();
  // friendId로 조회
}
```

**데이터는 쓰는 컴포넌트가 조회한다.** 화면이 조회해 Props로 내려 주면 Suspense 경계를 블록 단위로
나눌 수 없다. 목록 컴포넌트는 도메인 대신 정책을 Props로 받는다(`filters`, `orderBy`, `limit`).

```tsx
<QueryErrorBoundary FallbackComponent={TodoList.Error}>
  <Suspense fallback={<TodoList.Loading />}>
    <TodoList />
  </Suspense>
</QueryErrorBoundary>
```

**반복 UI는 지역 컴포넌트로 추상화하고 나열한다.** 항목마다 기획·디자인이 따로 바뀔 수 있는 행은
설정 배열을 `.map`하지 않고 `<Record />`, `<ActionRow />` 같은 지역 컴포넌트를 명시적으로 나열한다.
상수로 개수가 정해지는 반복(`InputOTP.Slot`, 스켈레톤)은 es-toolkit `times`로 만든다.

**상태 훅은 `[value, setValue]` 튜플을 반환한다.** URL search param, MMKV, `useState` 어느 저장소든
사용처는 `useState`처럼 읽는다. 저장소를 바꿔도 사용처는 그대로다.

```tsx
const View = { friends: 'friends', received: 'received' } as const;
const viewSchema = z.enum(View);

function useView() {
  const { view } = useLocalSearchParams();
  const setView = useCallback(
    (next: z.infer<typeof viewSchema>) => router.setParams({ view: next }),
    [],
  );
  return [viewSchema.catch(View.friends).parse(view), setView] as const;
}
```

화면 파라미터는 `useLocalSearchParams`로 읽는다. `useGlobalSearchParams`는 보이지 않는 화면도 URL
변경마다 다시 렌더하므로 레이아웃이 자식 경로를 알아야 할 때만 쓴다. 레이아웃이 그리는 pane이 자식 route의
params를 읽어야 하면 `RouteSearchParamsProvider`로 그 params를 내려 주고, route 훅은 `useRouteSearchParams`로
읽는다(피드 레이아웃의 `FeedRouteParamsProvider`).

**기다리지 않는 Promise는 실패를 처리한다.** `void` 연산자를 쓰지 않는다. 이벤트 핸들러는 Promise를
반환하고, 결과를 기다리지 않는 호출은 실패를 내부에서 처리하는 함수이거나 호출부에서 `.catch`로 기록한다.

### 상태 분류(서버/URL/로컬)와 초안

상태는 원천 하나에만 둔다. 같은 값을 두 저장소에 복제하지 않는다.

| 상태                            | 원천                                          | 예                                                                     |
| ------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| 서버 원본                       | TanStack Query 캐시                           | 저장된 메모·댓글·할 일. 초안을 캐시에 넣지 않는다                      |
| 화면 선택·보기 방식·작성기 종류 | Expo Router search params                     | `todoId`, 메모 `id`, `comment`/`intent`. useState로 사본을 두지 않는다 |
| 작성 중 초안                    | `shared/draft` 초안 저장소(MMKV, 사용자 범위) | 댓글 작성기, 메모 편집·작성. 긴 본문을 URL에 넣지 않는다               |
| 일시적 UI 상태                  | `useState` / 지역 Context                     | 다이얼로그 열림, 포커스된 칸, 측정값                                   |

- 폼 값의 원천은 react-hook-form이다. 초안은 `useDraftStorage(draftKey)`가 첫 렌더에 한 번 동기로 읽어
  `defaultValues`에 넣고(빈 값으로 그린 뒤 채우지 않는다), `useFormDraftAutosave(form.subscribe, …)`가
  렌더 없이 디바운스 저장한다. 언마운트(폴더블 전환) 때 대기 중인 저장을 flush하고, 제출 성공·취소 버튼은
  반환된 discard 함수로 대기 저장까지 취소한 뒤 지운다.
- 키는 feature의 순수 함수(`createTodoCommentDraftKey`, `createMemoDraftKey`)가 `createDraftKey`로 만든다.
  `ownerId`(사용자 id)가 항상 들어가며, 명시적 로그아웃·회원 탈퇴 때만 `AuthProvider`가 초안을 모두 지운다. 세션 만료는 초안을 남겨 같은 사용자가 다시 로그인하면 이어 쓰게 하고,
  로그인 후 `useUserIdentity`가 현재 사용자 외 소유자의 초안을 지운다. 7일 지난 초안은 앱 시작 때 정리한다.
- 초안 저장소는 MMKV `encryptionKey`(AES-256)로 암호화한다. 키는 SecureStore에 최초 1회 만들어 보관한다. 키 조회가 비동기라
  `app/_layout.tsx`가 `useDraftStorageBootstrap`으로 스플래시 구간에 미리 열어 `DIProvider`에 넘긴다(초안 화면은 여전히 동기 복원).
  열기에 실패하면 초안 기능만 꺼지고(`disabledDraftStorage`) 앱은 정상 동작하며 Sentry에 보고한다. 평문 `aido.drafts`는 첫 실행에 옮긴 뒤 삭제한다.
- 편집 초안은 서버 원본 수정 시각(epoch ms)을 함께 저장한다. 원본이 더 새로우면 초안을 버리고 toast로 알린다.
- 비밀번호·인증 코드 같은 민감 입력은 초안으로 저장하지 않는다.
- 접기/펼치기에서 컴포넌트를 살릴 수 있으면 초안보다 재마운트를 없애는 쪽을 먼저 택한다(`AdaptivePane`은 pane을 같은 트리 슬롯에 둔다).

### 1. Models — 클라이언트 도메인 모델 + Policy

```
features/{feature}/domains/
├── {entity}.model.ts    # 스키마 + 타입 + 순수 함수 + {Entity}Policy
└── {feature}.error.ts   # ErrorCode + Error + Factory + Guard
```

**Domain Model**은 화면과 Policy가 의존하는 클라이언트 모델이다. 사용처는 항상 `domains/`의 이름만
import하고, 서버 DTO 이름을 직접 쓰지 않는다. 서버 스펙이 바뀌면 Mapper가 흡수하고 소비처는 그대로 둔다.

`@aido/api`는 서버와 공유하는 wire 계약의 단일 원본이다. 바퀴를 다시 만들지 않도록 다음 순서로 정의한다.

| 서버 응답과의 관계         | 클라이언트 모델 정의                                 |
| -------------------------- | ---------------------------------------------------- |
| 필드와 의미가 같다         | `@aido/api` 스키마 재사용 (필요 없는 필드는 `.omit`) |
| 날짜 등 일부 타입만 다르다 | `sharedSchema.extend({ createdAt: z.date() })`       |
| 모양·이름이 실제로 다르다  | 독자 스키마 + Mapper 변환                            |

```typescript
// preference.model.ts
export const preferenceSchema = userPreferenceSchema.omit({ timezone: true });
export type Preference = z.infer<typeof preferenceSchema>;
```

**Policy**는 비즈니스 규칙의 유일한 거처다. 규칙은 첫 인자로 클라이언트 모델을 받는 이름 있는 순수 함수로
작성하고, `{Entity}Policy` 객체가 Facade로 묶는다. 계산식이 바뀌면 순수 함수 하나만 고치고, 소비처는
`MemoPolicy.isCreatable(limit)`처럼 Policy만 호출한다.

```typescript
const PM10_GRADE_THRESHOLDS = [30, 80, 150] as const;

export function calculateDustGrade(value: number, thresholds: readonly [number, number, number]) {
  // 순수 계산
}

export function getPm10Grade(conditions: WeatherConditions) {
  if (conditions.pm10 == null) {
    return null;
  }

  return calculateDustGrade(conditions.pm10, PM10_GRADE_THRESHOLDS);
}

export const WeatherPolicy = {
  pm10Grade: getPm10Grade,
} as const;
```

- Policy에 화살표 함수 본문을 인라인으로 쓰지 않는다. 이름 있는 함수가 테스트 단위다.
- 현재 시각은 인자로 받는다. Policy 안에서 `Date.now()`·`new Date()`를 호출하지 않는다.
- 다른 피처의 Policy를 재수출하거나 위임만 하는 함수를 두지 않는다.
- 색상·i18n 키 같은 표시 값은 Policy가 반환하지 않는다. Policy는 등급·단계 같은 의미 값을 돌려주고
  컴포넌트가 `satisfies Record<Grade, …>` 맵으로 표시한다.
- Policy 테스트는 Given / When / Then 주석으로 경계값을 검증한다.

**Domain Error**: 클라이언트 비즈니스 에러 (서버 에러 `ApiError`와 완전히 별개)

폼 필드 유효성 검증(길이, 형식 등)은 Zod + react-hook-form에 위임한다.
Domain Error는 그 너머의 **비즈니스 규칙 위반** — Policy 검증 실패 시 Service가 서버 호출 전에 생성하여 불필요한 네트워크 요청을 차단한다.

예시:

- 자기 자신에게 친구 요청 시도 → 서버까지 갈 필요 없이 차단
- 일일 사용 한도 초과 상태에서 요청 시도 → 클라이언트에서 즉시 차단
- 빈 값이 아닌데 도메인 규칙에 맞지 않는 입력 (태그 형식 불일치 등) → 차단

```typescript
// {feature}.error.ts
export const {Feature}ErrorCode = {
  INVALID_INPUT: '{FEATURE}_INVALID_INPUT',
} as const;

export class {Feature}Error extends Error implements BusinessError {
  override readonly name = '{Feature}Error';
  constructor(public readonly code: {Feature}ErrorCode, message: string) {
    super(message);
  }
}

export const {Feature}Errors = {
  invalidInput: () => new {Feature}Error({Feature}ErrorCode.INVALID_INPUT, '입력값이 올바르지 않아요'),
} as const;

export const is{Feature}Error = (error: unknown): error is {Feature}Error =>
  error instanceof {Feature}Error;
```

### 2. Services — HTTP 호출 + Zod 검증 + Mapper 변환 + Policy 검증

```
features/{feature}/apis/
├── {feature}.service.ts    # Service 클래스
└── {entity}.mapper.ts      # DTO → 클라이언트 모델 순수 함수
```

**Service**: HttpClient를 직접 주입받아 HTTP 호출 + Zod 검증 + Mapper 변환 + Policy 검증을 수행

```typescript
export class {Feature}Service {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  // 패턴 A: HTTP + Zod + Mapper
  get{Feature}s = async (params: Get{Feature}sQuery, signal?: AbortSignal): Promise<Result<{Feature}sResult, ApiError>> => {
    // 1. API 호출
    const result = await this.#httpClient.get('v1/{feature}s', { params, signal });

    // 2. 서버 비즈니스 에러(4xx) 전파
    if (!result.ok) {
      return result;
    }

    // 3. Zod 응답 검증
    const parsed = {feature}ListResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[{Feature}Service] Invalid get{Feature}s response: ${parsed.error.message}`);
    }

    // 4. Mapper 변환 + ok() 반환
    return ok(to{Feature}sResult(parsed.data));
  };

  // 패턴 B: Policy + HTTP + Zod + Mapper
  create{Feature} = async (params: Create{Feature}Input): Promise<Result<{Feature}, {Feature}ServiceError>> => {
    if (!{Feature}Policy.isValidInput(params.name)) {
      return err({Feature}Errors.invalidInput());
    }

    const result = await this.#httpClient.post('v1/{feature}s', params);
    if (!result.ok) {
      return result;
    }

    const parsed = {feature}ResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[{Feature}Service] Invalid create{Feature} response: ${parsed.error.message}`);
    }

    return ok(to{Feature}(parsed.data));
  };
}
```

**Mapper**: 순수 함수, DTO → Domain 변환

서버 DTO를 클라이언트 Domain Model로 변환하는 유일한 지점이다.
Domain Model이 서버 DTO와 독립적일 수 있는 이유가 바로 이 Mapper 덕분이며, 서버 응답 구조가 변경되더라도 Mapper만 수정하면 Service와 Presentation 계층은 영향을 받지 않는다.

```typescript
export const to{Feature} = (dto: {Feature}DTO): {Feature} => ({
  id: dto.id,
  name: dto.name,
  createdAt: new Date(dto.createdAt),  // string → Date
});

export const to{Feature}s = (dtos: {Feature}DTO[]): {Feature}[] => dtos.map(to{Feature});
```

### 3. Presentations — Query·Mutation·Component

```
features/{feature}/
├── constants/{feature}-query-keys.ts
├── queries/
│   ├── get-{resource}-query-options.ts            # queryOptions
│   ├── get-{resource}-infinite-query-options.ts   # infiniteQueryOptions
│   ├── use-{action}-mutation-options.ts           # mutationOptions
│   └── {feature}-cache.ts                         # setQueryData·invalidate helper
├── components/{block}.tsx
├── hooks/use-{thing}.ts
└── utils/view-models/{name}.view-model.ts
```

#### 서버 스펙 변경은 Mapper에서, 화면별 파생은 select에서

```
HTTP(unknown)
  → Service: @aido/api 스키마 safeParse → ParseError
  → Mapper: DTO → 클라이언트 모델        ← 서버 스펙 변경은 여기만 고친다
  → Query 캐시에는 클라이언트 모델이 저장된다
  → select: filter·orderBy·limit·view-model ← 구독하는 화면별 파생
  → Component: Policy 호출 + Intl 포맷
```

| 위치             | 책임                                         | 실행 빈도                    |
| ---------------- | -------------------------------------------- | ---------------------------- |
| Mapper (queryFn) | 이름·구조 변환, ISO 문자열 → `Date`          | fetch마다 1회, 결과를 캐시   |
| select           | 같은 캐시에서 화면별 부분집합·정렬·표시 모델 | data나 select 참조가 바뀔 때 |
| Component        | 표시 포맷, 라벨                              | render마다                   |

- select에서 서버 스키마를 변환하지 않는다. 캐시에 DTO가 남으면 낙관적 업데이트(`setQueryData`)가
  서버 모양을 알아야 하고 모든 구독자가 같은 변환을 반복한다.
- select 함수는 참조가 안정적이어야 한다. 모듈 수준 함수를 우선하고, 인자가 필요하면
  `useGet…QueryOptions` 안에서 `useCallback`으로 감싼다. 인라인 화살표는 render마다 다시 실행된다.
- select는 순수하다. 현재 시각은 인자로 받고 원본 배열을 정렬하지 않는다(es-toolkit `orderBy`).
- 클라이언트 필터는 query key에 넣지 않고 select로 같은 캐시를 공유한다. 서버 파라미터는 key에 넣는다.

```typescript
const selectActiveFriends = (data: FriendPage[]) => data.flatMap((page) => page.items);

export function getFriendsInfiniteQueryOptions(friendService: FriendService) {
  return infiniteQueryOptions({
    queryKey: FRIEND_QUERY_KEYS.lists(),
    queryFn: async ({ pageParam, signal }) =>
      unwrap(await friendService.getFriends({ cursor: pageParam }, signal)),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
```

**Component에서 UI 표시 문구 관리**

UI 표시 문구는 i18n 카탈로그 키를 참조한다 (하드코딩 금지 — [i18n-guide.md](./i18n-guide.md)):

```typescript
// 라벨 맵은 값 대신 i18n 키를 담는다 (satisfies로 enum 누락 방지)
const DUST_GRADE_LABEL_KEYS = {
  good: 'weather:dust.good',
  moderate: 'weather:dust.moderate',
  bad: 'weather:dust.bad',
  veryBad: 'weather:dust.veryBad',
} as const satisfies Record<DustGrade, string>;
// 사용처: t(DUST_GRADE_LABEL_KEYS[grade])
```

**Query Keys**

키 이름에는 피처 접두사를 반복하지 않고, 인자는 이름 있는 객체로 받는다.
다른 피처의 캐시는 그 피처의 `{feature}-cache.ts` 함수로만 무효화한다.

```typescript
export const NUDGE_QUERY_KEYS = {
  all: ['nudge'] as const,
  interactions: () => [...NUDGE_QUERY_KEYS.all, 'interaction'] as const,
  interaction: ({ nudgeId }: { nudgeId: number }) =>
    [...NUDGE_QUERY_KEYS.interactions(), 'detail', { nudgeId }] as const,
} as const;
```

**Query Options**

```typescript
// get-memo-query-options.ts
export function getMemoQueryOptions(memoService: MemoService, { memoId }: { memoId: number }) {
  return queryOptions({
    queryKey: MEMO_QUERY_KEYS.detail({ memoId }),
    queryFn: async ({ signal }) => unwrap(await memoService.getMemo(memoId, signal)),
  });
}

export function useGetMemoQueryOptions({ memoId }: { memoId: number }) {
  return getMemoQueryOptions(useMemoService(), { memoId });
}
```

**Mutation 에러 처리**

`mutationFn`에서 **반드시** `unwrap()`을 사용합니다.

> ⚠️ **왜 Result를 직접 반환하면 안 되나요?**
>
> React Query는 `mutationFn`이 throw하지 않으면 **성공**으로 간주합니다.
> `Result.err()`를 반환해도 React Query 입장에서는 정상 반환이므로 `onSuccess`가 호출됩니다.
> 따라서 `unwrap()`으로 에러를 throw해야 `onError` 콜백이 올바르게 동작합니다.

**에러 처리 흐름**

```
HTTP 요청
    ↓
[KyHttpClient]
    ├─ 4xx → return err(ApiError)      ← 예측 가능
    ├─ 5xx → throw ServerError         ← 예측 불가능
    ├─ 타임아웃 → throw TimeoutError   ← 예측 불가능
    └─ 네트워크 → throw NetworkError   ← 예측 불가능
    ↓
[Service] → Result 그대로 전파 (또는 추가 검증 후 err 반환)
    ↓
[Presentation - mutationFn]
    unwrap(result)
    ├─ result.ok → 값 반환 → onSuccess
    └─ result.err → throw → onError
    ↓
[onError 콜백]
    ├─ isApiError(error) → 토스트 또는 코드별 분기
    ├─ is{Feature}Error(error) → 토스트 또는 코드별 분기
    └─ InfraError → ErrorBoundary (re-throw)
```

---

**기본 Mutation 예제**

```typescript
export const useCreate{Feature}MutationOptions = () => {
  const {feature}Service = use{Feature}Service();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (params: Create{Feature}Input) => {
      return unwrap(await {feature}Service.create{Feature}(params));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: {FEATURE}_QUERY_KEYS.all });
      toast.success('생성되었어요');
    },
    onError: (error) => {
      // ApiError, {Feature}Error 모두 message에 사용자 친화적 메시지가 있음
      if (isApiError(error) || is{Feature}Error(error)) {
        toast.error(error.message);
      }
      // InfraError는 QueryErrorBoundary가 처리
    },
  });
};
```

---

**에러 코드별 분기가 필요한 경우**

특정 에러 코드에 따라 다른 동작이 필요하면 `onError`에서 분기합니다.

```typescript
onError: (error) => {
  // 1. 서버 비즈니스 에러 (4xx)
  if (isApiError(error)) {
    if (error.hasCode('FEATURE_0001')) {
      // 특정 에러 코드에 대한 커스텀 처리
      return;
    }
    if (error.isDomain('FEATURE_')) {
      // 도메인 접두사로 분기
      return;
    }
    toast.error(error.message);
    return;
  }

  // 2. 클라이언트 도메인 에러
  if (is{Feature}Error(error)) {
    if (error.code === {Feature}ErrorCode.INVALID_INPUT) {
      // 특정 에러에 대한 커스텀 처리
      return;
    }
    toast.error(error.message);
    return;
  }

  // 3. InfraError → re-throw하여 ErrorBoundary로 전파
  throw error;
},
```

---

**에러 유형별 처리 요약**

| 레이어                            | 에러 처리 방식       |
| --------------------------------- | -------------------- |
| Service                           | `Result<T, E>` 반환  |
| Presentation (queryFn/mutationFn) | `unwrap()` 사용      |
| InfraError                        | ErrorBoundary가 처리 |

| 에러 유형                       | 타입 가드                 | 처리 방식             |
| ------------------------------- | ------------------------- | --------------------- |
| **서버 비즈니스 에러 (4xx)**    | `isApiError(error)`       | 토스트 or 코드별 분기 |
| **클라이언트 도메인 에러**      | `is{Feature}Error(error)` | 토스트 or 코드별 분기 |
| **인프라 에러 (5xx, 네트워크)** | -                         | ErrorBoundary가 처리  |

**ApiError 유틸리티**

```typescript
error.hasCode('FEATURE_0001'); // 특정 에러 코드 확인
error.isDomain('FEATURE_'); // 도메인 접두사로 확인
error.message; // 한국어 사용자 친화적 메시지
```

**Component + Loading 서브컴포넌트**

```tsx
export function {Feature}List() {
  const { data } = useSuspenseQuery(get{Feature}sQueryOptions());
  return <FlashList data={data.items} renderItem={({ item }) => <{Feature}Item item={item} />} />;
}

{Feature}List.Loading = function Loading() {
  return <VStack>{times(5, (i) => <Skeleton key={i} />)}</VStack>;
};
```

**사용**

```tsx
<QueryErrorBoundary>
  <Suspense fallback={<{Feature}List.Loading />}>
    <{Feature}List />
  </Suspense>
</QueryErrorBoundary>
```

---

## DI (의존성 주입)

`bootstrap/providers/di-provider.tsx`에서 모든 인스턴스를 생성합니다.

```
Storage → HttpClient → Service → DIContext → use{Feature}Service() 훅
```

**새 Feature 등록**

```typescript
// 1. di-context.tsx — DIContainer 인터페이스에 추가
export interface DIContainer {
  {feature}Service: {Feature}Service;
}

// 2. di-provider.tsx — useState 초기화에서 생성
const {feature}Service = new {Feature}Service(authHttpClient);

// 3. return에 추가
return { {feature}Service };

// 4. di-context.tsx — 훅 export 추가 (사용처는 di-context에서 import)
export const use{Feature}Service = () => useDI().{feature}Service;
```

---

## 새 Feature 추가 체크리스트

### Step 1: Models

- [ ] `features/{feature}/domains/{entity}.model.ts` — 클라이언트 모델 + 순수 함수 + Policy
- [ ] (필요 시) `features/{feature}/domains/{feature}.error.ts` — ErrorCode + Error + Factory + Guard

### Step 2: Services + Mapper

- [ ] `features/{feature}/apis/{entity}.mapper.ts` — DTO → 클라이언트 모델 순수 함수
- [ ] `features/{feature}/apis/{feature}.service.ts` — Service 클래스 (HttpClient 주입, HTTP + Zod + Mapper + Policy)

### Step 3: DI 등록

- [ ] `bootstrap/providers/di-provider.tsx` — 인스턴스 생성
- [ ] `bootstrap/providers/di-context.tsx` — `DIContainer` 필드 + `use{Feature}Service` 훅

### Step 4: Presentations

- [ ] `constants/{feature}-query-keys.ts`
- [ ] `queries/get-…-query-options.ts`, `queries/use-…-mutation-options.ts`
- [ ] (다른 피처가 무효화해야 하면) `queries/{feature}-cache.ts`
- [ ] `components/` — 의미 있는 UI 블록과 `.Loading`·`.Error`·`.Empty`·`.Item`
- [ ] (필요 시) `hooks/`, `utils/`

---

## DO / DON'T

### DO

```typescript
// private 필드는 # 구문
readonly #httpClient: HttpClient;

// Service 메서드는 arrow function
get{Feature}s = async (params): Promise<Result<{Feature}sResult, ApiError>> => { ... };

// Service에서 Zod safeParse + ParseError throw
const parsed = schema.safeParse(result.value);
if (!parsed.success) {
  throw new ParseError(`[{Feature}Service] Invalid ... response: ${parsed.error.message}`);
}

// Query options에서 unwrap
queryFn: async () => unwrap(await service.getData());

// mutation onSuccess에서 invalidate
onSuccess: () => queryClient.invalidateQueries({ queryKey: KEYS.all });

// 예측 가능한 에러(4xx)는 return result (passthrough)
if (!result.ok) {
  return result;
}

// 비즈니스 로직은 Policy 객체에
{Feature}Policy.canEdit(item);

// Loading은 Named Function 서브컴포넌트
MyComponent.Loading = function Loading() { ... };

// Suspense + QueryErrorBoundary 조합
<QueryErrorBoundary>
  <Suspense fallback={<Component.Loading />}>
    <Component />
  </Suspense>
</QueryErrorBoundary>
```

### DON'T

```typescript
// Domain Model에서 서버 DTO 타입을 직접 사용 금지
export type {Feature} = ServerDTO;  // ❌ Mapper로 변환 필수

// Presentation에서 HttpClient 직접 사용 금지
const http = useDI().httpClient;  // ❌ Service를 통해서만

// Presentation에서 Service 우회 금지
const repo = useDI().{feature}Repository;  // ❌ Service를 통해서만

// 컴포넌트에서 Result 직접 다루기 금지
if (result.ok) { ... }  // ❌ unwrap 사용

// 컴포넌트에 비즈니스 로직 넣기 금지
const canEdit = Date.now() - item.createdAt < 24 * 60 * 60 * 1000;  // ❌ Policy 사용

// Query key 하드코딩 금지
queryKey: ['{feature}', 'list'];  // ❌ QUERY_KEYS 상수 사용

// InfraError catch 금지 (ErrorBoundary가 처리)
try { ... } catch (e) { if (e instanceof ServerError) ... }  // ❌

// Policy를 class로 만들기 금지
class {Feature}Policy { ... }  // ❌ 객체 리터럴 사용
```
