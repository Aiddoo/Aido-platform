# Grid 컴포넌트

그리드 레이아웃 컴포넌트입니다. `Flex`를 `direction="row" wrap="wrap"`으로 래핑하며, `columns`를 Context로 `GridItem`에 전달합니다.

## 사용법

```tsx
import { Grid } from '@src/shared/ui/Grid/Grid';
import { GridItem } from '@src/shared/ui/Grid/GridItem';

<Grid columns={3} gap={8}>
  <GridItem>아이템 1</GridItem>
  <GridItem>아이템 2</GridItem>
  <GridItem>아이템 3</GridItem>
</Grid>
```

## Props

### Grid Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `columns` | `number` | `1` | 열 개수 |
| `rowGap` | `number` | - | 행 간격 (px) |
| `columnGap` | `number` | - | 열 간격 (px) |

### GridItem Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `colSpan` | `number` | `1` | 차지할 열 수 |

### Flex Props (Grid 상속)

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `justify` | `'start' \| 'center' \| 'end' \| 'between' \| 'around' \| 'evenly'` | `'start'` | justify-content |
| `align` | `'start' \| 'center' \| 'end' \| 'stretch' \| 'baseline'` | `'stretch'` | align-items |

### Spacing Props (BoxProps 상속)

| Prop | 타입 | 설명 |
|------|------|------|
| `flex` | `number` | flex 값 |
| `gap` | `number` | 자식 요소 간격 (px) |
| `p` | `number` | padding 전체 |
| `px` | `number` | padding 좌우 |
| `m` | `number` | margin 전체 |
| `mx` | `number` | margin 좌우 |

### 기타 Props

| Prop | 타입 | 설명 |
|------|------|------|
| `className` | `string` | 추가 Tailwind 클래스 |
| `style` | `ViewStyle` | 인라인 스타일 |

## 예시

### 3열 아이콘 그리드

```tsx
<Grid columns={3} gap={8}>
  {icons.map((icon) => (
    <GridItem key={icon.key} className="items-center" p={8}>
      <Image source={icon.preview} />
      <Text>{icon.label}</Text>
    </GridItem>
  ))}
</Grid>
```

### rowGap/columnGap 분리

```tsx
<Grid columns={2} rowGap={16} columnGap={8}>
  <GridItem>카드 1</GridItem>
  <GridItem>카드 2</GridItem>
  <GridItem>카드 3</GridItem>
  <GridItem>카드 4</GridItem>
</Grid>
```

### colSpan으로 열 병합

```tsx
<Grid columns={4}>
  <GridItem colSpan={2}>50% 너비</GridItem>
  <GridItem>25% 너비</GridItem>
  <GridItem>25% 너비</GridItem>
</Grid>
```

### Grid 없이 단독 사용

Grid 없이 사용하면 columns 기본값(1)으로 width가 100%가 됩니다.

```tsx
<GridItem>전체 너비</GridItem>
```

## 파일 구조

```
Grid/
├── Grid.tsx           # Grid 컴포넌트 + GridContext
├── Grid.types.ts      # GridProps 타입
├── GridItem.tsx        # GridItem 컴포넌트
├── GridItem.types.ts   # GridItemProps 타입
├── Grid.test.tsx       # Grid + GridItem 통합 테스트
└── README.md           # 문서
```

## 타입 상속

```
BoxProps (spacing)
  ├─ FlexProps (+ direction, wrap, justify, align)
  │    ├─ HStackProps (direction 제외, row 고정)
  │    ├─ VStackProps (direction 제외, column 고정)
  │    └─ GridProps (direction·wrap 제외 + columns, rowGap, columnGap)
  └─ GridItemProps (+ colSpan)
```
