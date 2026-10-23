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

`PressableFeedback`의 props를 그대로 받습니다(`children` 제외). `className`과 `hitSlop`으로
화면 밀도에 맞게 터치 상자를 조정할 수 있습니다.

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

- 기본 크기는 최소 44×44pt입니다. 숫자가 있으면 내용에 맞게 가로로 늘어나고, 0이면 아이콘만 가운데에 남습니다.
- 조밀한 목록에서는 `className="min-h-0"`으로 시각 높이만 줄입니다. 기본 `py-1.5`와 세로 `hitSlop`이 약 46pt의 터치 영역을 유지합니다.
- **버튼끼리는 붙여 놓습니다.** 사이는 각 버튼이 품은 가로 여백이 벌리므로, 눌리는 영역에 빈틈도 겹침도 생기지 않습니다.
- `hitSlop`은 세로로만 넓힙니다. 가로는 여백이 이미 벌려 두어 옆 버튼의 영역을 침범하지 않습니다.
