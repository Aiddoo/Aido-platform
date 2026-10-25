# AdaptivePane 컴포넌트

창 폭(`useWindowSizeClass`)에 따라 목록과 상세를 나란히 놓는 List-detail 컨테이너입니다. 폴더블 펼침, 태블릿, 분할 화면에서 쓰며 힌지 상태는 쓰지 않습니다.

```tsx
import { AdaptivePane } from '@src/shared/ui';
```

## 동작

| size class | 폭        | 렌더링                                                                        |
| ---------- | --------- | ----------------------------------------------------------------------------- |
| `compact`  | 600 미만  | `compactPane` 쪽만(기본 `primary`). 목록 화면의 상세는 라우트 push가 대신한다 |
| `medium`   | 600 ~ 839 | `primary`(320 고정) \| `secondary`(나머지)                                    |
| `expanded` | 840 이상  | `primary`(400 고정) \| `secondary`(나머지)                                    |

- Mac(Designed for iPad)은 창 폭과 관계없이 `compact`다(`IS_IOS_APP_ON_MAC`). Expo 권장이 아니라 데스크톱에서도 모바일과 같은 경험을 주려는 제품 결정이다. 시작할 때 정해지는 상수라 첫 프레임부터 1열이다.
- 각 pane을 `SafeAreaProvider`로 감싼다. pane 안의 `SafeAreaView`·`useSafeAreaInsets`는 창이 아닌 그 pane이 실제로 겹치는 safe area만 받는다. iPhone Duo는 접혀도 펼쳐도 탭 바·상태 표시를 좌우 세로 레일로 옮기는데, 펼친 2-pane에서는 레일에 닿는 pane만 inset을 받는다.
- 첫 프레임에는 그 pane이 닿는 가장자리의 창 inset만 `initialMetrics`로 준다(`getPaneInitialInsets`, RTL이면 좌우를 바꾼다). 네이티브 측정 전에 레일 반대쪽 pane이 84pt 들여 그려졌다가 튀는 시프트를 막는다.
- 컨테이너는 가로 inset을 적용하지 않는다. pane 내용이 스스로 피한다: 스크롤 내용은 `<StyledSafeAreaView edges={['left', 'right']}>`로 감싸고(스크롤바와 배경은 가장자리까지), 고정 헤더·하단 버튼·빈 상태는 그 컨테이너에 `left`/`right`를 둔다. react-native-safe-area-context의 `SafeAreaView`는 가장 가까운 provider의 inset을 쓰므로 같은 축의 `SafeAreaView`를 중첩하지 않는다(중복 패딩).
- pane 폭은 size class별 최소 목록 폭(320/400)이고 상세 pane은 남은 폭을 채운다. 기기별 고정 폭이 아니라 창 폭 기준이다.
- 반쯤 접어 세로 접힘선(reserved region `division`)이 생기면 목록 폭을 접힘선의 `frame.x`에 맞추고 접힘선 폭만큼 비운다. `AdaptivePane`이 `ReservedRegionsProvider`로 자기 좌표계를 만들고, 접힘선은 `findVerticalFold`로 찾는다.
- 펼친 화면에서 고른 항목은 URL param으로 상세 pane에 보여 준다. 접히면 항상 렌더링되는 목록 pane에서 `useCompactDetailHandoff(selectedId, openDetail)`로 상세 라우트에 넘긴다. 훅은 `useIsFocused`로 앞에 보이는 화면에서만 동작하므로, 뒤에 남아 있는 다른 탭은 push하지 않는다.
- 목록 밖(푸시·알림함 행)에서 여는 항목도 같은 기준을 따른다. 할 일은 `createTodoDetailHref(windowSizeClass, …)`가 접힌 화면이면 `/todo/[todoId]`, 펼친 화면이면 `/feed?todoId=`(피드 상세 pane)를 고른다.
- 하단 탭 바 높이를 가정한 여백을 두지 않는다.
- 두 pane은 size class와 무관하게 같은 트리 슬롯에 둔다. 접기/펼치기에서 남아 있는 pane은 다시 마운트되지 않아 스크롤·입력·내비게이터 상태가 유지된다.

## 상세 pane 헤더

pane은 Stack 화면이 아니어서 네이티브 헤더가 없고, 꼭대기 바를 피처가 JS로 그린다(할 일 `TodoCommentTitleBar`, 메모 상세 pane 버튼 줄).

- 선택과 해제는 목록 pane이 맡는다. 상세 pane 첫 단계에는 뒤로가기·닫기 버튼을 두지 않는다. Android 하드웨어 뒤로가기는 댓글 단계를 먼저 되돌린 뒤 선택을 해제한다.
- 제목·보조 문구는 왼쪽 정렬 `Text` 토큰(b2 bold, e1)이라 글자 크기 설정을 따르고, 버튼은 44×44로 고정한다.
- 오른쪽에는 그 항목의 동작만 둔다(내 할 일은 ⋯ → `/todo/[todoId]/actions`, 메모는 고정·AI·할 일 변환·삭제·저장).
- pane 안에서 한 단계 들어간 화면(댓글 대화)만 그 안의 이전 단계로 돌아가는 뒤로가기를 둔다.
- 접힌 화면(compact)은 상세 라우트의 네이티브 헤더와 시스템 뒤로가기를 그대로 쓴다.

## Props

| Prop          | 타입                       | 설명                                                            |
| ------------- | -------------------------- | --------------------------------------------------------------- |
| `primary`     | `ReactNode`                | 목록 영역                                                       |
| `secondary`   | `ReactNode`                | 상세 영역. medium 이상에서 항상 렌더링                          |
| `compactPane` | `'primary' \| 'secondary'` | compact에서 남길 영역. 설정처럼 상세가 내비게이터면 `secondary` |

## 파일 구조

```
adaptive-pane/
├── adaptive-pane.tsx
├── adaptive-pane.types.ts
├── adaptive-pane.test.tsx
├── get-pane-initial-insets.ts
├── get-primary-pane-width.ts
├── index.ts
└── adaptive-pane.md
```
