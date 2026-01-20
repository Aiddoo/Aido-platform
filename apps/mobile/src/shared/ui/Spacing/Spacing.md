# Spacing

컴포넌트 사이에 고정 간격을 추가하는 유틸리티 컴포넌트입니다.

## 사용법

```tsx
import { Spacing } from '@src/shared/ui/Spacing/Spacing';

// 세로 간격 (기본)
<Spacing size={16} />

// 가로 간격
<Spacing size={8} direction="horizontal" />
```

## Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `size` | `number` | - | 간격 크기 (px) |
| `direction` | `'vertical' \| 'horizontal'` | `'vertical'` | 간격 방향 |

## 예시

### 세로 간격

```tsx
<VStack>
  <Text>첫 번째</Text>
  <Spacing size={16} />
  <Text>두 번째</Text>
</VStack>
```

### 가로 간격

```tsx
<HStack>
  <Button>취소</Button>
  <Spacing size={8} direction="horizontal" />
  <Button>확인</Button>
</HStack>
```

## 언제 사용하나요?

- `gap`으로 해결되지 않는 **불규칙한 간격**이 필요할 때
- 특정 요소 사이에만 **다른 간격**을 적용할 때
- 조건부로 간격을 추가/제거할 때

```tsx
// gap으로 충분한 경우 - Spacing 불필요
<VStack gap={16}>
  <Item />
  <Item />
  <Item />
</VStack>

// 불규칙한 간격 - Spacing 사용
<VStack>
  <Title />
  <Spacing size={24} />
  <Description />
  <Spacing size={16} />
  <Button />
</VStack>
```
