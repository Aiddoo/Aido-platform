# LabelChip

heroui-native `Chip`의 soft 변형에 앱 `Text`를 자식으로 넣은 표시용 칩. 칩 색과 글자 색(`text-{color}-soft-foreground`)을 한 번에 맞춘다.

## 사용법

```tsx
<LabelChip color="accent" label={t('tier.premium')} pointerEvents="none" />
<LabelChip color="accent" label={label} labelProps={{ weight: 'semibold', numberOfLines: 1 }} />
```

## Props

| prop         | 타입                                 | 설명                             |
| ------------ | ------------------------------------ | -------------------------------- |
| `color`      | `Chip`의 `color`                     | 칩 색. 글자 색이 짝으로 정해진다 |
| `label`      | `string`                             | 칩 글자                          |
| `labelProps` | `Text` props(`children`·`size` 제외) | 굵기·줄 수·`className` 등        |

`size`는 `Chip`의 것(기본 `sm`)이고 `variant`는 `soft`로 고정이다. 나머지는 `...props`(`Chip`)다.

## 동작

- 글자 크기는 칩 크기를 따른다: `sm` → `e1`, `md`·`lg` → `b3`.
- `Chip`은 Pressable이라 줄 안에 놓는 표시용에는 `pointerEvents="none"`을 준다.
- 섹션 머리 알약(`secondary`)은 지원하지 않는다.
