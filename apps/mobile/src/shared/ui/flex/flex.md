# Flex

`Box`에 `direction`·`wrap`·`justify`·`align`을 더한 flex 틀이다. 화면과 기능에서는 `HStack`(가로)·`VStack`(세로)을 쓰고, 방향이 값으로 바뀌어야 하는 곳만 `Flex`를 직접 쓴다. 창 폭에 따라 `HStack`과 `VStack`을 바꿔 끼우면 자식이 다시 마운트되기 때문이다(`voice-note-recorder.tsx`의 파형·자막, `calendar-title-bar.tsx`의 보기 전환 탭).

## 사용법

```tsx
<Flex direction={isCompact ? 'column' : 'row'} flex={1} gap={isCompact ? 12 : 20}>
  {children}
</Flex>
```

## Props

[`Box`](../box/box.md) Props를 펼친다.

| Prop        | 값                                                           | 기본      |
| ----------- | ------------------------------------------------------------ | --------- |
| `direction` | `row` · `column` · `row-reverse` · `column-reverse`          | `row`     |
| `wrap`      | `wrap` · `nowrap` · `wrap-reverse`                           | `nowrap`  |
| `justify`   | `start` · `center` · `end` · `between` · `around` · `evenly` | `start`   |
| `align`     | `start` · `center` · `end` · `stretch` · `baseline`          | `stretch` |

## 동작

네 prop은 `flex.variants.ts`의 클래스(`flex-row`, `justify-between` 등)가 되고 `className` 앞에 붙는다.
