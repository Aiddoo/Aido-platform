# Flex 컴포넌트

Flexbox 레이아웃을 위한 기본 컴포넌트입니다. `BoxProps`를 상속받아 spacing props도 지원합니다.

## 설치

이 컴포넌트는 `@aido/mobile` 앱에 포함되어 있습니다.

```tsx
import { Flex } from '@src/core/component/ui/Flex';
```

## 기본 사용법

```tsx
<Flex>
  <Text>아이템 1</Text>
  <Text>아이템 2</Text>
</Flex>
```

## Props

### Flex Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `direction` | `'row' \| 'column' \| 'row-reverse' \| 'column-reverse'` | `'row'` | flex 방향 |
| `wrap` | `'wrap' \| 'nowrap' \| 'wrap-reverse'` | `'nowrap'` | flex wrap |
| `justify` | `'start' \| 'center' \| 'end' \| 'between' \| 'around' \| 'evenly'` | `'start'` | justify-content |
| `align` | `'start' \| 'center' \| 'end' \| 'stretch' \| 'baseline'` | `'stretch'` | align-items |

### Spacing Props (BoxProps 상속)

| Prop | 타입 | 설명 |
|------|------|------|
| `flex` | `number` | flex 값 |
| `gap` | `number` | 자식 요소 간격 (px) |
| `p` | `number` | padding 전체 |
| `px` | `number` | padding 좌우 |
| `py` | `number` | padding 상하 |
| `pt` | `number` | padding 상단 |
| `pb` | `number` | padding 하단 |
| `pl` | `number` | padding 좌측 |
| `pr` | `number` | padding 우측 |
| `m` | `number` | margin 전체 |
| `mx` | `number` | margin 좌우 |
| `my` | `number` | margin 상하 |
| `mt` | `number` | margin 상단 |
| `mb` | `number` | margin 하단 |
| `ml` | `number` | margin 좌측 |
| `mr` | `number` | margin 우측 |

### 기타 Props

| Prop | 타입 | 설명 |
|------|------|------|
| `className` | `string` | 추가 Tailwind 클래스 |
| `style` | `ViewStyle` | 인라인 스타일 |

## 예시

### 방향 (direction)

```tsx
// 수평 (기본값)
<Flex direction="row">
  <Text>왼쪽</Text>
  <Text>오른쪽</Text>
</Flex>

// 수직
<Flex direction="column">
  <Text>위</Text>
  <Text>아래</Text>
</Flex>
```

### 정렬 (justify + align)

```tsx
// 중앙 정렬
<Flex justify="center" align="center">
  <Text>가운데</Text>
</Flex>

// 양쪽 끝 배치
<Flex justify="between" align="center">
  <Text>왼쪽</Text>
  <Text>오른쪽</Text>
</Flex>
```

### Spacing Props 사용

```tsx
<Flex flex={1} px={24} py={16} gap={12}>
  <Text>아이템 1</Text>
  <Text>아이템 2</Text>
  <Text>아이템 3</Text>
</Flex>

<Flex direction="column" p={16} mb={24}>
  <Text>패딩과 마진이 적용된 Flex</Text>
</Flex>
```

### 줄바꿈 (wrap)

```tsx
<Flex wrap="wrap" gap={8}>
  <Chip>태그1</Chip>
  <Chip>태그2</Chip>
  <Chip>태그3</Chip>
  <Chip>태그4</Chip>
</Flex>
```

## 타입 상속

`FlexProps`는 `BoxProps`를 상속받습니다.

```
BoxProps (spacing)
  └─ FlexProps (+ direction, wrap, justify, align)
       ├─ HStackProps
       └─ VStackProps
```
