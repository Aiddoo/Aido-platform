# Grid

열 수가 정해진 격자다. `Grid`가 `columns`를 Context로 `GridItem`에 넘기고, `GridItem`이 `colSpan`만큼의 폭을 차지한다.

## 사용법

```tsx
<Grid columns={3} gap={8}>
  {icons.map((icon) => (
    <GridItem key={icon.key} className="items-center p-2">
      <Image source={icon.preview} />
      <Text>{icon.label}</Text>
    </GridItem>
  ))}
</Grid>
```

## Props

`Grid`는 `direction`·`wrap`을 뺀 [`Flex`](../flex/flex.md) Props, `GridItem`은 [`Box`](../box/box.md) Props를 펼친다.

| Prop                  | 받는 것    | 뜻                           |
| --------------------- | ---------- | ---------------------------- |
| `columns`             | `Grid`     | 열 수(기본 1)                |
| `rowGap`, `columnGap` | `Grid`     | 행·열 간격(px). 없으면 `gap` |
| `colSpan`             | `GridItem` | 차지할 열 수(기본 1)         |

## 동작

- 열 간격은 flex `columnGap`으로 주지 않는다. RN(Yoga)에는 `calc()`가 없어 `width: 50%` 칸 두 개에 간격을 더하면 한 줄을 넘쳐 두 번째 칸이 다음 줄로 내려간다. 대신 `GridItem`이 시작 열에 따라 좌우 padding을 나눠 가져, 모든 칸이 같은 폭이고 이웃 간격은 늘 `columnGap`이다(`grid-layout.ts`). 그래서 `GridItem`의 `className`·`style`·`testID`는 간격 안쪽 칸에 붙는다.
- `Grid` 밖의 `GridItem`은 `columns` 기본값 1로 폭 100%다.
