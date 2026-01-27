# UI 컴포넌트 사용 가이드

## 컴포넌트 선택 우선순위

UI를 구현할 때 다음 우선순위를 **반드시** 따릅니다:

### 1순위: Shared UI 컴포넌트 (필수)

`src/shared/ui`에 있는 컴포넌트는 **무조건** 여기서 import합니다.

```tsx
// 올바른 사용
import { Text, H1, H2, H3, H4 } from '@src/shared/ui/Text/Text';
import { Button } from '@src/shared/ui/Button/Button';
import { TextButton } from '@src/shared/ui/TextButton/TextButton';
import { Box } from '@src/shared/ui/Box/Box';
import { Flex } from '@src/shared/ui/Flex/Flex';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
```

### 2순위: HeroUI Native 컴포넌트

Shared UI에 없는 컴포넌트는 **HeroUI Native**를 우선 사용합니다. (Button 등 기본 컴포넌트는 Shared UI 버전을 사용하세요)

```tsx
import { Button } from '@heroui/react-native';
import { TextField } from '@heroui/react-native';
import { Card } from '@heroui/react-native';
```

### 3순위: React Native 기본 컴포넌트 (최후의 수단)

Core UI와 HeroUI 모두에 없는 경우에만 React Native 컴포넌트를 사용합니다.

```tsx
import { ScrollView, FlatList, Image } from 'react-native';
```

---

## Shared UI 컴포넌트 목록

| 컴포넌트 | 용도 | 문서 |
|----------|------|------|
| `Text`, `H1`~`H4` | 텍스트, 헤딩 | `src/shared/ui/Text/README.md` |
| `Button` | 기본 버튼 | `src/shared/ui/Button/Button.md` |
| `TextButton` | 텍스트/링크 버튼 | `src/shared/ui/TextButton/TextButton.md` |
| `Spacing` | 간격 유틸리티 | `src/shared/ui/Spacing/Spacing.md` |
| `Box` | 단순 컨테이너 | `src/shared/ui/Box/README.md` |
| `Flex` | Flexbox 레이아웃 | `src/shared/ui/Flex/README.md` |
| `HStack` | 수평 레이아웃 | `src/shared/ui/HStack/README.md` |
| `VStack` | 수직 레이아웃 | `src/shared/ui/VStack/README.md` |
| `Result` | 결과 화면 (에러, 빈 상태) | `src/shared/ui/Result/Result.md` |

각 컴포넌트의 상세 Props와 사용 예시는 해당 README를 참조하세요.

---

## 스타일링 규칙

인라인 스타일 대신 **className (Tailwind)** 을 사용합니다.

```tsx
// 올바른 사용
<VStack className="flex-1 p-4 bg-white">
  <Text className="mt-2">콘텐츠</Text>
</VStack>

// 지양 - 인라인 스타일
<VStack style={{ flex: 1, padding: 16, backgroundColor: 'white' }}>
  <Text style={{ marginTop: 8 }}>콘텐츠</Text>
</VStack>
```

### 외부 컴포넌트: withUniwind로 래핑

외부 라이브러리 컴포넌트에 `className`을 사용하려면 `withUniwind`로 감싸야 합니다.

> 참고: https://docs.uniwind.dev/api/with-uniwind

**이미 래핑된 컴포넌트:**

```tsx
// StyledSafeAreaView - withUniwind로 래핑됨
import { StyledSafeAreaView } from '@src/shared/ui/SafeAreaView/SafeAreaView';

<StyledSafeAreaView className="flex-1 bg-gray-1">
  {children}
</StyledSafeAreaView>
```

**새로운 외부 컴포넌트 래핑:**

```tsx
import { withUniwind } from 'uniwind';
import { SomeComponent } from 'some-library';

const StyledComponent = withUniwind(SomeComponent);

<StyledComponent className="flex-1 bg-white" />
```

---

## 테마 색상 사용

### className으로 색상 적용 (권장)

```tsx
<Text className="text-gray-6">텍스트</Text>
<View className="bg-main" />
```

### JS에서 색상값이 필요한 경우: useResolveClassNames

Tabs의 `tintColor`처럼 **실제 색상 문자열**이 필요할 때 사용합니다.

> 참고: https://docs.uniwind.dev/theming/global-css

```tsx
import { useResolveClassNames } from 'uniwind';

function MyComponent() {
  const activeStyle = useResolveClassNames('text-main');
  const borderStyle = useResolveClassNames('border-gray-2');

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeStyle.color as string,
        tabBarStyle: { borderTopColor: borderStyle.borderColor as string },
      }}
    />
  );
}
```

### SVG 아이콘 색상: createStyledIcon

SVG 아이콘에 `colorClassName`으로 색상을 적용하려면 `createStyledIcon`으로 래핑합니다.

```tsx
import { ArrowRightIcon } from '@src/shared/ui/Icon';

// colorClassName으로 색상 적용 (width/height도 지원)
<ArrowRightIcon colorClassName="accent-gray-6" width={24} height={24} />

// color prop도 그대로 사용 가능
<ArrowRightIcon color="#999999" width={24} height={24} />
```

**새 아이콘 추가 시:**

```tsx
// src/shared/ui/Icon/icons.ts에 추가
import NewIconSvg from '@assets/icons/ic_new.svg';
import { createStyledIcon } from './createStyledIcon';

export const NewIcon = createStyledIcon(NewIconSvg);
```

---

## 금지 사항

Shared UI에 있는 컴포넌트를 다른 곳에서 가져오면 안 됩니다.

```tsx
// 금지 - Shared UI에 Text가 있으므로
import { Text, View } from 'react-native';
```

---

## Compound Component 패턴

Loading 상태 등 서브컴포넌트가 있는 경우 **Named Function 패턴**을 사용합니다.

```tsx
// 메인 컴포넌트 - 함수 선언문 사용
export function MyComponent() {
  // ...
}

// 서브컴포넌트 할당
MyComponent.Loading = function Loading() {
  // ...
};

// 사용 예시
<Suspense fallback={<MyComponent.Loading />}>
  <MyComponent />
</Suspense>
```

### 주의사항

- `Object.assign(Component, { SubComponent })` 패턴은 **사용하지 않습니다**
- 메인 컴포넌트는 **함수 선언문**(`function`)으로 작성합니다
- 서브컴포넌트는 `Component.SubName = function SubName()` 형태로 할당합니다
