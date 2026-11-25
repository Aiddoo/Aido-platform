# 데이터

서버·OS·기기 저장소와 값을 주고받는 층의 규칙이다. 층 표와 의존 방향은 [structure](./structure.md), 모델·Policy·mapper는 [model](./model.md), 상태 원천과 params는 [state-and-routing](./state-and-routing.md), 폼은 [forms](./forms.md), 오류 분류는 [error-handling](../error-handling.md)이 원본이다. 아직 이 모양이 아닌 코드는 [다음 버전 후보 이슈(#1785)](https://github.com/Aiddoo/Aido-platform/issues/1785)에 있다.

## Server API

```ts
// features/notes/memo/apis/memo.api.ts
export class MemoApi {
  readonly #httpClient: HttpClient;
  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }
  getMemo = async (memoId: number, signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get(`v1/memos/${memoId}`, { signal }),
      memoDetailResponseSchema,
      ({ memo }) => toMemo(memo),
      '[MemoApi] Invalid getMemo response',
    );
}
```

- 서버 모듈 하나에 `{Entity}Api` 하나다(`apis/{entity}.api.ts`, DI 훅 `use{Entity}Api`). `HttpClient`만 받고 응답 진단이 필요할 때만 `AppLogger`를 더한다. 저장소·OS 포트·다른 Api는 받지 않는다.
- 메서드는 `Promise<Result<T, ApiError>>`다. 4xx는 `fail(ApiError)`, 5xx·네트워크·파싱은 throw다. 분류는 `KyHttpClient` 한 곳이 한다([error-handling](../error-handling.md#분류는-kyhttpclient-한-곳)).
- 응답은 `parseApiResponse(응답, 계약 스키마, mapper, 메시지)`로 검증하고 모델로 바꾼다. `HttpClient`의 성공 값은 `unknown`이고 generic으로 단정하지 않는다. 요청 바디는 mapper `to{X}Request`가 만든다([model](./model.md#mapper)). GET은 `signal`을 받아 `HttpClient`까지 넘긴다.
- class, 화살표 필드, `#` 비공개다. 생성자는 의존만 받고 기본값을 두지 않는다. 추적·Sentry 보고를 하지 않는다. 부르는 곳은 query·mutation 옵션과 Device Service뿐이고, 컴포넌트는 `HttpClient`·`Result`를 다루지 않는다.

## Device Service와 Session

- Service(`services/{name}.service.ts`)는 진짜 조율이 있을 때만 만든다. 여러 포트·Api·저장 값·Policy를 엮는 기기 유스케이스다(`PushRegistrationService`, `SignInService`, 위젯 동기화, 리뷰 요청).
- 통과 메서드를 두지 않는다. 저장소 하나를 그대로 읽고 쓰면 저장 값 정의, 판정이면 Policy다.
- 받는 것은 포트, 쓰는 메서드만 고른 `Pick<XApi, 'method'>`, 저장 값 함수, Policy, `AppLogger`, 시계 `now: () => Instant`다. `HttpClient`를 직접 받지 않는다. 의존이 셋까지면 위치 인자, 넷부터 `{Class}Ports` 객체 하나다.
- 결과는 판별 유니온이다. 삼킨 실패만 `logger.warn`하고 추적·`captureException`은 훅과 mutation 콜백이 한다. 결과를 캐시에 두는 동작(OS 권한 요청)은 mutation 옵션이 부르고, 캐시할 값이 없는 기기 동작은 핸들러가 `use{Name}Service()`로 바로 부른다.
- 서로 모르는 `await`는 사용자가 느끼는 대기(버튼·첫 화면·새로고침)가 실제로 줄 때 함께 시작한다. 하나 실패가 전체 실패면 `Promise.all`, 각자 기록하고 이어 가면 `Promise.allSettled`다. 차례가 뜻이거나(세션·토큰·키체인 쓰기, 대화상자, 직렬 큐, 백오프) 이득이 작으면(MMKV 동기, 캐시된 값) 차례로 두고 코드로 안 보이는 차례는 이유를 한 줄 남긴다. 화면이 기다리지 않아도 되는 서버 보고는 버튼 대기에 물리지 않는다.
- Session(`services/{name}.session.ts`)은 타이머·구독을 가진 수명 객체다. 포트만 받고 `dispose()`를 두며, 만든 Provider·훅의 effect 정리가 `dispose()`를 부른다. 생성자는 구독·타이머·저장소 쓰기를 하지 않는다([structure](./structure.md#di포트수명)).

## Repository와 Store

- Repository(`repositories/{name}.repository.ts`)는 저장 값 정의로 안 되는 것만 남는다. SecureStore 비동기(pending-revocation, push-registration), 파일(voice-recording), 접두사 열거·옛 키 정리와 이주(whats-new, coachmark, voice-note-draft, draft), 옛 기기 기록 이주(marketing-push-prompt), 옛 저장 모양 읽기(store-review), Android 헤드리스 위젯(widget-navigation, android-widget-snapshot)이다.
- `create{Name}Repository(storage)`가 화살표 속성 객체를 돌려준다. 메서드는 `find*`(→ `T | null`), `save`, `remove`, `update(scope, transition)`, `subscribe`(→ 해제 함수)다. 저장 포트, storage 스키마, `AppLogger`만 쓴다. 판정은 Policy가 하고 시각은 인자(`at`)로 받는다. 키 문자열과 파서를 밖으로 내보내지 않는다.
- 읽지 못함은 비어 있음이 아니다 — 정리 작업은 저장소를 읽은 경우에만 지운다. 암호화 저장소를 열지 못한 실행은 어느 초안도 가리키지 않는 녹음을 지우지 않고(`VoiceNoteStorageService`), 오프라인이라 보내지 못한 탈퇴는 결과 모르는 탈퇴로 남기지 않으며 결과를 모르던 탈퇴도 계정이 살아 있다는 증거가 오면 잊는다([auth](../auth.md)).
- Store(`stores/{name}.store.ts`)는 메모리 상태 기계다. `create{Name}Store()`가 `getSnapshot`·`subscribe`·이름 있는 동작을 돌려준다(알림 진입, 인증 세션, 온보딩 가드). 포트·영속을 모르고, DI가 만들며, React는 `useSyncExternalStore`로 읽는다. 모듈 전역에 두지 않는다.

## 저장 값

기기 값 하나는 정의 하나다(`schemas/{name}-storage.schema.ts`의 `{name}StoredValue`). 키·모양·기본값·저장 영역이 바뀌면 그 정의만 고친다.

```ts
// features/voice/schemas/offline-model-declined-storage.schema.ts
export const offlineModelDeclinedStoredValue = defineStoredValue({
  key: ({ accountId, locale }: { accountId: string; locale: SpeechLocale }) =>
    `aido_offline_model_declined_v1:${encodeURIComponent(accountId)}:${locale}`,
  area: 'account',
  schema: z.literal('declined'),
  fallback: null,
});

const [viewMode, setViewMode] = useStoredValue(calendarViewModeStoredValue);
const [dismissedOn, setDismissedOn] = useStoredValue(allDoneBannerStoredValue, me?.id);
const storage = useStoredValueStorage(upsellDismissalStoredValue); // 핸들러·effect에서 읽고 쓸 때
```

- **키와 범위.** `defineStoredValue({ key, area?, schema, fallback, migrate? })`의 `key`는 문자열이거나 범위를 받는 함수다. 범위는 계정 id이거나 `{ accountId, locale }` 같은 객체다. 범위 키에 범위를 넘기지 않거나 문자열 키에 범위를 넘기면 타입 오류다. 범위가 `null`·`undefined`면(로그인 전) `fallback`으로 읽고 쓰지 않는다.
- **영역.** `area`는 `'device'`(기본, 앱과 위젯이 함께 읽는 MMKV)나 `'account'`(로그아웃 때 통째로 비우는 암호화 MMKV)다. 탈퇴 때만 지울 계정 기록은 device에 두고 `UserDeviceDataService`가 지운다. 범위 키를 쓰는 device 값은 모두 계정 기록이라 조립(`create-app-container.ts`)의 탈퇴 등록부에 `clear(accountId)`를 넣는다. 넣지 않으면 정의 파일을 모두 읽는 완전성 테스트(`create-app-container.test.ts`)가 실패한다.
- **원문과 실패.** `schema`는 원문 문자열을 값으로 읽는다(입력 타입 `string`). 원문이 JSON이면 `storedJsonSchema(schema)`로 감싸고(`upsellDismissalStoredValue`), 감싸지 않은 객체 스키마는 타입 오류다. 쓰기는 문자열 값이면 원문 그대로, 그 밖의 값이면 `JSON.stringify`이고 스키마의 변환(초대 코드 정규화)을 거꾸로 돌리지 않는다. 정수는 `String(n)`과 같은 원문이다. `fallback: null`이면 값은 `T | null`이다. 읽기는 던지지 않는다. 없거나 깨진 값은 `fallback`이고, 지금 스키마로 못 읽는 옛 원문은 `migrate(raw)`가 읽는다. `null`을 쓰면 키를 지운다. 쓰기 실패는 삼키고(다음에 한 번 더 묻거나 보일 뿐이다), `removeStoredValue`는 로그아웃·탈퇴 정리가 실패를 기록하도록 던진다.
- **React.** `useStoredValue(def, scope?)`는 `[value, setValue]` 튜플이다. 원문 문자열이 같으면 다시 파싱하지 않고 같은 참조를 준다. 핸들러·effect에서만 읽고 쓰는 값은 `useStoredValueStorage(def)`로 그 영역의 저장소를 꺼내 `readStoredValue`·`writeStoredValue`·`removeStoredValue`를 쓴다. Service와 헤드리스 실행은 생성자로 받은 저장 포트에 같은 정의를 쓴다. 도구는 `shared/storage/`이고 포트 `ObservableSyncStorage` 위에 있다. react-native-mmkv 훅을 직접 쓰지 않는다. 포트 하나로 저장소 세 곳(기기 MMKV·위젯 저장소·암호화 초안)을 같은 방식으로 다루고 정의가 zod로 값을 검증하기 때문이다. iOS App Group 주의는 [widgets](../widgets.md#플랫폼-선택)에 있다.
- 새 키는 `aido_{feature}_{name}_v{n}`이다. 계정 범위면 `:{accountId}`, 하위 값이면 `:{sub}`를 붙인다. 출시된 키는 이 모양이 아니어도 그대로 둔다(`aido_calendar_view_mode`). 키 문자열은 `*-storage.schema.ts`와 남은 repository 밖에 쓰지 않는다(lint). 있는 키는 출시 앱이 읽는 외부 계약이다. 키나 모양을 바꾸면 옛 값을 시작할 때 한 번 옮기고(`migrate`, 이주 repository) 옛 키를 읽는 코드는 다음 minor 버전에서 지운다([compatibility](../../../../docs/conventions/compatibility.md)).
- 같은 값을 Query 캐시나 `useState`에 복사해 따라가게 하지 않는다. 화면에 들어온 순간의 값으로 고정해야 할 때만(발자국 축하) `useState(() => readStoredValue(…))`로 한 번 읽는다. 다시 보일 때를 정하는 기간 규칙은 Policy `shouldShow*(record, now)`이고 안내 노출 표는 [design](../design.md)에 있다.

## 흐름: mapper → 캐시 → select → view-model

| 하는 일                                          | 둘 곳                | 이유                                                                      |
| ------------------------------------------------ | -------------------- | ------------------------------------------------------------------------- |
| DTO·OS 값 → 모델, 바깥 값 파싱                   | mapper(`queryFn` 안) | 요청당 한 번 돌고 결과가 캐시된다. 서버가 바뀌면 여기만 고친다            |
| 쿼리 데이터의 거르기·정렬·개수·범위·묶기·고르기  | Query `select`       | 데이터나 `select`가 바뀔 때만 돈다. 고른 조각이 같으면 다시 그리지 않는다 |
| 쿼리 밖 값(폼 값)의 표시용 묶기, 라벨 키·색 토큰 | view-model           | 렌더 중 싼 순수 계산이다                                                  |
| 업무 판정                                        | Policy               | 테스트 단위다                                                             |

- **키에는 서버 인자만 넣는다.** 클라이언트 필터·정렬·`limit`·날짜 범위는 키에 넣지 않고 `select`로 같은 캐시를 나눠 쓴다. 범위를 키에 넣으면 같은 데이터를 범위마다 따로 받고 따로 영속한다. `queryFn`이 쓰는 값(시간대 포함)은 모두 키에 있다.
  - 완료 기록은 달(그 달 1일) 키 하나(`TODO_QUERY_KEYS.completionsByMonth`)이고 그 달을 일요일 시작 주로 채운 칸을 받는다. 달력은 달 키를 그대로, 위젯 주·이번 주 기록·날씨 10일은 `useGetDailyCompletionsInRangeQueriesOptions(range)`로 기간을 덮는 달 키(한 달 칸이 덮지 못하면 두 달)를 `useQueries`·`useSuspenseQueries`에 넘기고 `combine`이 기간의 날만 고른다.
- **`select`는 캐시를 쪼개지 않는다.** 캐시 항목은 `queryKey`로만 정해지고 `select`는 관찰자마다 그 위에서 돌며 결과는 구조 공유된다. 화면마다 다른 `select`는 TanStack Query가 권하는 방식이다([Render Optimizations](https://tanstack.com/query/v5/docs/framework/react/guides/render-optimizations#select)).
- `select` 함수는 `queries/{entity}.queries.ts`의 이름 있는 모듈 함수(`select{X}`, 여럿이면 객체 `{X}Select`)다. 옵션 훅이 `filters`·`orderBy`·`limit`(모델의 `Filter{X}`·`OrderBy{X}`)을 받아 안에서 쓰거나, 컴포넌트가 `{ ...useGetXQueryOptions(), select: selectX }`로 고른다. 화면이 주는 값(분 단위 지금, 다른 조회의 결과)으로 고르는 칸은 그 값을 받아 `select`를 돌려주는 함수로 두고 `select: WeatherReportSelect.hero(now)`처럼 넘긴다(`aido/no-inline-query-options`). `select`로 오류를 던지거나 DTO를 바꾸지 않는다.
- 무한 목록의 쪽 모양은 모델 `shared/domains/cursor-page.model.ts`의 `cursorPageSchema(item, cursor)`(`{ items, nextCursor }`) 하나이고, TanStack 도구는 `shared/query/cursor-page.ts`의 `getNextCursor(page)`(`getNextPageParam`), `selectPageItems(data)`(`select`), `mapInfiniteItems(data, fn)`(캐시 패치)다.
  - 쪽 모델은 `cursorPageSchema(item, cursor).extend({ totalCount })`처럼 만든다. 서버의 `hasNext`·`hasMore`와 "마지막 항목 id가 커서"는 mapper가 `nextCursor`로 접고 마지막 쪽이면 `null`이다. 계약은 그대로 둔다.
  - 첫 쪽은 `initialPageParam: undefined`, 다음 쪽은 `getNextPageParam: getNextCursor`다. 위아래로 잇는 댓글 목록만 `pagination`과 자기 page param을 쓴다([todo-comments](../todo-comments.md)).
  - 마지막 항목 id가 커서인 목록은 캐시에서 항목을 빼거나 되돌릴 때 그 쪽 `nextCursor`를 남은 마지막 항목으로 다시 맞춘다(`friend-cache.ts`). 지운 항목의 id로 이어 받으면 서버가 빈 쪽을 줘 목록이 일찍 끝난다.

## 쿼리 키

```ts
// features/notification/queries/notification-query-keys.ts
export const NOTIFICATION_QUERY_KEYS = {
  all: ['notification'] as const,
  lists: () => [...NOTIFICATION_QUERY_KEYS.all, 'list'] as const,
  list: (filters: NotificationListQueryKey) =>
    queryOptions<InfiniteData<NotificationPage, number | undefined>>({
      queryKey: [...NOTIFICATION_QUERY_KEYS.lists(), filters],
    }).queryKey,
  unreadCount: () =>
    queryOptions<number>({ queryKey: [...NOTIFICATION_QUERY_KEYS.all, 'unread-count'] }).queryKey,
} as const;
```

- 키 팩토리는 `queries/{feature}-query-keys.ts`, mutation 키는 `queries/{feature}-mutation-keys.ts`다. 쿼리 옵션·cache helper와 함께 바뀌어 같은 폴더에 둔다. `aido/query-key-location`이 그 밖의 `queryKey: [`를 막는다.
- mutation은 모두 키를 갖는다. 같은 캐시를 쓰는 변경은 묶음 키(`writes()`)를 함께 써 `isLastMutation`·`useIsMutating`이 세고, 그 밖의 변경은 옵션 이름의 키(`AUTH_MUTATION_KEYS.emailLogin()`)다. 아직 키가 없는 것은 권한 층이 다루는 OS 권한 요청 3개다.
- 루트는 기능 이름 하나다(`['notification']`). 한 루트가 다른 기능 루트의 접두사가 되지 않는다(`bootstrap/query/query-key-roots.test.ts`). mutation 키 루트는 `[feature, 'mutation']`이다.
- 모든 잎은 `queryOptions<T>({ queryKey }).queryKey`로 데이터 타입을 붙여 `getQueryData`·`setQueryData`가 제네릭 없이 타입을 안다. 인자는 이름 있는 객체 하나이고 잎은 루트와 같지 않다. 그룹(`lists()`)은 무효화에 쓸 때만 만든다.
- OS에 묻는 값(권한, 위치, 캘린더 목록) 쿼리는 `['device', …]` 루트에 둔다(`['device', 'push-permission']`·`calendar-permission`·`location`·`calendar-collections`). 기능 무효화에 휩쓸려 OS를 다시 묻지 않는다. 앱 아이콘은 기능 루트 `['app-icon']`이다([권한](../permissions.md)).
- 키를 컴포넌트에서 만들거나 하드코딩하지 않는다. 키 자리에 기대는 구조 분해(`const [, , params] = queryKey`)를 쓰지 않는다.
- 조회 옵션은 `useGet{X}QueryOptions`·`useGet{X}InfiniteQueryOptions` 훅이고 `queryFn`은 `unwrap(await api.getX(…, signal))`이다. 화면은 `useSuspenseQuery(useGetXQueryOptions(…))`를 직접 부른다. 서로 독립인 조회는 `useSuspenseQueries`나 블록별 경계로 나눠 워터폴을 만들지 않는다.
- **워터폴은 `usePrefetchQuery`로 막는다.** 안쪽 경계가 멈춘 뒤에야 시작될 조회는 경계 바깥 컴포넌트에서 같은 옵션으로 `usePrefetchQuery`를 불러 함께 시작한다(`memo-list.tsx`의 내 정보, 날씨 `ForecastCards`의 할 일 점은 `usePrefetchForecastCompletions`). 캐시가 이미 있으면 아무것도 하지 않고 기다리지도 않는다. 이유를 주석 한 줄로 남긴다([Prefetching](https://tanstack.com/query/v5/docs/framework/react/guides/prefetching)).
- 폴링 간격·`staleTime`·재시도 지연은 `queries/{entity}.queries.ts`(세션은 `services/{name}.session.ts`)의 지역 표다. 모델은 의미 값만 준다. 폴링 쿼리는 `subscribed: isFocused`로 가려진 화면에서 멈추고 다시 보이면 낡은 값을 바로 받는다. 가져오기 진행 폴링은 예외다. 끝났음을 받아야 할 일 목록을 다시 맞추므로 다른 탭에 가려져도 돈다.
- `maxPages`는 앞뒤 커서(`getPreviousPageParam`)가 있는 목록에만 둔다. 앞 쪽을 버리면 다시 받기가 남은 첫 쪽의 커서부터 시작해 위쪽을 되찾을 길이 없다. 서버 커서가 앞으로만 가는 목록(영속하는 친구 목록 포함)은 두지 않는다. `useQueries`의 `combine`은 배열·plain 객체를 돌려준다(`Map`은 구조 공유가 안 돼 매번 다시 그린다).

## 무효화

1. `queryClient`는 `queries/{feature}-cache.ts`만 만진다(앱 조립 `bootstrap/**`과 공용 도구 `shared/query/**`는 예외, [guardrails](./guardrails.md)). 컴포넌트·훅·route는 helper를 부른다. helper 이름의 동사는 하는 일을 말한다.

   | 동사                                    | 하는 일                                                            | 예                                                 |
   | --------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------- |
   | `set{X}InCache`                         | 응답이나 updater로 캐시 값을 쓴다                                  | `setPreferenceInCache`, `setTodoCategoriesInCache` |
   | `update…`                               | 받은 값이 있을 때만 updater로 고쳐 쓴다(새 이름은 `set{X}InCache`) | `updateMeInCache`, `updateCachedTodo`              |
   | `invalidate{X}`                         | 낡음 표시, 보이는 조회는 다시 받는다                               | `invalidateTodos`                                  |
   | `settle{X}`                             | 겹친 쓰기의 응답을 마무리한다(응답 쓰기 또는 낡음 표시·다시 받기)  | `settleTodoWrite`, `settlePreferenceWrite`         |
   | `refresh{Feature}`                      | 당겨서 새로고침. 활성 조회만 기다려 다시 받는다                    | `refreshMemos`                                     |
   | `refetch{X}`                            | 낡음 표시 없이 그 조회만 지금 다시 받는다                          | `refetchMe`                                        |
   | `cancel{X}`·`ensure{X}`·`fetchFresh{X}` | 받기 멈추기, 없을 때만 받기, 늘 서버 값 받기(`queryClient.query`)  | `ensurePreference`                                 |
   | `getCached{X}`·`findCached{X}`          | 읽기만 한다                                                        | `getCachedMe`                                      |

2. mutation 옵션이 캐시 효과를 모두 갖는다. `onSuccess`는 응답을 캐시에 쓰고 무효화는 `onSettled`에 둔다. 같은 무효화를 `onSuccess`·`onError`에 두 번 쓰지 않고, 방금 set한 키를 다시 invalidate하지 않는다.
3. 다른 기능에 미치는 효과는 쿼리 옵션의 `meta.refreshOn*`(`refreshOnPremiumChange`)나 그 기능이 내보낸 helper로만 한다. 남의 `all`을 무효화하지 않는다. 바뀐 것만 무효화하고, 범위를 모를 때(반복 묶음, 카테고리 삭제, 언어 변경)만 넓게 쓴다.
4. 당겨서 새로고침은 기능마다 `refresh{Feature}(queryClient)` 하나이고 활성 쿼리만 다시 받는다. 표시는 `useRefresh`가 당긴 동안만 한다.
5. 영속 쿼리는 옵션에 `PERSISTED_QUERY_OPTIONS`(`meta.persist: true`)를 펼치고, 복원 때 검증할 모델 스키마는 `bootstrap/query/persisted-query-schemas.ts` 표에 키와 함께 한 줄 둔다. 복원 시점에는 쿼리 옵션이 없고 Zod 스키마는 직렬화되지 않아 키 → 스키마 표가 한 곳 필요하다. 두 곳이 어긋나지 않는 것은 `persisted-query-schemas.test.ts`가 지킨다. 영속 키 값을 바꾸면 `QUERY_CACHE_SCHEMA_VERSION`을 올린다. 저장은 조회 캐시 이벤트마다 영속 조회 전체를 직렬화해 쓰므로 5초에 한 번으로 미루고(`QUERY_CACHE_PERSIST_THROTTLE_MS`. 3초 폴링 1분 동안 기본 1초면 40번, 5초면 12번 쓴다) 앱이 뒤로 갈 때 미룬 저장을 바로 쓴다(`flush`).
6. 마지막 변경 판정은 `shared/query/is-last-mutation.ts`의 `isLastMutation(queryClient, mutationKey)` 하나다. mutation 콜백 안에서 불러 자기 자신까지 센다. 누른 동작 앞에서 조회 값을 막지 않고 읽을 때(AI 동의 확인, 마케팅 푸시 제안)는 `shared/query/read-without-blocking.ts`의 `readWithoutBlocking(cached, fetch, onFailure)` 하나다: 캐시 → 오프라인이면 null → 3초 제한.
7. 변경이 다른 기능의 값에 닿으면 그 helper로 맞춘다. 콕 보내기 → 할 일 상세 `permissions.canNudge`, 계정 연결·해제 → `me`, 카테고리 수정 → `TODO.pages()`.

## Mutation 옵션

```ts
// features/planning/category/queries/todo-category.mutations.ts
export function useUpdateTodoCategoryMutationOptions() {
  const todoCategoryApi = useTodoCategoryApi();
  const queryClient = useQueryClient();
  return mutationOptions({
    networkMode: 'always',
    mutationKey: TODO_CATEGORY_MUTATION_KEYS.writes(),
    mutationFn: async ({ id, input }: UpdateTodoCategoryVariables) =>
      unwrap(await todoCategoryApi.updateCategory(id, input)),
    onMutate: async ({ id, input }) => {
      /* 다른 변경과 겹쳐 시작했는지 세고, 이 카테고리의 이름·색만 낙관적으로 바꾸고 이전 값을 돌려준다 */
    },
    onSuccess: (saved, _variables, { startedWithOthers }) => {
      // 마지막 변경이면 응답의 이름·색을 쓰고, 겹쳤으면 응답 대신 다시 받는다
      settleTodoCategoryChange(queryClient, { saved, startedWithOthers });
    },
    onError: (_error, { id }, context) => {
      /* 이 카테고리의 이름·색만 되돌린다 */
    },
    meta: { errorFeedback: { feature: 'todo', fallbackKey: 'todo:toast.updateFailedRetry' } },
  });
}
```

- `use{Verb}{X}MutationOptions()`가 `mutationOptions`를 돌려주고 화면은 `useMutation`을 직접 부른다. 변수 타입에 이름을 붙이면 `*Variables`다. 성공 뒤 이동은 호출부가, 오류 코드별 안내에 딸린 이동은 기능 `onError`가 한다([오류 처리](../error-handling.md#mutation-오류-피드백)).
- `mutationFn`은 Api 결과를 반드시 `unwrap`한다. `fail` 결과를 그대로 돌려주면 React Query가 성공으로 본다.
- 오류 피드백은 mutation마다 둔 `meta.errorFeedback` 하나다(`aido/mutation-error-feedback`, 펼친 옵션은 이어받는다). 값마다 전역이 하는 일, `isHandledByFeature`·`false`를 쓰는 곳, 기능 `onError`가 맡는 것은 [error-handling](../error-handling.md#mutation-오류-피드백)이 원본이다.
- 서버가 확정한 결과는 mutation `onSuccess`·`onError`에서 추적하고 온 UI는 변수 `source`로 받는다. Api·Service·Repository·Store·mapper·모델·cache는 추적하지 않는다([observability](../observability.md)).
- 무효화는 늘 `onSettled`에 두고, 기다릴지는 반환으로 정한다. 저장 뒤 바로 떠나는 변경은 Promise를 돌려주지 않는다(돌려주면 `mutateAsync`가 재조회까지 기다린다). 결과가 화면에 남는 행 버튼(친구 수락·거절)은 무효화 Promise를 돌려줘 `isPending`이 행이 사라질 때까지 이어진다.
- 멈췄다가 나중에 실행되면 안 되는 쓰기와 그 쓰기 앞에서 기다리는 조회(`queryClient.query`)는 `networkMode: 'always'`에 이유 주석을 단다. 기본 `'online'`이면 오프라인에서 실패하지 않고 멈췄다가 연결되면 사용자 모르게 실행된다. 같은 조회가 이미 진행 중이거나 멈춰 있으면 `networkMode`·`retry`는 듣지 않고 그 조회에 합류하므로, 기다리기 전에 오프라인이면 끝내고(`onlineManager.isOnline()`) 기다림에는 제한 시간(es-toolkit `withTimeout`)을 둔다(알림 [완료]). 훅 밖 조회는 `queryClient.query`(`ensure`는 `staleTime: 'static'`)이고 `fetchQuery`·`ensureQueryData`·`prefetchQuery`는 쓰지 않는다(5.108에서 deprecated).

**낙관적 갱신.** 여러 화면이 같은 값을 보이면 캐시로, 그 버튼 하나만 보이면 `useMutation`의 `variables`로 그린다. 되돌릴 수 없는 삭제는 미리 빼지 않는다. 같은 캐시의 변경은 함께 진행된다고 보고 이 순서를 지킨다.

1. `mutationKey: {FEATURE}_MUTATION_KEYS.writes()`로 같은 캐시를 쓰는 변경을 한 묶음으로 센다. `scope`는 서버에 닿는 순서가 중요한 연타(댓글 하트)에만 둔다.
2. `onMutate`: 덮어쓸 키만 `cancelQueries`(단건은 `exact: true`) → 바꿀 엔티티·칸만 읽어 둔다 → `setQueryData(key, (old) => old && withX(old, …))`. updater는 `-cache.ts`의 순수 함수다.
3. `onError`: 읽어 둔 값으로 같은 updater를 지금 캐시에 다시 적용한다. 스냅숏으로 통째로 덮으면 함께 진행 중인 변경이 지워진다.
4. `onSuccess`: 응답이 확정한 칸은 `isLastMutation`일 때만 쓴다. 응답이 오는 순서는 서버가 처리한 순서와 다를 수 있어, 앞서 끝난 변경은 낡음만 표시하고(`refetchType: 'none'`) 마지막 변경이 겹쳤으면(시작할 때 다른 변경이 있었거나 낡음 표시가 남음) 다시 받는다. 조회 하나를 고치는 쓰기는 `shared/query/settle-overlapping-write.ts`의 `settleOverlappingWrite`(설정·프로필·동의), 목록 항목을 고치는 쓰기는 기능 helper다(`settleTodoCategoryChange`·`settleMemoWrite`). 만들기는 임시 id를 서버 행으로 바꾼다. 지운 엔티티의 상세는 `removeQueries({ type: 'inactive' })`로 버린다. 보고 있는 상세는 버리면 다시 받다 경계로 내려가므로 화면을 떠날 때까지 둔다.
5. `onSettled`: 실패했거나 응답이 바뀐 값을 다 담지 못하면 마지막 변경일 때만 다시 받는다. 응답이 필요한 정리(`settleTodoEdit`)도 여기서 `data`로 한다.

- 할 일 목록은 `features/planning/todo/queries/todo-cache.ts`의 `beginTodoWrite`·`updateCachedTodo`·`settleTodoWrite`로만 고친다. 쓰기 묶음(`TODO_MUTATION_KEYS.listWrites()`) 밖에서 여러 할 일을 만들거나 옮긴 쓰기(음성·메모 변환·제안 수락·날씨 옮기기)는 `settleTodoBatchWrite`로 맞춰, 진행 중인 체크가 있으면 낡음만 표시하고 그 체크의 마지막 쓰기가 다시 받는다. 날짜는 할 일의 시작일이 아니라 보고 있는 목록의 날짜다. 임시 id는 음수(`createOptimisticId`)이고 `isOptimistic*` Policy로 막는다. 임시 행의 버튼·끌기는 끄고 route는 양수 id만 받는다.

## 메모리와 수명

| 지점                  | 규칙                                                                                                                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 구독                  | `subscribe`·`add…Listener`는 해제 함수(`.remove()`)를 돌려주고 연결한 effect의 정리에서 부른다. 외부 값은 `useSyncExternalStore`가 먼저다                                                                            |
| 타이머                | `setTimeout`·`setInterval`·`requestAnimationFrame`은 effect에서 걸고 정리에서 지운다. 핸들러에서 건 타이머는 ref에 두고 다시 걸 때와 언마운트 때 지운다. es-toolkit `debounce`는 `cancel`까지 부른다                 |
| await 뒤              | 상태 변경·이동·기록은 effect의 `AbortController`·`isCurrent` 플래그(로그아웃은 `SessionEpoch` 비교)로, 핸들러에서 시작했으면 언마운트 ref로 막는다. 언마운트·로그아웃 뒤 `setState`·`router`·저장·추적을 하지 않는다 |
| 최신 콜백             | effect 안에서는 `useEffectEvent`로 읽는다. deps에 넣어 타이머·구독을 다시 걸지 않는다                                                                                                                                |
| 모듈 전역             | 상한이나 지우는 시점 없는 Map·Set·캐시를 두지 않는다. 앱 수명 구독은 첫 구독자에 열고 마지막 구독자가 나가면 닫는다                                                                                                  |
| 기다리지 않는 Promise | `void` 연산자를 쓰지 않는다. 실패는 안에서 처리하거나 `.catch`로 기록하고, `.catch(noop)`은 이미 다른 곳에 보고될 때만 쓴다                                                                                          |
| Query                 | 서버 GET은 `signal`로 화면을 떠나면 멈추고, 안 쓰는 쿼리는 `gcTime`이 정리한다. 기기에 남기는 것은 `meta.persist`를 단 쿼리뿐이다                                                                                    |
