# Button

사용자 액션을 트리거하는 버튼 컴포넌트입니다.

heroui `Button`(`feedbackVariant="scale"`) 위에 앱의 높이 4종, 색, `isLoading`을 얹은 얇은 확장이다. role `button`과 `accessibilityState.disabled`는 heroui가 넣는다. 크기·색·모서리는 `className`이 heroui 기본 클래스를 덮는다(Uniwind는 같은 우선순위면 뒤에 온 클래스가 이긴다). 눌림은 기존과 같은 옅은 회색 하이라이트이고, 비활성은 회색 면 + 글자 흐림이라 heroui의 비활성 투명도는 `disabled:opacity-100`으로 끈다.

문자열 글자는 폭이 정해진 버튼(`block`·`full`)에서 버튼 폭을 모두 쓰고 가운데 맞춘다(`flex-1`). 글자 폭에 꼭 맞춘 칸은 Android가 큰 글꼴에서 마지막 글자를 다음 줄로 넘기고, 버튼의 고정 높이가 그 줄을 가려 글자가 잘려 보인다. `inline`은 버튼 폭이 곧 글자 폭이라 그대로다.

## 사용법

```tsx
import { Button } from '@src/shared/ui';

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

## KeyboardAdaptiveButton

키보드 상태에 따라 하단 버튼의 여백과 모서리를 자동으로 조정하는 컴포넌트입니다.

### 사용법

```tsx
import { KeyboardAdaptiveButton } from '@src/shared/ui';

<KeyboardAdaptiveButton onPress={handleSubmit}>회원가입</KeyboardAdaptiveButton>;
```

### 동작 방식

- 키보드 닫힘: 좌우 패딩과 하단 안전영역 여백 적용, 둥근 모서리
- 키보드 열림: 패딩 제거, 하단에 꽉 차는 직사각형 버튼
- 가로 safe area(iPhone Duo 세로 레일)는 키보드 상태와 무관하게 항상 비운다. 그래서 부모에 가로 `SafeAreaView`를 두지 않는다
- `FormScrollView`·`FormStepLayout`의 `footer`로 넘긴다. 버튼이 키보드가 열렸을 때의 제 높이를 알리고, 레이아웃이 포커스한 칸 전체를 그 위로 올린다

## Props

| Prop         | 타입                                         | 기본값      | 설명                                         |
| ------------ | -------------------------------------------- | ----------- | -------------------------------------------- |
| `children`   | `ReactNode`                                  | -           | 버튼 내용. 문자열이면 자동으로 Text로 감싸짐 |
| `size`       | `'small' \| 'medium' \| 'large' \| 'xlarge'` | `'xlarge'`  | 버튼 크기                                    |
| `variant`    | `'fill' \| 'weak'`                           | `'fill'`    | 버튼 스타일                                  |
| `color`      | `'primary' \| 'danger' \| 'dark'`            | `'primary'` | 버튼 색상                                    |
| `display`    | `'inline' \| 'block' \| 'full'`              | `'full'`    | 버튼 너비                                    |
| `radius`     | `'sm' \| 'md' \| 'lg' \| 'full'`             | `'lg'`      | 모서리 둥글기                                |
| `isLoading`  | `boolean`                                    | `false`     | 로딩 상태                                    |
| `isDisabled` | `boolean`                                    | `false`     | 비활성화 상태                                |
| `className`  | `string`                                     | -           | 추가 스타일                                  |

## 크기 (size)

| Size     | 높이        | 패딩 | 폰트 크기 |
| -------- | ----------- | ---- | --------- |
| `small`  | 32px (h-8)  | px-3 | e1        |
| `medium` | 40px (h-10) | px-4 | b4        |
| `large`  | 48px (h-12) | px-5 | b4        |
| `xlarge` | 56px (h-14) | px-6 | b3        |

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

| Display  | 설명                           | CSS            |
| -------- | ------------------------------ | -------------- |
| `inline` | 콘텐츠 크기만큼                | 없음           |
| `block`  | 부모 컨테이너 너비에 맞게 확장 | `self-stretch` |
| `full`   | 전체 너비                      | `w-full`       |

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

`isDisabled`가 `true`면 버튼이 비활성화되고 면이 회색으로, 글자가 흐리게 바뀝니다.

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
<Button isLoading aria-label="데이터 저장 중">저장</Button>
```

## 글자 스타일

`children`이 문자열이면 `size`의 글꼴, `variant`의 색(`fill`은 흰색·다크는 `text-gray-9`, `weak`는 같은 계열 `text-main`·`text-error`·`text-gray-9`), `semibold`를 자동으로 붙인다. 아이콘과 글자를 섞을 때는 `HStack`과 `Text`로 직접 구성한다.
