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
| `KeyboardAdaptiveButton` | 키보드 반응 버튼 | `src/shared/ui/Button/Button.md` |
| `TextButton` | 텍스트/링크 버튼 | `src/shared/ui/TextButton/TextButton.md` |
| `Input` | 입력 필드 | `src/shared/ui/Input/Input.md` |
| `BottomSheetInput` | BottomSheet 내부 입력 필드 | `src/shared/ui/Input/Input.md` |
| `Spacing` | 간격 유틸리티 | `src/shared/ui/Spacing/Spacing.md` |
| `Box` | 단순 컨테이너 | `src/shared/ui/Box/README.md` |
| `Flex` | Flexbox 레이아웃 | `src/shared/ui/Flex/README.md` |
| `HStack` | 수평 레이아웃 | `src/shared/ui/HStack/README.md` |
| `VStack` | 수직 레이아웃 | `src/shared/ui/VStack/README.md` |
| `Grid` | 그리드 레이아웃 | `src/shared/ui/Grid/README.md` |
| `GridItem` | 그리드 아이템 | `src/shared/ui/Grid/README.md` |
| `Result` | 결과 화면 (에러, 빈 상태) | `src/shared/ui/Result/Result.md` |
| `TextArea` | 여러 줄 텍스트 입력 | `src/shared/ui/TextArea/TextArea.md` |
| `Avatar` | 선택 가능 아바타 아이콘 | `src/shared/ui/Avatar/Avatar.md` |
| `ConfirmDialog` | 중요 액션 확인용 다이얼로그 (cancelButton 선택적, 버튼 flex-1 자동화) | `src/shared/ui/ConfirmDialog/ConfirmDialog.md` |


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

### 조건부 className: cn 유틸리티 사용

조건에 따라 className을 조합할 때 **반드시** `cn` 유틸리티를 사용합니다. 템플릿 리터럴로 직접 조합하지 않습니다.

```tsx
import { cn } from '@src/shared/utils/cn';

// ✅ 올바름 - cn 사용
<View className={cn('rounded-full', isSelected && 'border-2')} />
<View className={cn('w-8 h-8', isActive ? 'bg-main' : 'bg-gray-3')} />

// ❌ 금지 - 템플릿 리터럴 직접 조합
<View className={`rounded-full ${isSelected ? 'border-2' : ''}`} />
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

## 테마 색상 사용 (다크/라이트 모드)

### 필수: CSS 변수(Tailwind 클래스)만 사용

다크/라이트 모드가 제대로 작동하려면 **반드시** `global.css`에 정의된 CSS 변수를 사용해야 합니다.

**하드코딩된 색상은 테마가 변경되어도 바뀌지 않습니다!**

```tsx
// ❌ 금지 - 다크 모드에서 안 바뀜
backgroundColor: '#F5F5F5'
backgroundColor: 'white'
color: '#9CA3AF'
tabBarInactiveTintColor: '#8E8E93'

// ✅ 올바름 - 다크 모드에서 자동 변환
className="bg-gray-3"
className="bg-white"
className="text-gray-5"
```

### 사용 가능한 색상 변수

| 변수 | 용도 |
|------|------|
| `bg-white` | 카드, 섹션 배경 (다크 모드에서 #121212) |
| `bg-gray-1` ~ `bg-gray-10` | 배경색 계열 |
| `text-gray-1` ~ `text-gray-10` | 텍스트 색상 계열 |
| `bg-main`, `text-main` | 메인 브랜드 색상 |
| `bg-error`, `text-error` | 에러 색상 |
| `bg-success`, `text-success` | 성공 색상 |
| `bg-warning`, `text-warning` | 경고 색상 |
| `bg-background` | 전체 화면 배경 |
| `bg-surface` | 컴포넌트 표면 |
| `text-foreground` | 기본 텍스트 |
| `text-muted` | 보조 텍스트 |

### className으로 색상 적용 (권장)

```tsx
<Text className="text-gray-6">텍스트</Text>
<View className="bg-main" />
<View className="bg-white rounded-2xl" />  // 다크 모드에서 자동 변환
```

### JS에서 색상값이 필요한 경우: useResolveClassNames

Tabs의 `tintColor`처럼 **실제 색상 문자열**이 필요할 때 사용합니다.

> 참고: https://docs.uniwind.dev/theming/global-css

```tsx
import { useResolveClassNames } from 'uniwind';

function MyComponent() {
  const activeStyle = useResolveClassNames('text-main');
  const inactiveStyle = useResolveClassNames('text-gray-6');
  const borderStyle = useResolveClassNames('border-gray-2');

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeStyle.color as string,
        tabBarInactiveTintColor: inactiveStyle.color as string,  // ✅ 하드코딩 금지
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

## 애니메이션 상수

React Native Reanimated 애니메이션에서 duration, delay 값은 **반드시** `ANIMATION` 상수를 사용합니다.

```tsx
import { ANIMATION } from '@src/shared/constants/animation.constants';

// ✅ 올바름
withTiming(value, { duration: ANIMATION.duration.slow });
withTiming(value, { duration: ANIMATION.duration.normal });
withDelay(ANIMATION.delay.short, withTiming(...));

// ❌ 금지 - 매직 넘버 하드코딩
withTiming(value, { duration: 300 });
withTiming(value, { duration: 200 });
```

| 상수 | 값 | 용도 |
|------|-----|------|
| `ANIMATION.duration.fast` | 150ms | 빠른 전환 |
| `ANIMATION.duration.normal` | 200ms | 일반 전환 |
| `ANIMATION.duration.slow` | 300ms | 느린 전환 |
| `ANIMATION.delay.short` | 50ms | 짧은 지연 |
| `ANIMATION.delay.medium` | 100ms | 중간 지연 |
| `ANIMATION.delay.long` | 200ms | 긴 지연 |

---

## 금지 사항

### 1. 색상 하드코딩 금지 (중요!)

**다크/라이트 모드 지원을 위해 색상은 반드시 Tailwind 클래스를 사용해야 합니다.**

```tsx
// ❌ 금지 - 다크 모드에서 안 바뀜
backgroundColor: '#F5F5F5'
backgroundColor: 'white'
color: '#9CA3AF'
style={{ backgroundColor: 'white' }}

// ✅ 올바름
className="bg-gray-3"
className="bg-white"
className="text-gray-5"
```

### 2. Shared UI 컴포넌트 중복 import 금지

Shared UI에 있는 컴포넌트를 다른 곳에서 가져오면 안 됩니다.

```tsx
// ❌ 금지 - Shared UI에 Text가 있으므로
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
