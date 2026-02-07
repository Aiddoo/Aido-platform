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

## BottomSheetInput

BottomSheet 내부에서 키보드를 제대로 처리하기 위한 Input 래퍼입니다. `@gorhom/bottom-sheet`의 `BottomSheetTextInput`을 사용하여 입력할 때 BottomSheet이 자동으로 올라갑니다.

### 사용법

```tsx
import { BottomSheetInput } from '@src/shared/ui/Input';

// BottomSheet 내부에서 사용
<BottomSheet>
  <BottomSheetInput
    label="이메일"
    placeholder="example@email.com"
  />
</BottomSheet>
```

### Props

`Input`과 **동일한 props**를 지원합니다. `InputProps`를 그대로 사용하면 됩니다.

```tsx
<BottomSheetInput
  label="할 일"
  placeholder="새 할 일을 입력하세요"
  variant="filled"
  size="large"
  isInvalid={false}
  errorMessage=""
/>
```

## 파일 구조

| 파일 | 역할 |
|------|------|
| `Input.tsx` | 기본 입력 컴포넌트 |
| `Input.types.ts` | 타입 정의 (`InputProps`, `InputInternalProps`) |
| `Input.variants.ts` | Tailwind 스타일 (variant/size/상태) |
| `BottomSheetInput.tsx` | BottomSheet용 Input 래퍼 |
| `index.ts` | Export: `Input`, `BottomSheetInput`, `InputProps`, `InputSize`, `InputVariant` |
