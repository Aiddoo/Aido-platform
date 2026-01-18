# HStack 컴포넌트

수평(가로) 방향의 Flexbox 레이아웃 컴포넌트입니다. `Flex`를 `direction="row"`로 래핑합니다.

## 설치

이 컴포넌트는 `@aido/mobile` 앱에 포함되어 있습니다.

```tsx
import { HStack } from './core/component/ui/HStack';
```

## 기본 사용법

```tsx
<HStack>
  <Text>왼쪽</Text>
  <Text>오른쪽</Text>
</HStack>
```

## Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `wrap` | `'wrap' \| 'nowrap' \| 'wrap-reverse'` | `'nowrap'` | flex wrap |
| `justify` | `'start' \| 'center' \| 'end' \| 'between' \| 'around' \| 'evenly'` | `'start'` | justify-content |
| `align` | `'start' \| 'center' \| 'end' \| 'stretch' \| 'baseline'` | `'stretch'` | align-items |
| `gap` | `number` | - | 아이템 간격 (픽셀) |
| `className` | `string` | - | 추가 Tailwind 클래스 |
| `style` | `ViewStyle` | - | 인라인 스타일 |

## 예시

### 양쪽 끝 배치

```tsx
<HStack justify="between" align="center">
  <Text>제목</Text>
  <Button>버튼</Button>
</HStack>
```

### 중앙 정렬

```tsx
<HStack justify="center" gap={8}>
  <Icon name="star" />
  <Text>평점 4.5</Text>
</HStack>
```

### 간격이 있는 아이템들

```tsx
<HStack gap={12}>
  <Avatar />
  <VStack>
    <Text weight="bold">홍길동</Text>
    <Text shade={6} size="e1">개발자</Text>
  </VStack>
</HStack>
```

### 줄바꿈 (wrap)

```tsx
<HStack wrap="wrap" gap={8}>
  <Chip>React</Chip>
  <Chip>TypeScript</Chip>
  <Chip>React Native</Chip>
  <Chip>Expo</Chip>
</HStack>
```

## Flex와의 관계

`HStack`은 `Flex direction="row"`의 단축 컴포넌트입니다.

```tsx
// 동일한 결과
<HStack gap={8} align="center">...</HStack>
<Flex direction="row" gap={8} align="center">...</Flex>
```
