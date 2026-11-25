# touch-target

보이는 모양이 44pt보다 작은 누름 부품의 `hitSlop`을 한 계산으로 정한다. 44에 모자란 값을 파일마다 숫자로 적지 않는다.

## 사용법

```tsx
import { getTouchTargetInset } from '@src/shared/ui';

/** 체크 칸(size-5) */
const CHECKBOX_SIZE_PT = 20;
const CHECKBOX_HIT_SLOP = getTouchTargetInset(CHECKBOX_SIZE_PT); // 12

<TodoRow.Checkbox hitSlop={CHECKBOX_HIT_SLOP} />;
```

## 값

| 이름                  | 뜻                                                                     |
| --------------------- | ---------------------------------------------------------------------- |
| `MIN_TOUCH_TARGET_PT` | 44. 최소 누름 크기                                                     |
| `getTouchTargetInset` | 한 축의 보이는 크기(pt) → 한쪽 여백 `(44 - 크기) / 2`. 44 이상이면 `0` |

## 동작

- 보이는 크기는 가장 작은 글꼴 단계 기준이다. `useFontScaledSize()`로 커지는 아이콘·글줄은 작은 단계에서 가장 작아 여기서 44가 되면 다른 단계도 44 이상이다.
- **44는 최소다.** 이미 44보다 넓게 준 hitSlop은 줄이지 않고 그대로 둔다. 이 값은 모자란 곳을 채울 때만 쓴다.
- 옆 컨트롤·다음 줄과 누르는 영역이 겹치는 축은 채우지 않고 겹치지 않을 만큼만 준다. 규칙은 [ui](../../../../docs/architecture/ui.md#글꼴과-기기)에 있다.
