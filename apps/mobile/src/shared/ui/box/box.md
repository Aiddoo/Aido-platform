# Box

`View`에 여백 prop을 더한 가장 작은 틀이다. `Flex`·`HStack`·`VStack`·`Grid`·`GridItem`이 이 prop을 이어받는다.

## 사용법

```tsx
<Box flex={1} px={16}>
  <Text>본문</Text>
</Box>
```

## Props

`ViewProps`(+ `ref`)를 펼친다. 더한 것은 여백 숫자(px)다.

| Prop                                    | 스타일        |
| --------------------------------------- | ------------- |
| `flex`, `gap`                           | `flex`, `gap` |
| `p`, `px`, `py`, `pt`, `pb`, `pl`, `pr` | `padding*`    |
| `m`, `mx`, `my`, `mt`, `mb`, `ml`, `mr` | `margin*`     |

## 동작

- 값은 [간격 규격](../../../../docs/design.md#간격) 안의 숫자다(`aido/spacing-scale`). `className`이 있는 태그는 여백도 클래스로 쓰고(`aido/spacing-props-with-classname`, `gap`·`flex`는 예외), 형제끼리는 한 표기로 맞춘다(`aido/one-spacing-notation`).
- 컴포넌트 루트에 `m*`를 두지 않는다. 바깥 간격은 부모의 `gap`·`<Spacing>`이 정한다.
- 넘기지 않은 prop은 스타일에 넣지 않고(`omitBy`), 여백 스타일 뒤에 `style`을 덧붙인다.
