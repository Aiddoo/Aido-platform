# Flex 컴포넌트

Flexbox 레이아웃을 위한 기본 컴포넌트입니다.

## 설치

이 컴포넌트는 `@aido/mobile` 앱에 포함되어 있습니다.

```tsx
import { Flex } from './core/component/ui/Flex';
```

## 기본 사용법

```tsx
<Flex>
  <Text>아이템 1</Text>
  <Text>아이템 2</Text>
</Flex>
```

## Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `direction` | `'row' \| 'column' \| 'row-reverse' \| 'column-reverse'` | `'row'` | flex 방향 |
| `wrap` | `'wrap' \| 'nowrap' \| 'wrap-reverse'` | `'nowrap'` | flex wrap |
| `justify` | `'start' \| 'center' \| 'end' \| 'between' \| 'around' \| 'evenly'` | `'start'` | justify-content |
| `align` | `'start' \| 'center' \| 'end' \| 'stretch' \| 'baseline'` | `'stretch'` | align-items |
| `gap` | `number` | - | 아이템 간격 (픽셀) |
| `className` | `string` | - | 추가 Tailwind 클래스 |
| `style` | `ViewStyle` | - | 인라인 스타일 |

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

### 간격 (gap)

```tsx
<Flex gap={16}>
  <Text>아이템 1</Text>
  <Text>아이템 2</Text>
  <Text>아이템 3</Text>
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

## className으로 추가 스타일링

```tsx
<Flex className="p-4 bg-white rounded-lg">
  <Text>스타일이 적용된 Flex</Text>
</Flex>
```
