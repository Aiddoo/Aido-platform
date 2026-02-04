# Input

사용자 입력을 받는 기본 Input 컴포넌트입니다.

## 사용법

```tsx
import { Input } from '@src/shared/ui/Input/Input';

// 기본
<Input placeholder="이메일을 입력하세요" />

// 라벨 + 에러
<Input
  label="이메일"
  placeholder="example@email.com"
  isInvalid
  errorMessage="이메일 형식이 올바르지 않습니다"
/>

// 좌우 콘텐츠
<Input
  label="비밀번호"
  placeholder="비밀번호를 입력하세요"
  leftContent={<LockIcon />}
  rightContent={<EyeIcon />}
/>
```

## Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `variant` | `'filled' \| 'line'` | `'filled'` | 입력 필드 스타일 |
| `size` | `'medium' \| 'large'` | `'large'` | 입력 필드 크기 |
| `label` | `string` | - | 라벨 텍스트 |
| `isDisabled` | `boolean` | `false` | 비활성화 상태 |
| `isInvalid` | `boolean` | `false` | 에러 상태 |
| `errorMessage` | `string` | - | 에러 메시지 |
| `leftContent` | `ReactNode` | - | 왼쪽 아이콘/컴포넌트 |
| `rightContent` | `ReactNode` | - | 오른쪽 아이콘/컴포넌트 |
| `className` | `string` | - | 컨테이너 추가 스타일 |
| `...TextInputProps` | - | - | `TextInput` 기본 props |

## 스타일 (variant)

### filled

배경이 채워진 기본 스타일입니다.

```tsx
<Input variant="filled" />
```

### line

하단 라인만 있는 스타일입니다.

```tsx
<Input variant="line" />
```

## 크기 (size)

| Size | 높이 | 패딩 |
|------|------|------|
| `medium` | 48px (h-12) | px-4 |
| `large` | 56px (h-14) | px-4 |

```tsx
<Input size="medium" />
<Input size="large" />
```

## 상태

### 비활성화
`isDisabled`가 `true`면 입력이 불가능하고 투명도가 적용됩니다.

```tsx
<Input isDisabled />
```

### 에러
`isInvalid`와 `errorMessage`로 에러 상태를 표시합니다.

```tsx
<Input isInvalid errorMessage="오류 메시지" />
```
