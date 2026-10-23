# AdaptivePane 컴포넌트

창 폭(`useWindowSizeClass`)에 따라 목록과 상세를 나란히 놓는 List-detail 컨테이너입니다. 폴더블 펼침, 태블릿, 분할 화면에서 쓰며 힌지 상태는 쓰지 않습니다.

```tsx
import { AdaptivePane } from '@src/shared/ui';
```

## 동작

| size class | 폭        | 렌더링                                     |
| ---------- | --------- | ------------------------------------------ |
| `compact`  | 600 미만  | `primary`만. 상세는 라우트 push가 대신한다 |
| `medium`   | 600 ~ 839 | `primary`(320 고정) \| `secondary`(나머지) |
| `expanded` | 840 이상  | `primary`(400 고정) \| `secondary`(나머지) |

- 컨테이너에 가로 safe-area inset(`left`/`right`)을 적용한다. iPhone Duo가 펼치면 탭 바를 우측(또는 좌측) 세로 레일로 옮기기 때문이다. 자식 pane에서 가로 inset을 다시 더하지 않는다.
- 하단 탭 바 높이를 가정한 여백을 두지 않는다.

## Props

| Prop        | 타입        | 설명                                   |
| ----------- | ----------- | -------------------------------------- |
| `primary`   | `ReactNode` | 항상 렌더링하는 목록 영역              |
| `secondary` | `ReactNode` | medium 이상에서만 렌더링하는 상세 영역 |

## 파일 구조

```
adaptive-pane/
├── adaptive-pane.tsx
├── adaptive-pane.types.ts
├── adaptive-pane.test.tsx
├── index.ts
└── README.md
```
