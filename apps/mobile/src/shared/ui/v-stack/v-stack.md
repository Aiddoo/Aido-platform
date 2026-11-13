# VStack

세로로 쌓는 `Flex`(`direction="column"` 고정)다. 제목과 보조 글처럼 한 덩어리 안 글줄 사이는 `gap={2}`가 흔하다([간격](../../../../docs/design.md#간격)).

## 사용법

```tsx
<VStack gap={2}>
  <Text size="b2" weight="bold">
    {title}
  </Text>
  <Text size="e1" shade={5}>
    {description}
  </Text>
</VStack>
```

## Props

`direction`을 뺀 [`Flex`](../flex/flex.md) Props(`wrap`·`justify`·`align` + [`Box`](../box/box.md) 여백)다.
