# IconButton

아이콘만 있는 버튼이다. `PressableFeedback` 기반이라 눌림 효과가 앱 전체와 같고, 눌리는 영역은 최소 44pt다.
`accessibilityRole="button"`은 고정이고 `accessibilityLabel`은 타입으로 강제한다.

## 사용법

```tsx
import { IconButton, PinIcon } from '@src/shared/ui';

<IconButton
  accessibilityLabel={t('detail.pin')}
  icon={<PinIcon width={20} height={20} colorClassName="text-gray-9" />}
  onPress={onPin}
/>;
```

## Props

| Prop               | 타입                                      | 설명                                    |
| ------------------ | ----------------------------------------- | --------------------------------------- |
| icon               | `ReactNode`                               | 가운데에 그릴 아이콘                    |
| accessibilityLabel | `string`                                  | 필수. 스크린 리더가 읽을 이름           |
| ...props           | `PressableFeedback` 원본(`children` 제외) | `onPress`, `isDisabled`, `className` 등 |

## 규칙

- 달력 이전·다음, 하위 할 일 삭제, 비밀번호 보기, 약관 보기처럼 라벨이 없던 곳에 쓴다. 자리가 좁은 곳은 `className="size-* min-h-0 min-w-0"`로 칸을 고정해 줄이고(안의 아이콘만 글꼴 단계를 따른다) `hitSlop`으로 44를 채운다.

- 기본 모양은 `min-h-11 min-w-11`이다. 모양을 줄여야 하면 `min-h-*`/`min-w-*`를 줄이고 `hitSlop`으로 44를 채운다. 부모 높이가 44 이상일 때만 안전하다.
- 글자가 있는 버튼은 `Button`/`TextButton`, 아이콘 + 개수는 `IconCountButton`을 쓴다.
