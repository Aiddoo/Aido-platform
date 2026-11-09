# TextButton

텍스트 링크 스타일의 버튼 컴포넌트입니다. 배경 없이 텍스트만 표시됩니다. heroui `LinkButton`(ghost, 눌림은 크기 변화만) 위에 글자 크기 5단계를 얹었고, role `button`은 heroui가 넣습니다. 글자는 앱 글꼴 설정을 따르도록 자식 `Text`로 넣습니다. 비활성 투명도는 heroui 기본(0.5) 대신 `disabled:opacity-40`으로 기존 값을 지킵니다.

## 사용법

```tsx
import { TextButton } from '@src/shared/ui';

<TextButton onPress={() => {}}>더보기</TextButton>
<TextButton variant="arrow" onPress={() => {}}>자세히 보기</TextButton>
<TextButton variant="underline" onPress={() => {}}>링크</TextButton>
```

## Props

| Prop         | 타입                                                     | 기본값     | 설명          |
| ------------ | -------------------------------------------------------- | ---------- | ------------- |
| `children`   | `ReactNode`                                              | -          | 버튼 텍스트   |
| `size`       | `'xsmall' \| 'small' \| 'medium' \| 'large' \| 'xlarge'` | `'medium'` | 버튼 크기     |
| `variant`    | `'clear' \| 'underline' \| 'arrow'`                      | `'clear'`  | 버튼 스타일   |
| `isDisabled` | `boolean`                                                | `false`    | 비활성화 상태 |
| `className`  | `string`                                                 | -          | 추가 스타일   |

## 크기 (size)

| Size     | 폰트 크기 | 아이콘 크기 (arrow) |
| -------- | --------- | ------------------- |
| `xsmall` | e2        | 12px                |
| `small`  | e1        | 14px                |
| `medium` | b4        | 16px                |
| `large`  | b3        | 18px                |
| `xlarge` | b2        | 20px                |

```tsx
<TextButton size="xsmall">XSmall</TextButton>
<TextButton size="small">Small</TextButton>
<TextButton size="medium">Medium</TextButton>
<TextButton size="large">Large</TextButton>
<TextButton size="xlarge">XLarge</TextButton>
```

## 스타일 (variant)

### clear (기본)

밑줄 없는 기본 텍스트 스타일입니다.

```tsx
<TextButton variant="clear">더보기</TextButton>
```

### underline

밑줄이 있는 링크 스타일입니다.

```tsx
<TextButton variant="underline">이용약관</TextButton>
```

### arrow

오른쪽 화살표 아이콘이 붙는 스타일입니다.

```tsx
<TextButton variant="arrow">자세히 보기</TextButton>
```

## 상태

### 비활성화 상태

`isDisabled`가 `true`면 버튼이 비활성화되고 투명도가 적용됩니다.

```tsx
<TextButton isDisabled>비활성화</TextButton>
```

## 스타일

- 텍스트 색상: `shade={6}` (회색 계열)
- 터치 피드백: heroui `LinkButton`의 크기 변화

## 사용 예시

```tsx
// 로그인 화면 하단
<HStack justify="center" gap={8}>
  <TextButton onPress={() => {}}>회원가입</TextButton>
  <Separator orientation="vertical" />
  <TextButton onPress={() => {}}>이메일로 로그인</TextButton>
</HStack>

// 리스트 아이템
<ListRow
  contents={<ListRow.Texts type="1RowTypeA" top="설정" />}
  right={<TextButton variant="arrow">변경</TextButton>}
/>
```
