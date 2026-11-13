# ChoiceRadio

heroui `Radio`에 고르지 않은 원을 비운 테두리로 그리는 표시다. heroui 기본은 고르지 않은 원을 테두리 없이 입력칸 면으로 채워 같은 색 카드·시트 위에서 사라진다.
`RadioGroup.Item` 안에 두면 고름·누름·접근성은 heroui가 그대로 맡는다.

## 사용법

```tsx
import { ChoiceRadio } from '@src/shared/ui';

<RadioGroup.Item value="annual">
  <Text>연간 구독</Text>
  <ChoiceRadio />
</RadioGroup.Item>;
```

## Props

| Prop     | 타입                           | 설명                                                |
| -------- | ------------------------------ | --------------------------------------------------- |
| ...props | `ComponentProps<typeof Radio>` | `children`을 제외한 heroui `Radio` props. 원은 고정 |
