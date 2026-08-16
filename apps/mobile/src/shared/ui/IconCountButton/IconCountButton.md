# IconCountButton

아이콘 옆에 숫자를 붙인 버튼입니다. 좋아요·답글·댓글처럼 "무언가가 몇 개 쌓였고 누르면 그리로 간다"는 자리가 반복되는데, 그 반복 단위는 하나면 됩니다. 도메인은 모릅니다 — 무엇을 세는지는 놓는 쪽이 아이콘과 숫자로 말합니다.

## 구조

```
IconCountButton/
├── IconCountButton.tsx   # 컴포넌트 + 여백 상수
└── index.ts
```

## 기본 사용법

```tsx
import { ICON_COUNT_BUTTON_ICON_SIZE, IconCountButton } from '@src/shared/ui';

<IconCountButton
  icon={
    <ChatBubbleIcon
      width={ICON_COUNT_BUTTON_ICON_SIZE}
      height={ICON_COUNT_BUTTON_ICON_SIZE}
      colorClassName="text-gray-6"
    />
  }
  count={todo.commentCount}
  onPress={openComments}
  accessibilityRole="button"
  accessibilityLabel={t('detail.open')}
/>;
```

## API Reference

### Props

`PressableFeedback`의 props를 그대로 받습니다(`children`·`className`·`hitSlop` 제외 — 이 셋은 컴포넌트가 소유합니다).

| Prop    | Type        | Description                                                     |
| ------- | ----------- | --------------------------------------------------------------- |
| `icon`  | `ReactNode` | 왼쪽에 놓일 글리프. 크기는 `ICON_COUNT_BUTTON_ICON_SIZE`를 쓴다 |
| `count` | `number`    | **0이면 숫자를 숨긴다.** 100 이상은 `99+`로 접힌다              |

### 내보내는 상수

| 이름                          | 값   | 용도                                                                  |
| ----------------------------- | ---- | --------------------------------------------------------------------- |
| `ICON_COUNT_BUTTON_ICON_SIZE` | `18` | 아이콘 글리프 크기. 나란히 놓았을 때 무게가 맞는다                    |
| `ICON_COUNT_BUTTON_INK_INSET` | `10` | 버튼이 품은 여백. 아이콘 잉크를 본문 왼쪽 선에 맞추려면 이만큼 당긴다 |

## 설계 노트

- **폭은 내용만큼만 차지합니다.** 최소 폭을 주면 숫자 자릿수에 따라 남는 자리가 달라져 옆 아이콘과의 간격이 매번 달라 보입니다. 숫자는 `99+`에서 멈추므로 옆 아이콘이 밀리는 폭은 세 글자를 넘지 않습니다.
- **버튼끼리는 붙여 놓습니다.** 사이는 각 버튼이 품은 가로 여백이 벌리므로, 눌리는 영역에 빈틈도 겹침도 생기지 않습니다.
- `hitSlop`은 세로로만 넓힙니다. 가로는 여백이 이미 벌려 두어 옆 버튼의 영역을 침범하지 않습니다.
