# ScrollProgressWidget

긴 목록의 스크롤 진행률을 보여주고, 끝에 닿으면 맨 위로 돌아가는 화살표로 바뀌는 플로팅 위젯입니다.
Reanimated `SharedValue`만 읽으므로 스크롤 중 React 리렌더가 없습니다.

## 사용법

```tsx
import { ScrollProgressWidget } from '@src/shared/ui';

<ScrollProgressWidget progress={progress} onScrollToTop={() => listRef.current?.scrollToTop()} />;
```

## Props

| Prop            | 타입                  | 기본값 | 설명                      |
| --------------- | --------------------- | ------ | ------------------------- |
| `progress`      | `SharedValue<number>` | -      | 0~1 스크롤 진행률         |
| `onScrollToTop` | `() => void`          | -      | 끝에서 화살표를 눌렀을 때 |
| `bottomOffset`  | `number`              | `50`   | 화면 하단에서 띄울 거리   |

진행률이 0이면 숨고, 0과 1 사이에서는 펼쳐진 진행 막대와 퍼센트를, 1이면 위로 가기 화살표를 보입니다.

## 파일 구조

```
scroll-progress-widget/
├── scroll-progress-widget.tsx   # 컴포넌트
├── scroll-progress-widget.md    # 이 문서
└── index.ts                     # 배럴
```
