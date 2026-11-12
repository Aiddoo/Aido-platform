# Todo 댓글 구현 규칙

> 할 일 상세 한 화면에서 댓글과 답글(2단계)을 읽고 쓰는 규칙이다. 공통 레이어와 UI 규칙은
> [architecture](./architecture/structure.md), [ui](./architecture/ui.md), [testing](./testing.md)를 우선한다.

## 목표와 경계

인스타그램처럼 할 일 본문 아래에서 댓글을 훑고, 답글은 그 자리에서 펼치고, 답글 달기·수정은 화면 이동 없이
키보드 위 작성 바에서 끝낸다.

- 단계는 **댓글 → 답글** 두 개뿐이다. 답글에 답하면 같은 묶음 끝에 붙고 본문 앞에 `@이름`이 붙는다.
  들여쓰기는 최대 1단계라 답글 본문 폭이 모두 같다.
- 화면은 `/todo/[todoId]` 하나다. 알림·링크로 여는 댓글 위치는 `?comment=<id>`다. 신고 시트는 `comments/[commentId]/report`다.
- 모바일은 묶음·답글 수·대표 답글·참여자·권한·`@멘션` 이름을 다시 계산하지 않는다. 서버 read model(v2)을 그린다.
  클라이언트가 정하는 것은 렌더 순서에 따른 연결선의 마지막 행뿐이다.
- 할 일 본문은 `TodoDetailSummary`가 소유한다. 각 feature 컴포넌트는 바깥 여백이나 화면 순서를 모른다.

## 상태와 소유자

| 구분      | 무엇                                                 | 어디서                                                                                                        |
| --------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 서버 상태 | 묶음 페이지, 묶음별 답글 페이지, 할 일 상세          | TanStack Query 무한 쿼리 2종 + 상세 쿼리                                                                      |
| URL 상태  | 정렬 `sort`, 알림·링크로 연 위치 `comment`           | `todoCommentParamsSchema` 읽기 훅 `useTodoCommentParams`와 세터 `useTodoCommentSort`(`comment`를 함께 지운다) |
| 작성기    | 모드(`new`·`reply`·`edit`)와 대상, 이어 쓰기 입력값  | `TodoCommentSession`이 가진 `useForm` 하나. 하위는 `useWatch`·`useFormState`                                  |
| 펼친 묶음 | 묶음별 펼침 여부                                     | `TodoCommentExpansionProvider`(게시하면 작성 바가 그 묶음을 펼친다)                                           |
| 클라 계산 | 상대 시간, 좋아요 ±1, 더블탭 애니메이션, 키보드 위치 | `useMinuteNow`, `TodoCommentPolicy`, Reanimated shared value                                                  |

전체 화면과 펼친 피드 칸은 같은 조각을 각자 route에 나열한다. 화면 URL은 `/todo/42?sort=LATEST&comment=cm_1`,
pane은 `/feed?todoId=42&comment=cm_1`이다. 바꿀 때는 search만 바꾸고, 원시 `setParams` 대신 이름 있는 세터를 쓴다([params 튜플](./architecture/state-and-routing.md#params-튜플)).

## 서버 계약 (`@aido/api`)

- 읽기(v2)
  - `GET /v2/todos/:todoId/comments?sort&cursor&size(30)&anchorCommentId` → `{ items: TodoCommentThread[], pagination, anchor }`
  - `GET /v2/todos/:todoId/comments/:commentId/replies?cursor&size(10)&aroundReplyId` → `{ items, pagination }`
  - cursor는 방향을 담고 있다. `nextCursor`·`previousCursor`를 그대로 보낸다. 첫 페이지만 `anchorCommentId`·`aroundReplyId`를 쓴다.
- 쓰기(v1): `POST comments`(`parentId` = 답할 글, 서버가 묶음 머리로 다시 정함),
  `PATCH`/`DELETE comments/:id`, `PUT`/`DELETE .../likes`. 응답은 v1 모양이라 mapper가 `parentId`를 `threadCommentId`로 읽는다.
- `viewer.isLiked`만 좋아요 여부다. `author.userTag`는 `string | null`이다.

## 모델과 Policy

`domains/todo-comment.model.ts`가 앱 모델과 규칙을 소유하고, `apis/todo-comment.mapper.ts`가 계약 DTO를 모델로 바꾼다.

- zod: 모델 스키마는 `domains/`에서 앱 모양으로 직접 정의하고 시각은 `Instant`다. `schemas/`는 폼·params·초안·요청 모양만 둔다.
  `@aido/api` 루트는 `apis/`와 `schemas/`만 import한다(dependency-cruiser가 검사).
- 이름 있는 순수 함수와 `TodoCommentPolicy` Facade(키 = 함수 이름)
  - 표시: `getDisplayState(active | deleted | blockedAuthor)`, `isReply`
  - 권한: `canLikeComment`, `canReplyToComment`, `canEditComment`, `canDeleteComment`, `canDeleteOnlyAsTodoOwner`,
    `canCopyComment`, `canReportComment`, `canBlockCommentAuthor`, `hasCommentActions`, `isTombstonedOnDelete`
  - 묶음: `getHiddenReplyCount`, `hasRepliesToShow`, `flattenThreads`, `flattenReplies`, `findCommentInThread`
  - 캐시 변환: `withLiked`, `withLikeResult`, `withContentEdited`, `withReplyAdded`, `withCommentRemoved`, `withRepliesRemoved`
- 화면 상태인 답글 아래 줄(`getReplyFooter`)과 펼침(`expandThread`)은 `utils/todo-comment-replies.view-model.ts`에 둔다.
- 화면 분기는 `getDisplayState`·`getReplyFooter`를 ts-pattern으로만 나눈다. 개수와 숨김을 화면에서 다시 세지 않는다.

`domains/todo-comment-composer.model.ts`(`TodoCommentComposerPolicy`)는 작성 규칙만 맡는다. 이어 쓰기, 뒤로가기 판단,
바뀐 글 판정(`isSameAsOriginal`, 같으면 PATCH하지 않는다), 제출 준비(멱등 키 재사용)가 있다. 모드 union·폼 스키마·폼 값은
`schemas/todo-comment-form.schema.ts`, 초안 키와 원본 시각은 `utils/todo-comment-draft.ts`에 있다.

## 화면 조립

```tsx
// app/(app)/todo/[todoId]/index.tsx. 펼친 피드 칸은 `(tabs)/feed/index.tsx`가 같은 조각을 나열한다
<StyledSafeAreaView className="flex-1 bg-white" edges={['left', 'right']} testID="todo-detail">
  <TodoCommentSession>
    <TodoCommentTitleBar.StackHeader />

    <TodoAvailabilityGuard fallback={<TodoDetailSummary.Unavailable onClose={router.back} />}>
      <TodoCommentKeyboardGesture>
        <QueryErrorBoundary
          resetKeys={[todoId, sort, comment]}
          fallback={TodoCommentThreadList.Error}
        >
          <Suspense fallback={<TodoCommentThreadList.Loading />}>
            <TodoCommentThreadList />
          </Suspense>
        </QueryErrorBoundary>

        <QueryErrorBoundary resetKeys={[todoId]}>
          <TodoCommentComposerBar />
        </QueryErrorBoundary>
      </TodoCommentKeyboardGesture>
    </TodoAvailabilityGuard>
  </TodoCommentSession>
</StyledSafeAreaView>
```

- 화면은 `todoId`를 props로 넘기지 않는다. 블록 컴포넌트가 `const [todoId] = useTodoId()`로 읽고, 가상 목록의 댓글·답글 행은 route 훅을 부르지 않고 댓글 모델의 `todoId`를 읽는다(Oxlint `aido/no-route-id-props`가 검사).
- 스크롤은 `TodoCommentThreadList`의 `FlashList` 하나다. `renderScrollComponent`로 `KeyboardChatScrollView`를 쓰고,
  할 일 본문·정렬(`TodoCommentThreadList.Header`·`.SortBar`)·더블탭 안내·이전 댓글 보기는 `ListHeaderComponent`다. 묶음 행만 가상화하고 답글은 그 행 안에 그린다.
- 할 일을 볼 수 없으면(`TodoAvailabilityGuard`, 404) 본문·댓글 대신 `TodoDetailSummary.Unavailable` 하나만 보인다.
- `TodoDetailSummary`는 `Owner`(친구 할 일만) → `Task`(체크와 제목 t3) → `Schedule`(시간·반복·카테고리·날짜) → `SubTodos` → `Metrics`(조회수는 여기 한 곳) 순서다. 구분선은 카드와 댓글 사이 하나, 댓글 수와 정렬은 한 줄이다.
- 체크는 내 할 일(`permissions.canEdit`)만 기존 토글 mutation으로 눌리고 친구 할 일은 읽기 전용이다. 상세는 피드 날짜를 몰라 `TodoPolicy.getOptimisticListDate`로 고칠 목록을 고른다.
- 상세 응답에는 반복 규칙이 없다. 내 반복 할 일은 시작일 목록에서 규칙을 읽어 요약하고, 친구 할 일과 받기 전에는 "반복"만 보인다.

## 묶음과 답글

- `ThreadRow` = 댓글 행 + `TodoCommentReplies`.
- 접힘: 서버의 대표 답글 1개와 "답글 N개 더 보기"(대표 답글이 없으면 "답글 N개 보기").
- 펼침: 답글 첫 페이지(10개)를 그 자리에 붙이고, 아래 줄은 `getReplyFooter`가 정한다.
  - 다음 페이지에 남은 답글이 있으면 "답글 N개 더 보기"(`viewMore`)
  - 사용자가 펼쳤고(`source: 'user'`) 2개 이상 불러왔으면 "답글 숨기기"(`hide`)
  - 답글을 올려 앱이 펼쳤거나(`source: 'auto'`) 답글이 하나뿐이면 줄 없음(`none`). 이때 마지막 답글이 `isLast`라 선이 닫힌다.
- 펼침 상태는 화면의 `TodoCommentExpansionProvider`가 `Map<threadCommentId, ThreadExpansion>`으로 든다. 사용자가 누르면
  `source: 'user'`, 작성 바가 답글을 올리면 `expandThread(current, 'auto')`로 저장해 사용자가 직접 연
  묶음은 그대로 둔다. 알림으로 연 답글 묶음은 사용자가 고른 것이라 `user`로 시작한다.
  로딩 중에는 같은 높이의 답글 skeleton 1행을 둔다. 위 행은 움직이지 않는다.
- 개수는 `formatCompactCount`로 줄여 쓴다("답글 1.2천개 보기"). 좋아요는 `IconCountButton countDisplay="compact"`라
  숫자가 바뀌어도 옆 "답글 달기"가 움직이지 않는다.

### 연결선 (`TodoCommentRailRow`)

- 기하는 글자 크기와 무관한 아바타 열(댓글 36, 답글 28)과 고정 여백에만 맞춘다. 텍스트 길이로 계산하지 않는다.
- 댓글 행: 아바타 아래(top = 14 + 36 + 4)부터 행 bottom까지 세로선.
- 답글·토글 행: 위에서 아바타 중심 높이까지 곡선, 마지막이 아니면 행 top~bottom 세로선. 마지막 행은 렌더 순서로 정한다.
- 세로선은 absolute top/bottom이라 여러 줄 본문, xlarge 이름 줄, 묘비 행에서도 끊기지 않는다. `start`/`end`로 그려 RTL에서도 같은 쪽이다.

### 행 (`TodoCommentItem`)

- 이름 줄 잘림 순서: 이름(4글자 이상이면 최소 4글자 폭은 남김) → `#태그`. 작성자 배지·시간·`⋯`는 줄지 않는다.
  `xlarge`에서는 태그·시간을 둘째 줄로 내리고 `⋯`는 첫 줄 끝에 둔다. 시간은 `useMinuteNow` 기준이라 렌더 중 `new Date()`를 쓰지 않는다.
- 본문: `@멘션`을 중첩 Text로 한 문단에 그린다. `replyTo.authorName`이 null이면(탈퇴·차단) 멘션 없이 본문만.
- 묘비(`deleted`)·차단(`blockedAuthor`): 흐린 아바타 + 안내 문구. 좋아요·답글·`⋯` 없음.
- `⋯`와 길게 누르기: 같은 heroui-native `Menu`에 `MenuActionItem`을 넣는다. 내 글은 수정·복사 / 삭제, 남의 글은 복사 / 신고·차단,
  내 할 일의 남의 글은 삭제도 보인다. 삭제는 항상 `useConfirmDialog`로 확인하고, 답글이 남는 댓글이면 묘비로 남는다고 안내한다.
  복사는 DI `useClipboard()` 게이트웨이를 쓴다.

### 더블탭 하트

- RNGH v3 `useTapGesture({ numberOfTaps: 2 })`와 `useLongPressGesture`를 `useExclusiveGestures`로 묶는다(`useCommentBodyGesture`).
  한 번 탭은 아무 동작도 하지 않는다.
- 애니메이션(`todo-comment-heart-burst.tsx` 상단 상수): 큰 하트 스프링 1.32 → 0.9 → 1 + 회전 −14°→6°→0°, 링 0.3→1.7,
  45° 간격 작은 하트 8개, 버튼 하트 0.6→1.35→1, 740ms부터 위로 26px 사라짐. 모두 shared value로 UI 스레드에서 돌고
  JS로는 좋아요 요청과 진동(`haptics.impact('light')`)만 넘긴다. 동작 줄이기면 큰 하트만 나타났다 사라진다.
- 이미 좋아요면 애니메이션만 나오고 요청은 보내지 않는다.
- 안내 줄: 첫 묶음 위 "댓글을 두 번 탭하면 하트를 남길 수 있어요 🐾". 처음 더블탭하거나 닫으면 계정당 다시 보이지 않는다
  (`useMyPendingCoachmark('comment-double-tap')`, 기록은 `coachmarkCompletedAtStoredValue`).

## 작성 바와 키보드

- `TodoCommentComposerBar`는 목록 아래 한 번 놓인다. `KeyboardStickyView`로 키보드를 따라가고, 아래 여백은
  `useKeyboardHandler` worklet의 진행률로 바뀌어 JS 리렌더 없이 60fps로 붙는다(`KeyboardAdaptiveButton`과 같은 방식).
- 키보드가 열린 채 작성기가 커지면 그 차이만큼 `extraContentPadding`으로 목록 끝을 올린다.
- 답글 달기·수정: 폼을 `toReplyFormValues`·`toEditFormValues`로 reset하고 입력창에 focus한다. 키보드가 다 올라오면
  `TodoCommentRevealProvider`가 대상 행과 작성 바의 화면 위치를 재서 겹친 만큼만 목록을 올린다.
- 새 댓글과 수정은 `networkMode: 'always'`다. 오프라인이면 멈추지 않고 실패해 입력값을 남기고 연결 뒤 몰래 보내지 않는다.
- 게시: 답글이면 그 묶음 답글 끝과 묶음 수에 붙이고 묶음을 펼친다. 새 댓글은 정렬 자리를 서버가 정하므로 묶음 목록만 다시 받는다.
  낙관적 행은 넣지 않는다. 같은 글을 다시 보내면 처음 멱등 키를 다시 쓴다.
- 초안: 모드별 MMKV 초안(`todo-comment-draft.ts`). 수정 초안은 서버 수정 시각보다 오래되면 버린다.
- 뒤로가기: 보내는 중이면 막고, 작성기(`reply`·`edit`)가 열려 있으면 키보드와 작성기를 함께 닫고, 아니면 native pop.
  Header back과 Android 뒤로 가기(`useAndroidBackHandler`, 화면 포커스 동안만)가 같은 `useTodoCommentBack`을 쓴다.
  iOS swipe는 결과가 native pop일 때만 켠다. pane은 더 닫을 게 없으면 선택을 푼다.

## Query, mutation, cache

- 키(`queries/todo-comment-query-keys.ts`): `all → todo(todoId) → threadLists → threads(sort, anchorCommentId)`, `… → replyLists → threadReplies(commentId) → replies(aroundReplyId)`.
- 무효화·갱신은 `queries/todo-comment-cache.ts`만 거친다. 페이지 변환은 `utils/todo-comment-cache-pages.ts` 순수 함수다.
- 좋아요: `scope: todo-comment-like:<id>`로 같은 댓글 연타를 직렬화, `cancelQueries(todo)` → 묶음·답글 캐시 ±1.
  응답은 댓글마다 센 `likeComment` 키의 마지막만 서버 값으로 쓰고, 실패하면 마지막 하트만 되돌린 뒤 목록을 다시 받는다.
  앞 응답을 쓰면 뒤에 누른 하트가 깜빡인다.
- 삭제: 낙관적으로 빼고(답글이 남은 댓글은 묘비, 마지막 답글을 잃은 묘비 묶음은 제거) 실패하면 그 댓글만 지운 자리에 되돌린다(`restoreTodoCommentToCaches`). 마지막 지우기가 끝나면 할 일 댓글 수만 다시 받는다.
- 수정: 낙관적 본문 교체 후 마지막 수정만 글 칸(`content`·`isEdited`·`editedAt`)을 서버 값으로 확정, 실패하면 글 칸만 되돌린다.
- 캐시를 통째로 스냅샷해 되돌리지 않는다. 함께 누른 다른 하트·지운 댓글이 사라진다([낙관적 갱신](./architecture/data.md)).
- 오류: 각 mutation의 `onError`는 롤백만 한다(`TODO_0833`·`TODO_0831` "이미 삭제된 댓글"이면 그 행을 캐시에서 빼 서버 상태에 맞춘다). 안내는 429를 포함해 모두 `meta.errorFeedback` 전역 피드백이 햅틱·토스트·Sentry를 한 번 처리한다([오류 처리](./error-handling.md#mutation-오류-피드백)).
- 알림으로 연 위치: `comment`가 있으면 anchor 페이지를 받아 그 묶음으로 옮기고(답글이면 펼쳐서) 1.6초 강조한다.
  `anchor: null`이면 "찾는 댓글이 삭제됐거나…" 토스트 후 목록 맨 위.

## 분석

`constants/todo-comment.events.ts`의 `AppEventMap`만 쓴다. 이벤트와 매개변수는 [측정 계획](./analytics-measurement-plan.md#1-2-이벤트-기능별)에 있다.

## 파일

```
features/engagement/comment/
  domains/ todo-comment.model.ts  todo-comment-composer.model.ts  todo-comment.error.ts
  apis/ todo-comment.api.ts  todo-comment.mapper.ts
  constants/ todo-comment.constants.ts  todo-comment-log-events.ts  todo-comment.events.ts
  queries/ todo-comment-query-keys.ts  todo-comment-mutation-keys.ts  todo-comment.queries.ts  todo-comment.mutations.ts  todo-comment-cache.ts
  hooks/ use-todo-comment-params.ts(+ useTodoCommentSort)  use-todo-comment-back.ts  use-android-todo-comment-back-handler.ts
         use-is-todo-comment-submitting.ts  use-todo-comment-form.tsx
  components/ todo-comment-thread-list.tsx  todo-comment-replies.tsx  todo-comment-item.tsx  todo-comment-thread-rail.tsx  todo-comment-heart-burst.tsx
              todo-comment-reveal.tsx  todo-comment-expansion.tsx  todo-comment-composer/{todo-comment-composer-bar,todo-comment-form}.tsx
              todo-comment-title-bar.tsx  todo-comment-author-avatar.tsx  todo-comment-keyboard-scroll-view.tsx
              todo-comment-session.tsx  todo-comment-keyboard-gesture.tsx  todo-detail-summary.tsx
              comment-report-bottom-sheet.tsx
  utils/ todo-comment-cache-pages.ts  todo-comment-page-params.ts  todo-comment-draft.ts  todo-comment-replies.view-model.ts
         todo-comment-form-fields.ts  todo-comment-form-layout.ts  get-todo-comment-back-action.ts
  schemas/ todo-comment-form.schema.ts  todo-comment-draft.schema.ts  todo-comment-params.schema.ts  todo-comment-request.schema.ts
```

## 검증

- 단위: model/Policy, composer, 비자명한 mapper, cache pages, page params, route/back, draft(위치는 Oxlint `aido/todo-comment-test-location`이 검사).
- native: iOS·Android에서 목록, 펼치기·더 보기·숨기기, 답글 달기(키보드 위 대상 행), 게시 후 위치, 수정·삭제·신고·차단,
  묘비·긴 이름·큰 숫자, 더블탭(동작 줄이기·연타·이미 좋아요), 알림 위치(`?comment=`), pane, 라이트·다크, 글자 크기 xsmall~xlarge, ko·en.
