# HStack

가로로 쌓는 `Flex`(`direction="row"` 고정)다.

## 사용법

```tsx
<HStack justify="between" align="center" gap={8}>
  <Text>제목</Text>
  <TextButton onPress={onMore}>더 보기</TextButton>
</HStack>
```

## Props

`direction`을 뺀 [`Flex`](../flex/flex.md) Props(`wrap`·`justify`·`align` + [`Box`](../box/box.md) 여백)다.
