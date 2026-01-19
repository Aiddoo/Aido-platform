# UI 컴포넌트 사용 가이드

## 컴포넌트 선택 우선순위

UI를 구현할 때 다음 우선순위를 **반드시** 따릅니다:

### 1순위: Core UI 컴포넌트 (필수)

`src/core/component/ui`에 있는 컴포넌트는 **무조건** 여기서 import합니다.

```tsx
// 올바른 사용
import { Text, H1, H2, H3, H4 } from '@/core/component/ui/Text';
import { Box } from '@/core/component/ui/Box';
import { Flex } from '@/core/component/ui/Flex';
import { HStack } from '@/core/component/ui/HStack';
import { VStack } from '@/core/component/ui/VStack';
```

### 2순위: HeroUI Native 컴포넌트

Core UI에 없는 컴포넌트는 **HeroUI Native**를 우선 사용합니다.

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

## Core UI 컴포넌트 목록

| 컴포넌트 | 용도 | 문서 |
|----------|------|------|
| `Text`, `H1`, `H2`, `H3`, `H4` | 텍스트, 헤딩 | `src/core/component/ui/Text/README.md` |
| `Box` | 단순 컨테이너 | `src/core/component/ui/Box/README.md` |
| `Flex` | Flexbox 레이아웃 | `src/core/component/ui/Flex/README.md` |
| `HStack` | 수평 레이아웃 | `src/core/component/ui/HStack/README.md` |
| `VStack` | 수직 레이아웃 | `src/core/component/ui/VStack/README.md` |

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

### 예외: 외부 컴포넌트

UniWind는 NativeWind와 달리 `cssInterop`이 없어서 외부 라이브러리 컴포넌트에는 `className`이 적용되지 않습니다.

다음 컴포넌트는 **style prop**을 사용해야 합니다:

```tsx
// SafeAreaView - className 적용 불가
import { SafeAreaView } from 'react-native-safe-area-context';

// 올바른 사용
<SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
  {children}
</SafeAreaView>

// 작동 안 함
<SafeAreaView className="flex-1 bg-white">
  {children}
</SafeAreaView>
```

---

## 금지 사항

Core UI에 있는 컴포넌트를 다른 곳에서 가져오면 안 됩니다.

```tsx
// 금지 - Core에 Text가 있으므로
import { Text, View } from 'react-native';
```
