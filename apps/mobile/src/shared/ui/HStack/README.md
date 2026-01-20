# HStack 컴포넌트

수평(가로) 방향의 Flexbox 레이아웃 컴포넌트입니다. `Flex`를 `direction="row"`로 래핑하며, `FlexProps`를 상속받아 spacing props도 지원합니다.

## 설치

이 컴포넌트는 `@aido/mobile` 앱에 포함되어 있습니다.

```tsx
import { HStack } from '@src/shared/ui/HStack/HStack';
```

## 기본 사용법

```tsx
<HStack>
  <Text>왼쪽</Text>
  <Text>오른쪽</Text>
</HStack>
```

## Props

### Flex Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
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

### Spacing Props 사용

```tsx
<HStack gap={12} px={16} py={8}>
  <Avatar />
  <VStack>
    <Text weight="bold">홍길동</Text>
    <Text shade={6} size="e1">개발자</Text>
  </VStack>
</HStack>

<HStack justify="between" p={16} mb={24}>
  <Text>왼쪽</Text>
  <Text>오른쪽</Text>
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

## 타입 상속

`HStack`은 `FlexProps`를 상속받습니다 (`direction` 제외).

```
BoxProps (spacing)
  └─ FlexProps (+ direction, wrap, justify, align)
       ├─ HStackProps (direction 제외, row 고정)
       └─ VStackProps
```
