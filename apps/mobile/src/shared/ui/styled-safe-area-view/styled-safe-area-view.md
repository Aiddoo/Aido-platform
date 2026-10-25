# StyledSafeAreaView

`react-native-safe-area-context`의 `SafeAreaView`에 Uniwind `className`을 붙인 래퍼입니다.

## 사용법

```tsx
import { StyledSafeAreaView } from '@src/shared/ui';

<StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
  <ScrollView>
    <StyledSafeAreaView edges={['left', 'right']}>{children}</StyledSafeAreaView>
  </ScrollView>
</StyledSafeAreaView>;
```

`edges`는 `SafeAreaView` 그대로입니다. 같은 축을 중첩하면 두 번 패딩되므로 한 곳에만 둡니다.
가로 safe area(iPhone Duo 세로 레일) 규칙은 `.claude/ui-components.md`를 따릅니다.

## 파일 구조

```
styled-safe-area-view/
├── styled-safe-area-view.ts # withUniwind(SafeAreaView)
├── styled-safe-area-view.md # 이 문서
└── index.ts            # 배럴
```
