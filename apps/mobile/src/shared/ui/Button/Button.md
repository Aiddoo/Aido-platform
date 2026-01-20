# Button

사용자 액션을 트리거하는 버튼 컴포넌트입니다.

## 사용법

```tsx
import { Button } from '@src/shared/ui/Button/Button';

// 기본 사용 - 텍스트만
<Button>버튼</Button>

// 아이콘 + 텍스트
<Button>
  <HStack gap={8}>
    <Icon />
    <Text>버튼</Text>
  </HStack>
</Button>

// 아이콘만 (접근성을 위해 aria-label 필수)
<Button aria-label="좋아요"><HeartIcon /></Button>
```

## Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `children` | `ReactNode` | - | 버튼 내용. 문자열이면 자동으로 Text로 감싸짐 |
| `size` | `'small' \| 'medium' \| 'large' \| 'xlarge'` | `'xlarge'` | 버튼 크기 |
| `variant` | `'fill' \| 'weak'` | `'fill'` | 버튼 스타일 |
| `color` | `'primary' \| 'danger' \| 'dark'` | `'primary'` | 버튼 색상 |
| `display` | `'inline' \| 'block' \| 'full'` | `'full'` | 버튼 너비 |
| `radius` | `'sm' \| 'md' \| 'lg' \| 'full'` | `'lg'` | 모서리 둥글기 |
| `isLoading` | `boolean` | `false` | 로딩 상태 |
| `isDisabled` | `boolean` | `false` | 비활성화 상태 |
| `className` | `string` | - | 추가 스타일 |

## 크기 (size)

| Size | 높이 | 패딩 | 폰트 크기 |
|------|------|------|----------|
| `small` | 32px (h-8) | px-3 | e1 |
| `medium` | 40px (h-10) | px-4 | b4 |
| `large` | 48px (h-12) | px-5 | b4 |
| `xlarge` | 56px (h-14) | px-6 | b3 |

```tsx
<Button size="small">Small</Button>
<Button size="medium">Medium</Button>
<Button size="large">Large</Button>
<Button size="xlarge">XLarge</Button>
```

## 스타일 (variant)

### fill
배경색이 채워진 기본 스타일입니다. 텍스트는 흰색입니다.

```tsx
<Button variant="fill" color="primary">Primary</Button>
<Button variant="fill" color="danger">Danger</Button>
<Button variant="fill" color="dark">Dark</Button>
```

### weak
배경색이 연한 스타일입니다. 텍스트는 배경색과 같은 계열입니다.

```tsx
<Button variant="weak" color="primary">Primary Weak</Button>
<Button variant="weak" color="danger">Danger Weak</Button>
<Button variant="weak" color="dark">Dark Weak</Button>
```

## 너비 (display)

| Display | 설명 | CSS |
|---------|------|-----|
| `inline` | 콘텐츠 크기만큼 | `self-start` |
| `block` | 부모 컨테이너 너비에 맞게 확장 | `self-stretch` |
| `full` | 전체 너비 | `w-full` |

```tsx
<Button display="inline">Inline</Button>
<Button display="block">Block</Button>
<Button display="full">Full</Button>
```

## 상태

### 로딩 상태
`isLoading`이 `true`면 스피너가 표시되고 버튼이 비활성화됩니다.

```tsx
<Button isLoading>저장 중...</Button>
```

### 비활성화 상태
`isDisabled`가 `true`면 버튼이 비활성화되고 투명도가 적용됩니다.

```tsx
<Button isDisabled>비활성화</Button>
```

## 접근성

아이콘만 있는 버튼이나 설명이 부족한 버튼에는 `aria-label`을 추가하세요.

```tsx
// 아이콘만 있을 때
<Button aria-label="좋아요 표시"><HeartIcon /></Button>

// 추가 설명이 필요할 때
<Button aria-label="계정 삭제 - 주의 필요" color="danger">삭제</Button>

// 로딩 중 추가 정보
<Button isLoading aria-label="데이터 저장 중" />
```

## 자동 텍스트 스타일링

`children`이 문자열이면 자동으로 적절한 스타일이 적용됩니다:

- **크기**: `size` prop에 따라 폰트 크기 자동 적용
- **색상**: `variant`에 따라 텍스트 색상 자동 적용
  - `fill`: 흰색 (`text-white`)
  - `weak`: 배경색과 같은 계열 (`text-main`, `text-error`, `text-gray-9`)
- **굵기**: `semibold` 자동 적용

```tsx
// 이렇게만 써도 됩니다
<Button size="medium" variant="weak" color="primary">버튼</Button>

// 복잡한 내용은 직접 구성
<Button>
  <HStack gap={8}>
    <Icon />
    <Text weight="bold">커스텀 텍스트</Text>
  </HStack>
</Button>
```
