# VStack 컴포넌트

수직(세로) 방향의 Flexbox 레이아웃 컴포넌트입니다. `Flex`를 `direction="column"`으로 래핑합니다.

## 설치

이 컴포넌트는 `@aido/mobile` 앱에 포함되어 있습니다.

```tsx
import { VStack } from './core/component/ui/VStack';
```

## 기본 사용법

```tsx
<VStack>
  <Text>위</Text>
  <Text>아래</Text>
</VStack>
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

### 폼 레이아웃

```tsx
<VStack gap={16}>
  <TextField label="이메일" />
  <TextField label="비밀번호" secureTextEntry />
  <Button>로그인</Button>
</VStack>
```

### 카드 콘텐츠

```tsx
<VStack gap={8} align="start">
  <Text weight="bold" size="t3">제목</Text>
  <Text shade={7}>본문 내용입니다.</Text>
  <Text shade={5} size="e1">2024년 1월 18일</Text>
</VStack>
```

### 화면 전체 레이아웃

```tsx
<VStack className="flex-1 p-4" gap={24}>
  <H1>환영합니다</H1>
  <VStack gap={16} className="flex-1">
    {/* 메인 콘텐츠 */}
  </VStack>
  <Button>시작하기</Button>
</VStack>
```

### 중앙 정렬

```tsx
<VStack className="flex-1" justify="center" align="center" gap={16}>
  <Icon name="check-circle" size={64} />
  <Text size="t2" weight="bold">완료되었습니다</Text>
</VStack>
```

## Flex와의 관계

`VStack`은 `Flex direction="column"`의 단축 컴포넌트입니다.

```tsx
// 동일한 결과
<VStack gap={16} align="center">...</VStack>
<Flex direction="column" gap={16} align="center">...</Flex>
```
