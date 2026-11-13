# SafeAreaScrollView 컴포넌트

스크롤바와 배경은 칸 끝까지 두고, 내용만 가로·아래 safe area inset을 피하는 `ScrollView`입니다. [Expo iPhone Duo 안내](https://expo.dev/blog/supporting-iphone-duo)의 "스크롤뷰가 아니라 스크롤 내용에 inset"을 따릅니다.

```tsx
import { SafeAreaScrollView } from '@src/shared/ui';

<SafeAreaScrollView className="flex-1 bg-white">
  <ReadableContent className="px-4 pb-4 pt-5">{children}</ReadableContent>
</SafeAreaScrollView>;
```

## 동작

- inset은 가장 가까운 `SafeAreaInsetsContext`(`useSafeAreaInsets`)에서 읽어 `contentContainerStyle`의 padding으로 준다(`getSafeAreaPadding`). 마이 탭 칸처럼 context로만 inset을 넘기는 곳에서도 그 칸 값이 맞다. 네이티브 `SafeAreaView`는 이 context를 보지 못한다([adaptive-pane.md](../adaptive-pane/adaptive-pane.md#칸-안의-safe-area)).
- 아래 inset이 내용 끝에 붙어 내용이 홈 인디케이터·탭 바 밑까지 스크롤된다. 스크롤바는 `scrollIndicatorInsets`로 그 위에서 멈춘다.
- 위 inset은 주지 않는다. Stack 화면은 불투명 네이티브 헤더 아래에서 시작한다.
- iOS 자동 inset(`contentInsetAdjustmentBehavior`)은 `never`다. 같은 아래 inset을 두 번 주지 않는다.
- 내용 여백은 안쪽 `Box`·`ReadableContent`의 className으로 준다. `contentContainerClassName`의 padding은 inset padding과 겹쳐 어느 쪽이 남을지 알 수 없다.

## Props

RN `ScrollView`와 같다(`ref` 포함). `contentContainerStyle`은 inset padding 뒤에 합쳐진다.
