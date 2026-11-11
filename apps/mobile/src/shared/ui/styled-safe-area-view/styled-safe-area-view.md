# StyledSafeAreaView

`react-native-safe-area-context`의 `SafeAreaView`에 Uniwind `className`을 붙인 래퍼입니다.

## 사용법

```tsx
import { StyledSafeAreaView } from '@src/shared/ui';

<StyledSafeAreaView className="flex-1 bg-white" edges={['bottom']}>
  <ScrollView>
    <StyledSafeAreaView edges={['left', 'right']}>{children}</StyledSafeAreaView>
  </ScrollView>
</StyledSafeAreaView>;
```

`edges`는 `SafeAreaView` 그대로입니다. 같은 축을 중첩하면 두 번 패딩되므로 한 곳에만 둡니다.
네이티브 뷰라 가장 가까운 네이티브 `SafeAreaProvider`의 inset을 쓰고, JS `SafeAreaInsetsContext`로 바꾼 값(마이 탭 칸)은 보지 않습니다. 탭 안 Stack 화면의 페이지 스크롤은 `SafeAreaScrollView`를 씁니다([칸 안의 safe area](../adaptive-pane/adaptive-pane.md#칸-안의-safe-area)).
가로 safe area(iPhone Duo 세로 레일) 규칙은 [ui.md](../../../../docs/architecture/ui.md)를 따릅니다.

## 파일 구조

```
styled-safe-area-view/
├── styled-safe-area-view.ts # withUniwind(SafeAreaView)
├── styled-safe-area-view.md # 이 문서
└── index.ts            # 배럴
```
