# ScrollFade

세로 스크롤의 잘리는 쪽을 배경색으로 흐리게 덮는 heroui-native `ScrollShadow`. 흐림 색을 스크롤이 놓인 면에 맞춘다.

## 사용법

```tsx
<ScrollFade surface="screen" className="flex-1">
  <ScrollView>{/* 내용 */}</ScrollView>
</ScrollFade>
```

## Props

| prop      | 타입                  | 설명                                                            |
| --------- | --------------------- | --------------------------------------------------------------- |
| `surface` | `'screen' \| 'sheet'` | 화면은 `bg-white`, 시트는 `bg-white`(다크 `bg-gray-1`)로 흐린다 |

`ScrollShadow`에서 `LinearGradientComponent`·`color`·`size`를 뺀 나머지는 `...props`다.

## 동작

- 내용이 넘치지 않으면 흐림이 보이지 않는다.
- 흐림 높이는 32다.
- 자식 스크롤의 `onScroll`은 원본 문서대로 `useAnimatedScrollHandler`로 넘긴다.
