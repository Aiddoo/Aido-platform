# Todo 댓글 구현 규칙

> 할 일 상세의 댓글 개요, 한 대화 보기, 키보드 위 작성 바가 같은 구조로 유지되도록 정한 기능별
> 규칙이다. 공통 레이어와 UI 규칙은 `architecture.md`, `ui-components.md`, `testing-guide.md`를
> 우선한다.

## 목표와 경계

댓글 화면은 Threads처럼 할 일 본문 아래에서 댓글을 훑고, 필요한 대화만 한 단계 들어가 답글을
작성하는 흐름이다. 댓글 깊이마다 새 화면을 쌓지 않는다.

- 모바일은 댓글 트리를 재귀 계산하지 않는다. 최상위 댓글 개요, 대표 답글, 답글 집계, 참여자,
  연결선은 서버 read model을 그대로 그린다.
- 화면은 `/todo/[todoId]` 하나만 사용한다. 현재 보기와 작성 의도는 URL search가 소유한다.
- 작성 UI는 BottomSheet가 아니다. `TodoCommentComposerBar`가 목록 아래에 한 번 놓이고 키보드 바로
  위를 따라간다.
- 할 일 본문은 기존 `TodoDetailCard`가 소유한다. 관계만 암시하는 `Original`, `OriginalPost` 같은
  모호한 컴포넌트를 새로 만들지 않는다.
- 페이지는 제목, 할 일 본문, 정렬, 댓글 목록, 작성 바를 위에서 아래로 조립한다. 각 feature
  컴포넌트는 바깥 padding이나 화면 순서를 모른다.

## 한 route와 URL 상태

`useTodoScreenParams`가 pathname의 `todoId`를 읽고, `useCommentRouteState`가 `sort`, `comment`,
`intent`를 검증해 판별 가능한 mode로 바꾼다.

| 화면 상태    | URL 예                                              | `CommentRouteMode` |
| ------------ | --------------------------------------------------- | ------------------ |
| 댓글 개요    | `/todo/42?sort=LATEST`                              | `overview`         |
| 새 댓글 작성 | `/todo/42?sort=LATEST&intent=create`                | `create`           |
| 한 대화 보기 | `/todo/42?sort=LATEST&comment=cm_123&intent=thread` | `thread`           |
| 답글 작성    | `/todo/42?sort=LATEST&comment=cm_123&intent=reply`  | `reply`            |
| 댓글 수정    | `/todo/42?sort=LATEST&comment=cm_123&intent=edit`   | `edit`             |

- 알림에서 쓰던 `comment` 단독 URL은 `thread`로 복구해 호환한다.
- `create`는 `comment` 없이만 유효하다. `thread`, `reply`, `edit`는 유효한 `comment`가 있어야
  한다.
- 잘못되거나 모호한 조합은 예외를 던지지 않고 `overview`로 복구한다.
- `showThread`, `startCreate`, `startReply`, `startEdit`, `closeComposer`, `clearThread`는 모두
  `router.setParams`를 사용한다. 댓글을 누를 때마다 history나 중첩 route를 늘리지 않는다.
- 화면 안에서 thread나 답글을 열 때는 `useCommentConversationNavigation`이 목표 댓글의 첫 page를
  `fetchInfiniteQuery({ pages: 1 })`로 확정한 뒤 URL을 바꾼다. 새 화면을 먼저 열고 뒤늦게 위치를
  찾지 않는다.
- 컴포넌트는 `todoId`, `commentId`, `parentId`, `threadId` 같은 화면 식별자를 props로 받지 않는다.
  검증된 route hook에서 직접 읽는다. 이미 조회한 목록 아이템은 props로 받을 수 있다.

### 뒤로가기 의미

URL mode를 닫는 의미는 Header back과 Android hardware back에서 같다.

- `reply`와 `edit`는 같은 `comment`의 `thread`로 돌아간다.
- `create`는 댓글 개요로 돌아간다.
- `thread`는 `comment`와 `intent`를 지우고 댓글 개요로 돌아간다.
- `overview`에서만 Expo Router의 native pop을 그대로 사용한다.

Header back과 Android hardware back은 키보드를 닫으면서 위 mode 전이를 한 번에 수행한다. 다음
우선순위로 한 단계씩 닫는다.

1. 전송 중이면 중복 전이나 draft 유실을 막기 위해 현재 상태를 유지한다.
2. `reply`, `edit`, `create`는 키보드와 현재 작성기를 같은 뒤로가기 이벤트에서 닫는다.
3. `thread`는 댓글 개요로 돌아간다.
4. 댓글 개요에서는 native pop을 사용한다.

공통 우선순위는 `getCommentScreenBackAction`이 순수 함수로 결정하고,
`useCommentScreenBackHandler`는 route 최상단에서 외부 시스템 구독과 cleanup만 소유한다. 목록이나
작성기의 Suspense·ErrorBoundary 상태와 무관하게 항상 mount하되, `useFocusEffect`로 현재 화면에
focus가 있을 때만 Android listener를 연결한다.
iOS native stack의 edge swipe는 댓글 개요에서만 활성화한다. 작성기나 thread에서 route 전체를 pop해
중간 URL mode를 건너뛰지 않도록 내부 mode의 뒤로가기는 화면 제목 바가 소유한다.

## 서버가 제공하는 두 read model

### 댓글 개요

`GET /v1/todos/:todoId/comments/overview`는 최상위 댓글 단위 cursor page를 반환한다. 페이지
`size`는 화면 행이나 모든 자손 수가 아니라 최상위 댓글 수다.

```ts
interface TodoCommentOverviewItem {
  comment: TodoComment;
  previewReply: TodoComment | null;
  replySummary: {
    totalCount: number;
    hiddenCount: number;
    hasMore: boolean;
    participantAuthors: TodoCommentAuthor[];
  };
}
```

- `comment`는 살아 있는 최상위 댓글 또는 살아 있는 자손이 남은 삭제 tombstone이다.
- `previewReply`는 서버가 고른 살아 있는 직계 답글 한 건이다. 할 일 작성자의 답글을 우선하고,
  같은 우선순위에서는 `createdAt`, `id` 오름차순으로 고른다.
- `totalCount`는 화면에 표시할 수 있는 모든 자손 수다. 삭제됐지만 자손이 남은 tombstone도
  포함한다.
- `hiddenCount`와 `hasMore`는 대표 답글을 제외한 나머지를 서버가 계산한 값이다.
- `participantAuthors`는 서버가 중복을 제거하고 최대 계약 상한까지만 고른다. 할 일 작성자를
  우선한 뒤 대화에서 처음 나타난 순서를 따른다.
- `TodoCommentOverviewList`는 파일 안의 지역 `TodoCommentOverviewRow`만 가상화한다. 같은 파일에서
  최상위 댓글, 대표 답글 최대 한 건, `CommentReplySummary`, Loading/Empty/Error를 조립한다.
  클라이언트에서 자손을 세거나 참여자를 다시 고르지 않는다.

### 선택한 대화

`GET /v1/todos/:todoId/conversation?focusCommentId=...`는 선택한 댓글이 속한 thread 범위에서
부모 우선 DFS window를 반환한다. `focusCommentId` 없이 읽는 전체 todo 범위와 focus로 읽는 thread
범위의 cursor는 서버가 구분한다.

```ts
interface TodoConversationItem {
  comment: TodoComment;
  connection: {
    visualDepth: number;
    upperLaneDepths: number[];
    lowerLaneDepths: number[];
    incomingBranch: null | {
      fromDepth: number;
      toDepth: number;
    };
  };
  isFocused: boolean;
}

interface TodoConversationFocus {
  commentId: string;
  itemIndex: number;
  precedingAncestors: TodoConversationItem[];
  omittedAncestorCount: number;
}
```

- 서버가 부모보다 자식이 먼저 오지 않는 순서와 양방향 cursor를 소유한다.
- `visualDepth`는 현재 댓글의 rail 위치다. `upperLaneDepths`는 행 상단부터 아바타 중심까지,
  `lowerLaneDepths`는 아바타 중심부터 행 하단까지 이어지는 lane이다. 배열은 음수가 없고 중복 없는
  오름차순이다. 답글의 `incomingBranch`는 직계 부모 depth에서 현재 depth로 휘어지고 최상위 댓글은 null이다.
- 이 topology는 서버가 page 경계 밖 sibling·cousin과 tombstone까지 확인해 완성한다. 같은 thread라는
  이유만으로 형제 가지를 직접 잇지 않는다. 지역 `ConversationThreadRail`은 값을 좌표로만 투영하며
  인접 행, `threadId`, `parentId`, `depth`로 tree나 연결을 다시 계산하지 않는다.
- focus는 초기 window에 포함된다. 현재 window에 없는 가까운 조상은 `precedingAncestors`로 받고,
  더 앞의 생략 수는 `omittedAncestorCount`로 받는다.
- `toTodoCommentConversationViewModel`은 여러 page의 같은 댓글을 `id`로 중복 제거하고 서버 필드를 row에
  전달한다. 현재 window에 직계 부모가 없을 때 지역 `FocusedTodoCommentParentContext`에 보여 줄 조상을 고르는 정도만
  허용한다. 트리 복원, 연결 계산, branch별 query는 하지 않는다.
- `TodoCommentConversationList`는 하나의 `FlashList`를 사용한다. 같은 파일의 지역
  `TodoCommentConversationRow`에서 자손 배열을 재귀 렌더링하지 않는다.
- focus query는 route의 `Suspense`가 준비를 기다린다. data와 focus index가 모두 있는 첫 mount에서
  `initialScrollIndex`를 준다. FlashList identity는 route anchor가 아니라 서버 행의 `threadId`다.
  같은 thread에서 화면에 보이는 댓글로 focus가 바뀌면 list와 위치를 그대로 유지한다.
- 같은 thread에서 새 focus가 일부 가려졌으면 `onCommitLayoutEffect`에서 FlashList의 공개 측정값
  (`getLayout`, `getFirstItemOffset`, `getWindowSize`)으로 안전 영역까지 필요한 최소 offset만 계산한다.
  화면에 보이던 댓글을 사용자가 고른 경우에는 한 번만 자연스럽게 이동하고, 새 window에만 있는 focus는
  `scrollToOffset`으로 무애니메이션 이동한다. 내부에서 여러 offset을 거치는 `scrollToIndex`를 사후
  보정으로 쓰지 않는다.
- 최초 `onLoad` 전에는 previous page prepend를 막는다. 초기 index를 적용하는 layout과 prepend가
  동시에 행 index를 바꾸지 않게 한다.

`LATEST`와 `POPULAR`의 정렬, cursor 위치, 삭제 댓글 유지, 대표 답글 선정은 서버 책임이다. 모바일은
서버의 영속 path나 cursor 내부 필드를 모델에 추가하지 않는다.

## 페이지 조립

route 파일 `app/(app)/todo/[todoId]/index.tsx`에서 화면 구조가 바로 읽혀야 한다.

```tsx
<TodoCommentScreenTransitionProvider>
  <TodoDetailPage />
</TodoCommentScreenTransitionProvider>;

function TodoDetailPage() {
  return (
    <StyledSafeAreaView>
      <TodoCommentTitleBar />
      <Separator />

      {showsCommentOverview ? (
        <TodoCommentOverviewList
          ListHeaderComponent={
            <>
              <TodoDetailCardSection />
              <TodoCommentSortBar />
            </>
          }
        />
      ) : (
        <TodoCommentConversationList ListHeaderComponent={<TodoDetailCardSection />} />
      )}

      <TodoCommentComposerBar />
    </StyledSafeAreaView>
  );
}
```

- `overview`와 `create`는 할 일 본문, 정렬, 최상위 댓글 개요를 보여 준다.
- `thread`, `reply`, `edit`는 할 일 본문과 선택한 thread 대화를 보여 준다.
- route가 safe area, separator, 바깥 padding, `QueryErrorBoundary`, `Suspense` 위치를 소유한다.
- focus 진입의 `Suspense` fallback은 댓글 row skeleton부터 그린다. 최종 initial viewport에서 가려질
  할 일 header를 fallback 맨 위에 잠깐 보여 주지 않는다.
- `TodoCommentTitleBar`는 mode에 맞는 제목과 back 의미만 소유한다.
- `TodoCommentScreenTransitionProvider`는 화면 안의 최신 댓글 이동과 정렬 전환 의도만 유지한다.
  연속 탭, 취소, 뒤로가기, 키보드 닫기, 작성 mutation과 늦게 끝난 prefetch가 현재 route를 뒤집지
  못하게 한다.
- 작성기가 열려 있으면 다른 댓글 body 이동과 정렬 전환을 막고 게시 또는 취소 안내를 보여 준다.
  답글 작성 중 다른 댓글의 답글 버튼을 누르면 키보드와 초안을 유지한 채 대상만 전환한다. 새 댓글
  작성과 수정 중에는 대상을 바꾸지 않는다. 전송 중에는 대상 전환, 뒤로가기와 작성기 닫기도 막는다.
- 목록의 `Loading`, `Error`, `Empty`는 본체와 같은 row 조각을 사용한다. 완료될 때 높이와 배치가
  크게 바뀌는 임의 skeleton을 만들지 않는다.
- 댓글 query만 실패하면 할 일 상세와 정렬 문맥은 유지하고 댓글 영역만 재시도 상태로 바꾼다.
- route 식별자는 page에서 자식 prop으로 배포하지 않는다. 각 feature block이 검증된
  `useTodoScreenParams`와 `useCommentRouteState`에서 직접 읽고, page는 화면 순서와 boundary만 소유한다.

## 예측 가능한 컴포넌트 계약과 이름

컴포넌트 이름은 대상과 역할을 함께 말한다.

- 할 일 본문: `TodoDetailCard`
- 최상위 댓글 개요 목록: `TodoCommentOverviewList`
- 개요의 최상위 댓글 묶음과 접힌 답글 진입점: `TodoCommentOverviewList`의 지역 컴포넌트
- 선택한 대화 행과 연결선: `TodoCommentConversationList`의 지역 컴포넌트
- 화면 하단 작성 바와 입력 폼: `TodoCommentComposerBar`, `TodoCommentComposerForm`
- 작성 mode 조립: `TodoCommentComposerBar`의 지역 컴포넌트
- 폼 상태와 mutation command: `TodoCommentComposerForm`과 지역 단일책임 hook

`Original`, `Container`, `Wrapper`, `Content`처럼 어느 도메인의 무엇인지 숨기는 이름은 공개
컴포넌트 이름으로 쓰지 않는다. 파일 안에서만 의미가 서는 작은 조립 조각은 export하지 않는 지역
컴포넌트로 둔다.

`TodoCommentArticle`은 작성자/본문 press, menu, like, reply를 소유한다. 목록 파일은 avatar/rail 배치만
맡고 같은 액션 조립을 반복하지 않는다. 작성자 또는 본문을 누르면 같은 route의 URL search state로
focus 대화를 열며, action 버튼의 press는 독립적이다.

공용 UI나 HeroUI Native를 감싸면 원본 계약을 계승하고 컴포넌트가 소유하는 prop만 뺀다.

```tsx
interface TodoCommentAuthorAvatarProps extends Omit<
  ComponentProps<typeof Avatar>,
  'alt' | 'children' | 'size'
> {
  author: TodoCommentAuthor | null;
  size: CommentAuthorAvatarSize;
}

interface CommentReplySummaryProps extends Omit<
  ComponentProps<typeof PressableFeedback>,
  'children'
> {
  summary: TodoCommentReplySummary;
}
```

- wrapper가 무엇인지는 계승한 계약으로 드러나야 한다.
- `className`, `testID`, 접근성 prop, press interaction처럼 원본이 이미 가진 확장 지점을 임의로
  막지 않는다.
- `isOpen/onOpenChange`, React Native 입력의 `value/onChangeText`, HeroUI Checkbox의
  `isSelected/onSelectedChange`처럼 원본 어휘를 유지한다.
- 부정 boolean prop을 만들지 않는다.
- feature 안에서 다른 파일의 값을 다시 export하지 않는다. route, component, test는 정의를
  소유한 실제 파일에서 직접 import한다. feature barrel과 별칭 re-export를 만들지 않는다.

## 인라인 작성 바와 키보드

작성 session의 단일 소스는 별도 provider가 아니라 URL mode다. `TodoCommentComposerBar`는 keyboard
shell을 소유하고 파일 안의 지역 컴포넌트가 mode를 읽어 다음 UI 중 하나를 고른다.

- `overview`: `NewCommentComposerTrigger`
- `create`: 새 댓글용 `TodoCommentComposerForm`
- `thread`: 선택한 댓글용 `SelectedCommentReplyTrigger`
- `reply`, `edit`: 대상 댓글을 조회한 `TodoCommentComposerForm`

`TodoCommentComposerSession`은 `create`, `reply`, `edit` 판별 union이다. 답글과 수정 대상은 조회된
`TodoComment`이고, 현재 작성자는 사용자 query와 할 일 작성자 ID로 만든다. nullable 필드
조합이나 effect로 session을 동기화하지 않는다.

키보드 구조는 다음 한 경로만 사용한다.

1. 앱 root의 `KeyboardProvider`가 native keyboard 이벤트 경계를 연다.
2. `TodoCommentComposerBar`를 `KeyboardStickyView`로 감싸 작성 바가 iOS와 Android 키보드 바로 위를
   따라가게 한다.
3. `KeyboardGestureArea`의 `textInputNativeID`와 활성 `TextArea`의 `nativeID`는
   `COMMENT_COMPOSER_INPUT_NATIVE_ID`를 함께 쓴다. 키보드 drag와 입력 focus의 대상을 연결한다.
4. `TodoCommentOverviewList`와 `TodoCommentConversationList`는 `TodoCommentKeyboardScrollView`를 FlashList의
   `renderScrollComponent`로 쓴다.
5. `TodoCommentKeyboardScrollView`는 `KeyboardChatScrollView`의 interactive dismiss와
   기본 `keyboardLiftBehavior="whenAtEnd"`를 한 곳에서 설정한다. 대화 목록은 FlashList 공개 layout과
   현재 offset으로 focus 하단 위치를 측정한다. 중간 focus는 `whenAtEnd`로 위치를 보존하고, 키보드에
   가릴 하단 focus는 첫 open에 `persistent`로 올린다. `keyboardDidHide` 뒤에는 같은 focus를
   `never`로 내려, end에 clamp된 경우에도 persistent가 보존한 offset에 reopen 높이가 다시 누적되지
   않게 한다. 버튼이 처리한 탭은 키보드를 먼저 닫지 않도록
   `keyboardShouldPersistTaps="handled"`도 여기서 고정한다.
6. 작성 바가 여러 줄 입력이나 이어 쓰기로 커지면 기본 높이보다 늘어난 값만
   `extraContentPadding`에 전달한다. 전체 높이를 넣으면 이미 레이아웃이 확보한 높이가 중복된다.
7. 키보드가 열리면 작은 하단 간격만 두고, 닫히면 safe area inset을 반영한다.

같은 thread에서 안전 영역에 온전히 보이는 focus가 바뀌거나 `thread`가 `reply`나 `edit`로 바뀔 때는
목록을 다시 스크롤하지 않는다. 일부 가린 focus만 상단과 키보드 위 하단의 12pt 안전 여백까지 최소
거리로 드러낸다. `renderScrollComponent`는 module-level 함수와 context consumer로 identity를 고정한다.
lift 정책이 바뀌어도 FlashList가 내부 keyboard scroll component를 다시 만들지 않는다.
키보드와 작성 바의 일반 이동은 `KeyboardChatScrollView`, `KeyboardStickyView`,
`extraContentPadding`의 UI thread 경로가 맡는다.

각 keyboard visible cycle의 `onCommitLayoutEffect`에서는 공식 `useKeyboardState`의 높이와 FlashList
공개 `getLayout`, `getFirstItemOffset`, `getAbsoluteLastScrollOffset`, `getWindowSize`를 읽어 worklet
이동 뒤에도 focus 행 전체가 작성 바 아래에 남았는지 확인한다. 첫 open과 이미 keyboard가 열린 focus
전환 모두 필요한 최소 거리만 `scrollToOffset({ animated: false })`으로 한 번 보정한다. 안전한 focus와
현재 window 밖 focus에는 이 보정을 하지 않고, keyboard가 닫히면 다음 visible cycle을 새로 연다.
`getWindowSize`는 작성 바 성장으로 이미 줄어든 목록 viewport이므로 `extraContentPadding`을 안전 영역에서
다시 빼지 않는다. `scrollToIndex`나 passive effect 사후 보정은 쓰지 않는다.

`TodoCommentComposerForm`은 현재 session의 `useForm`, Zod resolver, mutation command, 중복 전송 gate,
성공 뒤 닫기 순서를 소유한다. 지역 field는 `useController`, append/submit 액션은 `useFormState`로
필요한 상태만 구독한다. 답글일 때 누구에게 답하는지와 대상 본문을 키보드 위에 보여 준다. 답글 대상
ID가 바뀌어도 같은 `reply` form session을 재사용해 입력값과 focus를 보존한다. 대상 댓글과 전송
command의 `parentId`만 최신 session을 따른다. 폼 전체 높이는 viewport에 맞춰 제한하고 그 안을
스크롤해 작은 화면과 큰 글꼴에서도 목록을 완전히 덮지 않는다.
댓글 입력은 공용 `TextArea`의 opt-in `growsWithContent`를 써서 실제 content size와 표면 padding만큼
자라며, 기존 min/max 높이 안에서 멈춘다. 큰 글꼴의 두 번째 줄을 고정 높이로 자르지 않는다.
새 댓글과 답글은 계약 상한 안에서 이어 쓰기를 지원하고, 수정은 한 글만 다룬다. 전송 중에는 입력, 취소,
헤더와 하드웨어 뒤로가기, 중복 전송을 잠근다. BottomSheet, sheet provider, keyboard와 별도로 움직이는
modal 작성기를 이 기능에 다시 도입하지 않는다.

전송 상태의 단일 소스는 `useIsMutating({ mutationKey: TODO_COMMENT_MUTATION_KEYS.composer(todoId) })`다.
페이지, 작성기, 화면 전환 coordinator가 같은 mutation prefix를 읽는다. React render가 반영되기 전 같은
frame의 연속 전송만 form-local ref gate가 막으며, 별도 `isSubmitting` state를 동기화하지 않는다.

## Query, mutation, cache

모든 query와 mutation 옵션은 `presentations/queries`의 옵션 팩토리가 소유한다. component와 hook에서
query option 객체를 인라인으로 정의하지 않는다.

- 댓글 개요 cache는 `TODO_COMMENT_QUERY_KEYS.overview({ todoId, sort })`가 소유한다.
- 선택한 대화 cache는 `TODO_COMMENT_QUERY_KEYS.conversation({ todoId, sort, focusCommentId })`가
  소유한다.
- 댓글 대화 진입은 target query의 최초 window를 먼저 확정한다. prepend와 append 이력이 있는 캐시는
  `direction: initial` page만 남기고, stale하거나 캐시가 없으면 첫 page를 foreground에서 확인한다.
  준비가 끝난 뒤에만 URL을 바꾸므로 mount 뒤 index가 다시 바뀌지 않는다.
- 작성과 삭제는 구조와 집계를 바꾼다. 클라이언트가 root 위치, 대표 답글, 숨은 수, 참여자,
  연결선을 예측해서 넣지 않는다.
- 작성 성공 후 `settleTodoCommentMutation`이 활성 overview와 conversation, 할 일 상세와 목록 집계를
  invalidate하고 refetch를 마친 뒤 작성기를 닫는다. 서버 응답 전에 성공한 것처럼 닫지 않는다.
- 삭제 성공도 같은 read model과 할 일 댓글 수를 서버에서 다시 확인한다.
- 좋아요와 본문 수정은 댓글 한 건의 scalar 값만 `patchCommentEverywhere`로 overview,
  conversation, focus 조상 snapshot에 구조 공유를 보존하며 반영한다. 오류면 이전 값을 복구하고,
  settled 시 서버 read model을 다시 확인한다.
- `POPULAR`의 root 순서는 클라이언트가 재정렬하지 않는다.
- 글마다 `clientRequestId`를 발급하고 같은 logical command의 network retry에는 같은 ID를 재사용한다.
  중복 탭과 응답 유실이 같은 댓글을 두 번 만들지 않게 한다.
- idempotency command는 작성 form session의 ref에만 둔다. 성공·확정 4xx에는 지우고, 응답이 모호한
  네트워크/5xx 재시도에서만 같은 UUID를 재사용한다. QueryClient 전역 registry나 TTL을 만들지 않는다.

즉, optimistic update가 허용되는 범위는 좋아요와 수정 같은 댓글 한 건의 scalar 값이다. 댓글 사슬 삽입,
삭제 후 접기, 답글 집계, 대화 연결 같은 구조 계산은 항상 서버 확인 뒤 refetch한다.

## 색상과 접근성

- 배경, 구분선, 본문, 보조 글자, focus 강조, 연결선은 `bg-background`, `gray-*`, semantic tone처럼
  theme token만 사용한다. light 전용 흰색이나 dark 전용 검은색을 화면 의미로 하드코딩하지 않는다.
- 아바타와 연결선 위치는 글꼴 배율과 독립된 고정 크기를 사용하되, 본문과 버튼은 font scaling을
  허용한다.
- 좋아요, 답글, 더보기, 정렬, 답글 보기, 전송, 취소에는 accessibility label과 disabled, busy,
  expanded 상태를 제공한다.
- 터치 대상은 최소 44pt다. 아이콘만 보이는 버튼도 이름을 가진다.
- `ConversationThreadRail`의 선 segment와 장식용 개요 연결선은 accessibility tree에서 숨긴다.
- 다른 thread의 focus 목록은 목표 index에서 처음부터 mount한다. 같은 thread의 보이는 focus는
  그대로 두고, window 밖 focus만 layout commit 안에서 무애니메이션 offset 한 번으로 찾는다. 위치가
  정해진 뒤 `AccessibilityInfo.announceForAccessibility`로 알린다.
- pending 상태가 있는 UI는 live region으로 알리되 행 전체를 한 접근성 요소로 묶어 자식 동작을
  가리지 않는다.
- 삭제 댓글, 탈퇴한 작성자, 답글 권한 없음, 큰 글꼴, 긴 영문에서도 댓글 본문과 조작 영역이 레이아웃에
  가려지지 않아야 한다. 작성기 대상과 window 밖 부모 문맥은 입력과 동작을 밀어내지 않도록 시각적으로
  두 줄 excerpt로 접되, 원문 문자열을 접근성 이름에 그대로 보존한다.

## 실제 파일 경계

리팩터링 전에는 Article의 menu/like/reply, 목록의 row/state, 작성기의 content/mutation/draft가
각각 별도 파일로 분리되어 한 UI 변경에 여러 파일을 오가야 했다. 현재는 다음처럼 함께 바뀌는 단위로
합친다.

```text
Before
  TodoCommentArticle.tsx + ActionMenu.tsx + LikeButton.tsx + ReplyButton.tsx
  TodoCommentOverviewList.tsx + TodoCommentOverviewRow.tsx
  TodoCommentConversationList.tsx + TodoCommentConversationRow.tsx
  ComposerBar.tsx + ComposerContent.tsx + MutationForm.tsx + ComposerForm.tsx + DraftChain.tsx

After
  TodoCommentArticle.tsx
  TodoCommentOverviewList/TodoCommentOverviewList.tsx
  TodoCommentConversationList/TodoCommentConversationList.tsx
  TodoCommentComposerBar/TodoCommentComposerBar.tsx
  TodoCommentComposerBar/TodoCommentComposerForm.tsx
```

```text
app/(app)/todo/[todoId]/index.tsx
  화면 조립과 query boundary

src/features/todo-comment/
  models/todo-comment.model.ts
    shared wire 타입에서 Date만 바꾼 모바일 모델, policy, draft 순수 규칙
  services/todo-comment.service.ts
  services/todo-comment.mapper.ts
    HTTP 검증과 Date 변환
  presentations/components/
    TodoCommentArticle.tsx
    TodoCommentAuthorAvatar.tsx
    TodoCommentSortBar.tsx
    TodoCommentTitleBar.tsx
    TodoCommentKeyboardScrollView.tsx
    TodoCommentOverviewList/
      TodoCommentOverviewList.tsx
    TodoCommentConversationList/
      TodoCommentConversationList.tsx
    TodoCommentComposerBar/
      TodoCommentComposerBar.tsx
      TodoCommentComposerForm.tsx
  presentations/hooks/use-comment-route-state.ts
  presentations/hooks/use-comment-conversation-navigation.ts
  presentations/hooks/use-comment-sort-transition.ts
  presentations/hooks/use-comment-screen-back-handler.ts
  presentations/providers/todo-comment-screen-transition.tsx
  presentations/queries/
    use-todo-comment-overview-query-options.ts
    use-todo-comment-conversation-query-options.ts
    todo-comment-mutation-lifecycle.ts
  presentations/utils/
    comment-route-state.ts
    comment-screen-back-action.ts
    todo-comment-cursor-page.ts
    todo-comment-connection-layout.ts
    todo-comment-cache.util.ts
    todo-comment-optimistic.ts
    todo-comment-write-command.ts
    comment-composer-submission.ts
    comment-composer-chain-layout.ts
    comment-composer-fields.ts
    comment-conversation-position.ts
    comment-composer-layout.ts
  presentations/view-models/
    todo-comment-overview.view-model.ts
    todo-comment-conversation.view-model.ts
    todo-comment-composer.view-model.ts
```

새 파일은 책임이 이 목록과 다를 때만 추가한다. 이미 있는 route state, mapper, query factory, cache
command, keyboard wrapper와 같은 일을 하는 두 번째 방식을 만들지 않는다.

## 검증 행렬

### 자동 검증

- model: 작성 권한과 댓글 draft 같은 모바일 고유 policy
- service/mapper: 공유 validator 검증, overview/conversation mapping, Date 변환, 요청 signal 전달
- pure util: cache identity 보존, 좋아요 optimistic 변환, 안정적인 `clientRequestId`, 중복 제출 차단,
  작성기 높이와 focus 위치 경계값
- view-model: 서버 connection과 summary를 재계산하지 않는 화면 데이터 변환, focus 부모 snapshot 중복 방지

컴포넌트, hook, Provider, Query Options 배선 테스트는 기본적으로 만들지 않는다. 키보드와 목록의 실제
mount·focus·scroll 동작은 아래 native 행렬로 검증한다. 이 feature에는 공통 테스트 가이드의 UI 테스트
예외를 적용하지 않는다.

```bash
pnpm --filter @aido/mobile test
pnpm --filter @aido/mobile typecheck
pnpm --filter @aido/mobile check:conventions
pnpm --filter @aido/mobile test:conventions
```

### iOS와 Android native 확인

아래 조합은 Simulator와 실제 기기에서 모두 확인한다.

| 영역     | iOS                                                           | Android                                                     |
| -------- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| 테마     | light, dark에서 배경, 구분선, 연결선, focus 대비              | light, dark에서 같은 semantic 대비                          |
| 키보드   | 처음 focus, interactive drag dismiss, safe area, 한영 긴 입력 | resize 시 작성 바 고정, keyboard drag, 화면 높이 복원       |
| 뒤로가기 | Header back이 reply, thread, overview 순서로 이동             | hardware back이 reply, thread, native pop 순서로 이동       |
| 목록     | overview pagination, 답글 보기, focus 첫 frame 고정           | overview pagination, prepend 위치 보존, focus 첫 frame 고정 |
| 접근성   | VoiceOver, 큰 글꼴, Reduce Motion                             | TalkBack, 큰 글꼴, Remove Animations                        |
| 예외     | 삭제 조상, 탈퇴 작성자, 권한 없음, offline retry              | 삭제 조상, 탈퇴 작성자, 권한 없음, offline retry            |

## 기계 가드

`pnpm --filter @aido/mobile check:conventions`가 다음 회귀를 막는다.

- 중첩 댓글 route와 todo route 전용 `_layout.tsx`
- todo-comment 컴포넌트의 route 식별자 props
- todo-comment feature의 `router.push`
- query hook의 인라인 옵션
- todo-comment feature와 todo route의 re-export
- todo-comment의 model, service, pure util/view-model 경계를 벗어난 새 테스트

가드 자체는 `pnpm --filter @aido/mobile test:conventions`로 검증한다. 문서에 규칙을 추가할 때 타입,
lint, 기존 convention guard가 잡지 못하면 같은 변경에서 가드와 가드 테스트도 추가한다.
