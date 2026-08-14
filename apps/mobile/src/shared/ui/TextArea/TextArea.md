# TextArea

여러 줄 텍스트 입력을 받는 컴포넌트입니다.

## 사용법

```tsx
import { TextArea } from '@src/shared/ui/TextArea';

// 기본
<TextArea placeholder="내용을 입력하세요" />

// 라벨
<TextArea
  label="메시지"
  placeholder="메시지를 입력하세요"
  value={message}
  onChangeText={setMessage}
/>

// 에러 상태
<TextArea
  label="내용"
  isInvalid
  errorMessage="내용을 입력해 주세요"
/>
```

## Props

| Prop                | 타입                 | 기본값     | 설명                                                             |
| ------------------- | -------------------- | ---------- | ---------------------------------------------------------------- |
| `variant`           | `'filled' \| 'line'` | `'filled'` | 입력 필드 스타일                                                 |
| `label`             | `string`             | -          | 라벨 텍스트                                                      |
| `isDisabled`        | `boolean`            | `false`    | 비활성화 상태                                                    |
| `isInvalid`         | `boolean`            | `false`    | 에러 상태                                                        |
| `errorMessage`      | `string`             | -          | 에러 메시지 (하단 좌측)                                          |
| `className`         | `string`             | -          | 컨테이너 추가 스타일                                             |
| `...TextInputProps` | -                    | -          | `TextInput` 기본 props (`multiline`, `textAlignVertical`은 내장) |

## 스타일 (variant)

### filled

배경이 채워진 기본 스타일입니다.

```tsx
<TextArea variant="filled" />
```

### line

하단 라인만 있는 스타일입니다.

```tsx
<TextArea variant="line" />
```

## 상태

### 비활성화

`isDisabled`가 `true`면 입력이 불가능하고 투명도가 적용됩니다.

```tsx
<TextArea isDisabled />
```

### 에러

`isInvalid`와 `errorMessage`로 에러 상태를 표시합니다.

```tsx
<TextArea isInvalid errorMessage="오류 메시지" />
```

## Input과의 차이점

| 항목                     | Input                | TextArea                   |
| ------------------------ | -------------------- | -------------------------- |
| 줄 수                    | 단일 행              | 여러 줄 (`multiline` 내장) |
| 높이                     | 고정 (`h-12`/`h-14`) | 유동적 (`min-h` 사용)      |
| 크기 variant             | `medium` / `large`   | 없음                       |
| leftContent/rightContent | 지원                 | 미지원                     |

## 파일 구조

| 파일                   | 역할                                                   |
| ---------------------- | ------------------------------------------------------ |
| `TextArea.tsx`         | 여러 줄 입력 컴포넌트                                  |
| `TextArea.types.ts`    | 타입 정의 (`TextAreaProps`, `TextAreaVariant`)         |
| `TextArea.variants.ts` | Tailwind 스타일 (variant/상태)                         |
| `index.ts`             | Export: `TextArea`, `TextAreaProps`, `TextAreaVariant` |
