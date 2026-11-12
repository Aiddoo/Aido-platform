# 데이터

서버·OS·기기 저장소와 값을 주고받는 층의 규칙이다. 층 표와 의존 방향은 [structure](./structure.md), 모델·Policy·mapper는 [model](./model.md), 상태 원천과 params는 [state-and-routing](./state-and-routing.md), 오류 분류는 [error-handling](../error-handling.md)이 원본이다. 아직 이 모양이 아닌 코드는 [migration-status](./migration-status.md)에 있다.

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
- 메서드는 `Promise<Result<T, ApiError>>`다. 4xx는 `Result.err`, 5xx·네트워크·파싱은 throw다. 분류는 `KyHttpClient` 한 곳이 한다([error-handling](../error-handling.md#분류는-kyhttpclient-한-곳)).
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

- Repository(`repositories/{name}.repository.ts`)는 저장 값 정의로 안 되는 것만 남는다. SecureStore 비동기(pending-revocation, push-registration), 파일(voice-recording), 접두사 열거·옛 키 정리와 이주(whats-new, coachmark, activation, voice-note-draft, draft), 옛 기기 기록 이주(marketing-push-prompt), 옛 저장 모양 읽기(store-review), Android 헤드리스 위젯(widget-navigation, android-widget-snapshot)이다.
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
- **React.** `useStoredValue(def, scope?)`는 `[value, setValue]` 튜플이다. 원문 문자열이 같으면 다시 파싱하지 않고 같은 참조를 준다. 핸들러·effect에서만 읽고 쓰는 값은 `useStoredValueStorage(def)`로 그 영역의 저장소를 꺼내 `readStoredValue`·`writeStoredValue`·`removeStoredValue`를 쓴다. Service와 헤드리스 실행은 생성자로 받은 저장 포트에 같은 정의를 쓴다. 도구는 `shared/storage/`이고 포트 `ObservableSyncStorage` 위에 있다. MMKV 훅(`useMMKVString`)을 직접 쓰지 않는다. 포트 하나로 저장소 세 곳(기기 MMKV·위젯 저장소·암호화 초안)을 같은 방식으로 다루고 정의가 zod로 값을 검증하기 때문이다. iOS App Group 주의는 [widgets](../widgets.md#플랫폼-선택)에 있다.
- 새 키는 `aido_{feature}_{name}_v{n}`이다. 계정 범위면 `:{accountId}`, 하위 값이면 `:{sub}`를 붙인다. 출시된 키는 이 모양이 아니어도 그대로 둔다(`aido_calendar_view_mode`). 키 문자열은 `*-storage.schema.ts`와 남은 repository 밖에 쓰지 않는다(lint). 있는 키는 출시 앱이 읽는 외부 계약이다. 키나 모양을 바꾸면 옛 값을 시작할 때 한 번 옮기고(`migrate`, 이주 repository) 옛 키를 읽는 코드는 다음 minor 버전에서 지운다([compatibility](../../../../docs/conventions/compatibility.md)).
- 같은 값을 Query 캐시나 `useState`에 복사해 따라가게 하지 않는다. 화면에 들어온 순간의 값으로 고정해야 할 때만(발자국 축하) `useState(() => readStoredValue(…))`로 한 번 읽는다. 다시 보일 때를 정하는 기간 규칙은 Policy `shouldShow*(record, now)`이고 안내 노출 표는 [design](../design.md)에 있다.

## 흐름: mapper → 캐시 → select → view-model

| 하는 일                             | 둘 곳                | 이유                                                                      |
| ----------------------------------- | -------------------- | ------------------------------------------------------------------------- |
| DTO·OS 값 → 모델                    | mapper(`queryFn` 안) | 요청당 한 번 돌고 결과가 캐시된다. 서버가 바뀌면 여기만 고친다            |
| 거르기·정렬·개수·묶기·평탄화·고르기 | Query `select`       | 데이터나 `select`가 바뀔 때만 돈다. 고른 조각이 같으면 다시 그리지 않는다 |
| 라벨 키·문자열·색 토큰              | view-model           | 렌더 중 싼 순수 계산이다                                                  |
| 업무 판정                           | Policy               | 테스트 단위다                                                             |

- 목록 옵션은 `useGet{X}QueryOptions({ filters, orderBy, limit })`이고 모델이 `Filter{X}`·`OrderBy{X}` 타입을 둔다. 클라이언트 필터는 키에 넣지 않고 `select`로 같은 캐시를 나눠 쓴다. 서버 파라미터만 키에 넣는다.
- 옵션 훅 안의 인라인 `select`는 React Compiler가 메모한다. `select`로 오류를 던지거나 DTO를 바꾸지 않는다.
- 무한 목록 도구는 `shared/domains/cursor-page.model.ts` 하나다: `cursorPageSchema(item, cursor)`(`{ items, nextCursor }`), `getNextCursor(page)`(`getNextPageParam`), `selectPageItems(data)`(`select`), `mapInfiniteItems(data, fn)`(캐시 패치).
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
- 루트는 기능 이름 하나다(`['notification']`). 한 루트가 다른 기능 루트의 접두사가 되지 않는다(`bootstrap/query/query-key-roots.test.ts`). mutation 키 루트는 `[feature, 'mutation']`이다.
- 모든 잎은 `queryOptions<T>({ queryKey }).queryKey`로 데이터 타입을 붙여 `getQueryData`·`setQueryData`가 제네릭 없이 타입을 안다. 인자는 이름 있는 객체 하나이고 잎은 루트와 같지 않다. 그룹(`lists()`)은 무효화에 쓸 때만 만든다.
- 기기 OS 상태(푸시 권한, 위치) 쿼리는 `['device', …]` 루트에 둔다. 기능 무효화에 휩쓸려 OS를 다시 묻지 않는다.
- 키를 컴포넌트에서 만들거나 하드코딩하지 않는다. 키 자리에 기대는 구조 분해(`const [, , params] = queryKey`)를 쓰지 않는다.
- 조회 옵션은 `useGet{X}QueryOptions`·`useGet{X}InfiniteQueryOptions` 훅이고 `queryFn`은 `unwrap(await api.getX(…, signal))`이다. 화면은 `useSuspenseQuery(useGetXQueryOptions(…))`를 직접 부른다. 서로 독립인 조회는 `useSuspenseQueries`나 블록별 경계로 나눠 워터폴을 만들지 않는다.

## 무효화

1. `queryClient`는 `queries/{feature}-cache.ts`만 만진다(앱 조립 `bootstrap/**`과 공용 도구 `shared/query/**`는 예외, [guardrails](./guardrails.md)). 컴포넌트·훅·route는 helper(`invalidate{X}`, `set{X}InCache`)를 부른다.
2. mutation 옵션이 캐시 효과를 모두 갖는다. `onSuccess`는 응답을 캐시에 쓰고 무효화는 `onSettled`에 둔다. 같은 무효화를 `onSuccess`·`onError`에 두 번 쓰지 않고, 방금 set한 키를 다시 invalidate하지 않는다.
3. 다른 기능에 미치는 효과는 쿼리 옵션의 `meta.refreshOn*`(`refreshOnPremiumChange`)나 그 기능이 내보낸 helper로만 한다. 남의 `all`을 무효화하지 않는다. 바뀐 것만 무효화하고, 범위를 모를 때(반복 묶음, 카테고리 삭제, 언어 변경)만 넓게 쓴다.
4. 당겨서 새로고침은 기능마다 `refresh{Feature}(queryClient)` 하나이고 활성 쿼리만 다시 받는다. 표시는 `useRefresh`가 당긴 동안만 한다.
5. 영속 쿼리는 옵션에 `PERSISTED_QUERY_OPTIONS`(`meta.persist: true`)를 펼치고, 복원 때 검증할 모델 스키마는 `bootstrap/query/persisted-query-schemas.ts` 표에 키와 함께 한 줄 둔다. 복원 시점에는 쿼리 옵션이 없고 Zod 스키마는 직렬화되지 않아 키 → 스키마 표가 한 곳 필요하다. 두 곳이 어긋나지 않는 것은 `persisted-query-schemas.test.ts`가 지킨다. 영속 키 값을 바꾸면 `QUERY_CACHE_SCHEMA_VERSION`을 올린다.
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

- `use{Verb}{X}MutationOptions()`가 `mutationOptions`를 돌려주고 화면은 `useMutation`을 직접 부른다. 변수 타입에 이름을 붙이면 `*Variables`다. 화면 이동은 호출부가 한다.
- `mutationFn`은 Api 결과를 반드시 `unwrap`한다. `Result.err`를 그대로 돌려주면 React Query가 성공으로 본다.
- 오류 피드백은 mutation마다 둔 `meta.errorFeedback` 하나다(`aido/mutation-error-feedback`, 펼친 옵션은 이어받는다). 값마다 전역이 하는 일, `isHandledByFeature`·`false`를 쓰는 곳, 기능 `onError`가 맡는 것은 [error-handling](../error-handling.md#mutation-오류-피드백)이 원본이다.
- 서버가 확정한 결과는 mutation `onSuccess`·`onError`에서 추적하고 온 UI는 변수 `source`로 받는다. Api·Service·Repository·Store·mapper·모델·cache는 추적하지 않는다([observability](../observability.md)).
- 저장 뒤 바로 떠나는 변경은 `onSettled`에서 Promise를 돌려주지 않는다. 돌려주면 `mutateAsync`가 재조회까지 기다린다. 화면에 남는 행 버튼(친구 수락·거절)은 무효화를 기다려 행이 사라질 때까지 버튼을 끈다.
- 멈췄다가 나중에 실행되면 안 되는 쓰기는 `networkMode: 'always'`에 이유 주석을 단다.

**낙관적 갱신.** 여러 화면이 같은 값을 보이면 캐시로, 그 버튼 하나만 보이면 `useMutation`의 `variables`로 그린다. 되돌릴 수 없는 삭제는 미리 빼지 않는다. 같은 캐시의 변경은 함께 진행된다고 보고 이 순서를 지킨다.

1. `mutationKey: {FEATURE}_MUTATION_KEYS.writes()`로 같은 캐시를 쓰는 변경을 한 묶음으로 센다. `scope`는 서버에 닿는 순서가 중요한 연타(댓글 하트)에만 둔다.
2. `onMutate`: 덮어쓸 키만 `cancelQueries`(단건은 `exact: true`) → 바꿀 엔티티·칸만 읽어 둔다 → `setQueryData(key, (old) => old && withX(old, …))`. updater는 `-cache.ts`의 순수 함수다.
3. `onError`: 읽어 둔 값으로 같은 updater를 지금 캐시에 다시 적용한다. 스냅숏으로 통째로 덮으면 함께 진행 중인 변경이 지워진다.
4. `onSuccess`: 응답이 확정한 칸은 `isLastMutation`일 때만 쓴다. 응답이 오는 순서는 서버가 처리한 순서와 다를 수 있어, 앞서 끝난 변경은 낡음만 표시하고(`refetchType: 'none'`) 마지막 변경이 겹쳤으면(시작할 때 다른 변경이 있었거나 낡음 표시가 남음) 다시 받는다(`settleTodoCategoryChange`·`settleMemoWrite`). 만들기는 임시 id를 서버 행으로 바꾼다. 지운 엔티티의 상세는 `removeQueries({ type: 'inactive' })`로 버린다. 보고 있는 상세는 버리면 다시 받다 경계로 내려가므로 화면을 떠날 때까지 둔다.
5. `onSettled`: 실패했거나 응답이 바뀐 값을 다 담지 못하면 마지막 변경일 때만 다시 받는다. 응답이 필요한 정리(`settleTodoEdit`)도 여기서 `data`로 한다.

- 할 일 목록은 `features/planning/todo/queries/todo-cache.ts`의 `beginTodoWrite`·`updateCachedTodo`·`settleTodoWrite`로만 고친다. 날짜는 할 일의 시작일이 아니라 보고 있는 목록의 날짜다. 임시 id는 음수(`createOptimisticId`)이고 `isOptimistic*` Policy로 막는다. 임시 행의 버튼·끌기는 끄고 route는 양수 id만 받는다.

## 폼

```tsx
// 수정: 다시 받은 서버 값이 비교 기준이고 고치던 칸은 남는다. 생성은 values 대신 defaultValues다
const form = useForm({
  resolver: zodResolver(todoCategoryFormSchema),
  values: toTodoCategoryFormValues(category),
  resetOptions: SERVER_VALUES_RESET_OPTIONS,
  mode: 'onChange',
});
```

- `useForm`은 제네릭 없이 `zodResolver(schema)`에서 타입을 추론하고 이름은 `form`이다. 생성은 `defaultValues`, 서버 값을 고치는 수정 폼은 `values` + `resetOptions: SERVER_VALUES_RESET_OPTIONS`(`shared/constants`)로 다시 받은 값과 맞춘다(고치지 않은 칸은 새 값, 고치던 칸·`isDirty`·칸 오류는 그대로). RHF 7.91은 `keepDirtyValues`만 주면 마운트와 다시 받을 때마다 `isDirty`와 칸 오류를 지우므로 이 상수를 쓴다. `form.reset`도 `resetOptions`를 합치니 저장한 값으로 다시 시작할 때는 `form.reset(values, SAVED_VALUES_RESET_OPTIONS)`다. 코드로 바꾼 칸(칩·받아쓰기·초안)은 `setValue(…, { shouldDirty: true })`로 고친 칸이 되게 하고, 버튼·완료 키가 `isValid`를 보면 `shouldValidate: true`도 준다. `reset`을 부르는 effect를 쓰지 않는다. 처음 값은 스키마 `.default()`가 아니라 `defaultValues`에 두고 값 없는 칸은 `null`이다.
- 스키마는 `schemas/{name}-form.schema.ts` 하나다. 계약의 요청 스키마에서 `pick`·`omit`·`extend`로 유도하고 공백 정리는 `trimmed(contract.shape.title)`, 한도는 vocabulary다. 저장 가능 여부를 함수로 또 만들지 않는다.
- 변환은 mapper다. 폼 값 → 요청은 `to{X}Request(values)`, 모델 → 폼 값은 `to{X}FormValues(model)`다.
- 입력은 `Controller`·`useController`로 잇고 `field.ref`를 넘겨 검증 실패 칸에 포커스한다. 하위는 `useWatch`·`useFormState({ name })`로 자기 값만 구독한다. 렌더 중 `getValues()`는 React Compiler가 캐시해 갱신되지 않으므로 핸들러에서만 쓴다.
- 폼은 제출하는 컴포넌트가 소유하고 자식에 props `form`(읽기만 하면 `control`)으로 넘긴다. `FormProvider`·`useFormContext`는 쓰지 않는다. 공용 입력 부품은 `value`·`onChange`를 받는 제어 컴포넌트다(`todo-schedule-chips.tsx`).
  - 예외는 할 일 댓글 세션 하나다(`TodoCommentFormProvider`·`useTodoCommentForm`). 가상 목록 깊은 곳의 댓글·답글 행 메뉴, 작성 바, 뒤로 가기 확인이 화면 하나의 작성기를 함께 읽고 바꿔, props로 내리면 목록 여러 층을 거치는 드릴링이 된다. 세션(`todo-comment-session.tsx`)이 폼을 소유하고 이 Context로만 나눈다.
- 버튼은 `formState.isValid`·`isSubmitting`과 mutation `isPending`으로만 정한다. `safeParse`로 버튼 상태를 따로 계산하지 않는다. 단계 폼의 다음 버튼은 폼 전체가 아니라 그 단계 칸만 본다. `getFieldState(name, formState)`의 `isDirty && !invalid`로 정한다(`useFormState({ name })`로 구독). 단계 버튼이 바로 따르게 `mode: 'onChange'`로 검사하고, 오류 문구는 칸을 벗어난 뒤(`isTouched`)나 그 칸에 적은 뒤(`isDirty`)에만 보인다.
- 서버 4xx 중 칸에 속한 오류는 `form.setError`로 그 칸에 보인다. 코드와 칸의 매핑은 `domains/{feature}.error.ts`에 둔다. 실패해도 입력값을 지우지 않는다.
- 생성과 수정은 스키마와 입력 부품만 공유하고 제출은 각자 소유한다. 공통 부품에 `mode`·`onSubmit` 분기를 넘기지 않는다.
- 확인할 동작: 성공하면 닫힘·갱신·초안 삭제·이벤트 한 번, 4xx·연결 끊김이면 입력값·초안 유지와 안내 한 번, 두 번 눌러도 요청 한 번, 검증 실패나 바뀐 값 없음이면 요청 없음.
- **초안.** `useDraftStorage(draftKey)`가 첫 렌더에 동기로 읽어 생성 폼은 `defaultValues`에 넣고, 수정 폼은 그리기 전(`useLayoutEffect`) 고친 글자로 넣는다(`setValue(…, { shouldDirty: true })`, 메모 편집). 칸 목록(`useFieldArray`)은 그 훅의 `replace`로 넣는다. RN의 RHF는 칸 구독을 `useEffect`로 걸어 먼저 도는 effect의 `setValue`를 첫 마운트에 놓친다(댓글 작성기). `useFormDraftAutosave(form.subscribe, …)`가 렌더 없이 디바운스 저장하고, 언마운트 때 대기 저장을 flush하며, 제출 성공·취소 때 대기 저장까지 취소한 뒤 지운다.
- 초안 키는 `utils/{feature}-draft.ts`의 순수 함수가 `createDraftKey`로 만들고 사용자 id가 들어간다. 저장소는 암호화 MMKV이고 `DRAFT_TTL_MS`가 지난 초안과 원본보다 오래된 편집 초안은 버린다. 비밀번호·인증 코드는 초안으로 저장하지 않고, 긴 본문을 URL·Query 캐시에 넣지 않는다.

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
