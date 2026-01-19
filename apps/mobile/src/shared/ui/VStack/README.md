# VStack 컴포넌트

수직(세로) 방향의 Flexbox 레이아웃 컴포넌트입니다. `Flex`를 `direction="column"`으로 래핑하며, `FlexProps`를 상속받아 spacing props도 지원합니다.

## 설치

이 컴포넌트는 `@aido/mobile` 앱에 포함되어 있습니다.

```tsx
import { VStack } from '@src/core/component/ui/VStack';
```

## 기본 사용법

```tsx
<VStack>
  <Text>위</Text>
  <Text>아래</Text>
</VStack>
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

### 폼 레이아웃

```tsx
<VStack gap={16} px={24}>
  <TextField label="이메일" />
  <TextField label="비밀번호" secureTextEntry />
  <Button>로그인</Button>
</VStack>
```

### 카드 콘텐츠

```tsx
<VStack gap={8} align="start" p={16}>
  <Text weight="bold" size="t3">제목</Text>
  <Text shade={7}>본문 내용입니다.</Text>
  <Text shade={5} size="e1">2024년 1월 18일</Text>
</VStack>
```

### Spacing Props 사용

```tsx
<VStack flex={1} px={24} py={16} gap={12}>
  <Text>아이템 1</Text>
  <Text>아이템 2</Text>
  <Text>아이템 3</Text>
</VStack>

<VStack gap={16} p={16} mb={24}>
  <Text>패딩과 마진이 적용된 VStack</Text>
</VStack>
```

### 화면 전체 레이아웃

```tsx
<VStack flex={1} p={16} gap={24}>
  <Text size="t1" weight="bold">환영합니다</Text>
  <VStack gap={16} flex={1}>
    {/* 메인 콘텐츠 */}
  </VStack>
  <Button>시작하기</Button>
</VStack>
```

### 중앙 정렬

```tsx
<VStack flex={1} justify="center" align="center" gap={16}>
  <Icon name="check-circle" size={64} />
  <Text size="t2" weight="bold">완료되었습니다</Text>
</VStack>
```

## Flex와의 관계

`VStack`은 `Flex direction="column"`의 단축 컴포넌트입니다.

```tsx
// 동일한 결과
<VStack gap={16} align="center" px={24}>...</VStack>
<Flex direction="column" gap={16} align="center" px={24}>...</Flex>
```

## 타입 상속

`VStack`은 `FlexProps`를 상속받습니다 (`direction` 제외).

```
BoxProps (spacing)
  └─ FlexProps (+ direction, wrap, justify, align)
       ├─ HStackProps (direction 제외, row 고정)
       └─ VStackProps (direction 제외, column 고정)
```
