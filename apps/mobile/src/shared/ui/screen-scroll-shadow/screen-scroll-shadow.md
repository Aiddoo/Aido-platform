# ScreenScrollShadow 컴포넌트

화면 배경(`bg-white`) 위의 세로 스크롤을 감싸, 잘리는 쪽을 배경색으로 흐리게 덮는 heroui-native `ScrollShadow`입니다. 시트 안에서는 시트 면 색을 쓰는 `SheetScrollShadow`를 씁니다.

```tsx
import { ScreenScrollShadow } from '@src/shared/ui';

<ScreenScrollShadow className="flex-1">
  <ScrollView>{/* 내용 */}</ScrollView>
</ScreenScrollShadow>;
```

## 동작

- 내용이 넘치지 않으면 흐림이 보이지 않아 평소 모양 그대로다.
- 그라데이션 부품과 흐림 높이, 다크 모드에서 바뀌는 배경색을 여기서 채운다.
- 자식 스크롤의 `onScroll`은 원본 문서대로 `useAnimatedScrollHandler`로 넘긴다.

## Props

heroui-native `ScrollShadow`에서 `LinearGradientComponent`, `color`, `size`를 뺀 것과 같다(`visibility`, `isEnabled`, `className`, `style` 등).

## 파일 구조

```
screen-scroll-shadow/
├── screen-scroll-shadow.tsx
├── index.ts
└── screen-scroll-shadow.md
```
