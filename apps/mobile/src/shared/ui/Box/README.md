# Box 컴포넌트

단순한 컨테이너 컴포넌트입니다. React Native의 `View`를 래핑하며, spacing props를 지원합니다.

## 설치

이 컴포넌트는 `@aido/mobile` 앱에 포함되어 있습니다.

```tsx
import { Box } from '@src/shared/ui/Box/Box';
```

## 기본 사용법

```tsx
<Box>
  <Text>콘텐츠</Text>
</Box>
```

## Props

### 기본 Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `className` | `string` | - | Tailwind 클래스 |
| `style` | `ViewStyle` | - | 인라인 스타일 |
| `testID` | `string` | - | 테스트용 ID |

### Spacing Props

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

## 예시

### Spacing Props 사용

```tsx
<Box p={16} mb={8}>
  <Text>패딩 16px, 하단 마진 8px</Text>
</Box>

<Box px={24} py={16}>
  <Text>좌우 패딩 24px, 상하 패딩 16px</Text>
</Box>

<Box flex={1} p={16}>
  <Text>flex: 1, 전체 패딩 16px</Text>
</Box>
```

### className과 함께 사용

```tsx
<Box p={16} className="bg-white rounded-lg shadow-sm">
  <Text>카드 형태의 Box</Text>
</Box>
```

### 레이아웃 구성

```tsx
<Box flex={1}>
  <Box className="h-16 bg-primary" px={16}>
    <Text>헤더</Text>
  </Box>
  <Box flex={1} p={16}>
    <Text>본문</Text>
  </Box>
  <Box className="h-20 bg-gray-100" px={16}>
    <Text>푸터</Text>
  </Box>
</Box>
```

## 타입 상속

`Box`는 기본 spacing props를 제공하며, `Flex`, `HStack`, `VStack`이 이를 상속합니다.

```
BoxProps (spacing)
  └─ FlexProps (+ direction, wrap, justify, align)
       ├─ HStackProps
       └─ VStackProps
```
