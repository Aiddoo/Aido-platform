# UI 컴포넌트 사용 가이드

**Version**: 1.0.0 · **Last Updated**: 2026-04-23 · **Owner**: Aido Mobile Team

> 컴포넌트 선택 우선순위: Shared UI (`@src/shared/ui`) > HeroUI Native > React Native 기본.

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
import { Button, Card, TextField } from 'heroui-native';
```

### 3순위: React Native 기본 컴포넌트 (최후의 수단)

Core UI와 HeroUI 모두에 없는 경우에만 React Native 컴포넌트를 사용합니다.

```tsx
import { ScrollView, FlatList, Image } from 'react-native';
```

---

## Shared UI 컴포넌트 목록

| 컴포넌트                                      | 용도                                                                  | 문서                                                   |
| --------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------ |
| `Text`, `H1`~`H4`                             | 텍스트, 헤딩                                                          | `src/shared/ui/Text/README.md`                         |
| `Button`                                      | 기본 버튼                                                             | `src/shared/ui/Button/Button.md`                       |
| `KeyboardAdaptiveButton`                      | 키보드 반응 버튼                                                      | `src/shared/ui/Button/Button.md`                       |
| `TextButton`                                  | 텍스트/링크 버튼                                                      | `src/shared/ui/TextButton/TextButton.md`               |
| `IconCountButton`                             | 아이콘 + 개수 버튼 (좋아요·답글·댓글)                                 | `src/shared/ui/IconCountButton/IconCountButton.md`     |
| `Input`                                       | 입력 필드                                                             | `src/shared/ui/Input/Input.md`                         |
| `BottomSheetInput`                            | BottomSheet 내부 입력 필드                                            | `src/shared/ui/Input/Input.md`                         |
| `Spacing`                                     | 간격 유틸리티                                                         | `src/shared/ui/Spacing/Spacing.md`                     |
| `Box`                                         | 단순 컨테이너                                                         | `src/shared/ui/Box/README.md`                          |
| `Flex`                                        | Flexbox 레이아웃                                                      | `src/shared/ui/Flex/README.md`                         |
| `HStack`                                      | 수평 레이아웃                                                         | `src/shared/ui/HStack/README.md`                       |
| `VStack`                                      | 수직 레이아웃                                                         | `src/shared/ui/VStack/README.md`                       |
| `Grid`                                        | 그리드 레이아웃                                                       | `src/shared/ui/Grid/README.md`                         |
| `GridItem`                                    | 그리드 아이템                                                         | `src/shared/ui/Grid/README.md`                         |
| `Result`                                      | 결과 화면 (에러, 빈 상태)                                             | `src/shared/ui/Result/Result.md`                       |
| `TextArea`                                    | 여러 줄 텍스트 입력                                                   | `src/shared/ui/TextArea/TextArea.md`                   |
| `Avatar`                                      | 선택 가능 아바타 아이콘                                               | `src/shared/ui/Avatar/Avatar.md`                       |
| `ConfirmDialog`                               | 중요 액션 확인용 다이얼로그 (cancelButton 선택적, 버튼 flex-1 자동화) | `src/shared/ui/ConfirmDialog/ConfirmDialog.md`         |
| `SettingNavigation`, `SettingNavigation.Item` | 설정 화면 섹션 그룹 + 네비게이션 아이템 (Compound Component)          | `src/shared/ui/SettingNavigation/SettingNavigation.md` |
| `KeyboardBottomSheet`                         | 키보드 연동 바텀시트 (폼용)                                           | `src/shared/ui/BottomSheet/BottomSheet.md`             |
| `BottomSheet`                                 | 키보드 불필요 바텀시트 (피커, 액션시트)                               | `src/shared/ui/BottomSheet/BottomSheet.md`             |
| `ModalBottomSheet`                            | Overlay 절대 위치 기반 바텀시트 (시트 위에 시트)                      | `src/shared/ui/BottomSheet/BottomSheet.md`             |
| `ScreenTitleBar`                              | 화면 상단 제목 바 (뒤로가기 · 제목 · 액션, 실시간 값은 subtitle)      | `src/shared/ui/ScreenTitleBar/ScreenTitleBar.md`       |

각 컴포넌트의 상세 Props와 사용 예시는 해당 README를 참조하세요.

## Wrapper Props 계약

- Shared UI나 HeroUI Native 컴포넌트를 확장할 때는 `ComponentProps<typeof Original>`을 기준으로 한다.
- wrapper가 직접 구현하는 prop만 `Omit`한다. `className`, `style`, `testID`, 접근성 prop,
  `hitSlop` 같은 원본 확장 지점을 임의로 제거하지 않는다.
- 제어형 prop 이름은 원본을 유지한다. React Native 입력은 `value/onChangeText`, HeroUI Checkbox는
  `isSelected/onSelectedChange`, overlay는 `isOpen/onOpenChange`를 사용한다.
- `Input`과 `TextArea`의 `className`은 바깥 표면, React Native `style`은 실제 `TextInput`에 전달한다.
- `condition ? <Node /> : undefined`는 condition이 boolean인 JSX 노드에서
  `condition && <Node />`로 쓸 수 있다. 숫자·문자열 조건과 함수 prop에서는 `false` 노출이나 타입
  확장을 피하기 위해 삼항식을 유지한다.

## 파일 응집도와 이름

- 공개 컴포넌트 이름은 도메인과 기반 UI를 함께 드러낸다. Card를 확장하면 `{Domain}Card.tsx`처럼 짓는다.
- `Item`, `Loading`, `Error`, `Empty`가 본체 없이는 의미가 없으면 본체 파일의 지역 컴포넌트 또는
  compound member로 둔다.
- 반복 UI는 의미 있는 작은 지역 컴포넌트로 조합한다. 필드가 독립적으로 달라질 수 있으면 짧다는
  이유만으로 배열과 `map`으로 합치지 않는다.
- 이미 존재하는 shared layout, 입력, 버튼, 날짜 유틸을 먼저 찾는다. 같은 역할의 wrapper나 util을
  다시 만들지 않는다.

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

<StyledSafeAreaView className="flex-1 bg-gray-1">{children}</StyledSafeAreaView>;
```

**새로운 외부 컴포넌트 래핑:**

```tsx
import { withUniwind } from 'uniwind';
import { SomeComponent } from 'some-library';

const StyledComponent = withUniwind(SomeComponent);

<StyledComponent className="flex-1 bg-white" />;
```

---

## 테마 색상 사용 (다크/라이트 모드)

### 필수: CSS 변수(Tailwind 클래스)만 사용

다크/라이트 모드가 제대로 작동하려면 **반드시** `global.css`에 정의된 CSS 변수를 사용해야 합니다.

**하드코딩된 색상은 테마가 변경되어도 바뀌지 않습니다!**

```tsx
// ❌ 금지 - 다크 모드에서 안 바뀜
backgroundColor: '#F5F5F5';
backgroundColor: 'white';
color: '#9CA3AF';
tabBarInactiveTintColor: '#8E8E93';

// ✅ 올바름 - 다크 모드에서 자동 변환
className = 'bg-gray-3';
className = 'bg-white';
className = 'text-gray-5';
```

### 사용 가능한 색상 변수

| 변수                           | 용도                                    |
| ------------------------------ | --------------------------------------- |
| `bg-white`                     | 카드, 섹션 배경 (다크 모드에서 #121212) |
| `bg-gray-1` ~ `bg-gray-10`     | 배경색 계열                             |
| `text-gray-1` ~ `text-gray-10` | 텍스트 색상 계열                        |
| `bg-main`, `text-main`         | 메인 브랜드 색상                        |
| `bg-error`, `text-error`       | 에러 색상                               |
| `bg-success`, `text-success`   | 성공 색상                               |
| `bg-warning`, `text-warning`   | 경고 색상                               |
| `bg-background`                | 전체 화면 배경                          |
| `bg-surface`                   | 컴포넌트 표면                           |
| `text-foreground`              | 기본 텍스트                             |
| `text-muted`                   | 보조 텍스트                             |

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
        tabBarInactiveTintColor: inactiveStyle.color as string, // ✅ 하드코딩 금지
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

| 상수                        | 값    | 용도      |
| --------------------------- | ----- | --------- |
| `ANIMATION.duration.fast`   | 150ms | 빠른 전환 |
| `ANIMATION.duration.normal` | 200ms | 일반 전환 |
| `ANIMATION.duration.slow`   | 300ms | 느린 전환 |
| `ANIMATION.delay.short`     | 50ms  | 짧은 지연 |
| `ANIMATION.delay.medium`    | 100ms | 중간 지연 |
| `ANIMATION.delay.long`      | 200ms | 긴 지연   |

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

### 3. 오버레이에 진행 중 상태를 넘기지 않기 (중요!)

`overlay.open(render)`는 **열 때의 클로저를 그대로 붙잡는다.** 부모가 다시 렌더돼도
그 클로저는 갱신되지 않으므로, 부모에서 읽어 props로 넘긴 반응형 값은 **열린 순간의
값에 얼어붙는다.** 로딩 표시가 영영 안 뜨고, 그 값으로 막던 중복 요청이 그대로 나간다.

띄우는 내용이 **자기 상태를 스스로 가져야** 한다. 콜백을 `Promise`로 받아 안에서 재고,
여는 쪽은 `mutateAsync`를 쓴다. 열 때 정해지고 변하지 않는 값(대상, 초기값)만 넘긴다.

```tsx
// ❌ 금지 - mutation.isPending이 false로 얼어붙는다
overlay.open(({ isOpen, close }) => (
  <SomeSheet
    isOpen={isOpen}
    onSubmit={(v) => mutation.mutate(v)}
    isSubmitting={mutation.isPending}
  />
));

// ✅ 올바름 - 시트가 보내는 동안을 스스로 안다
overlay.open(({ isOpen, close }) => (
  <SomeSheet
    isOpen={isOpen}
    onSubmit={async (v) => {
      const saved = await mutation.mutateAsync(v).catch(() => null);
      if (saved) close();
    }}
  />
));
```

> oxlint에는 이걸 잡을 `no-restricted-syntax`가 없어 규칙으로 강제하지 못한다.
> `useOverlay`의 JSDoc에도 같은 경고를 두었다.

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
</Suspense>;
```

### 주의사항

- `Object.assign(Component, { SubComponent })` 패턴은 **사용하지 않습니다**
- 메인 컴포넌트는 **함수 선언문**(`function`)으로 작성합니다
- 서브컴포넌트는 `Component.SubName = function SubName()` 형태로 할당합니다
