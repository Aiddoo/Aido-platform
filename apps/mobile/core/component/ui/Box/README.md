# Box 컴포넌트

단순한 컨테이너 컴포넌트입니다. React Native의 `View`를 래핑합니다.

## 설치

이 컴포넌트는 `@aido/mobile` 앱에 포함되어 있습니다.

```tsx
import { Box } from './core/component/ui/Box';
```

## 기본 사용법

```tsx
<Box>
  <Text>콘텐츠</Text>
</Box>
```

## Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `className` | `string` | - | Tailwind 클래스 |
| `style` | `ViewStyle` | - | 인라인 스타일 |
| `testID` | `string` | - | 테스트용 ID |

## 예시

### 스타일링

```tsx
<Box className="p-4 bg-white rounded-lg shadow-sm">
  <Text>카드 형태의 Box</Text>
</Box>
```

### 레이아웃 구성

```tsx
<Box className="flex-1">
  <Box className="h-16 bg-primary">
    <Text>헤더</Text>
  </Box>
  <Box className="flex-1 p-4">
    <Text>본문</Text>
  </Box>
  <Box className="h-20 bg-gray-100">
    <Text>푸터</Text>
  </Box>
</Box>
```

### 인라인 스타일 사용

```tsx
<Box style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
  <Text>오버레이</Text>
</Box>
```

## Flex와의 차이점

- `Box`: 단순 컨테이너, 기본 스타일 없음
- `Flex`: flexbox 레이아웃 전용, direction/justify/align/gap 등 지원

```tsx
// Box: 단순 컨테이너로 사용
<Box className="p-4">
  <Text>단순 래핑</Text>
</Box>

// Flex: 레이아웃이 필요할 때
<Flex direction="row" gap={8} align="center">
  <Icon name="check" />
  <Text>정렬된 콘텐츠</Text>
</Flex>
```
