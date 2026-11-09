# ChoiceRadio

heroui `Radio`에 고르지 않은 원을 비운 테두리로 그리는 표시다. heroui 기본은 고르지 않은 원을 입력칸 바탕색으로 채워 다크 테마에서 고른 것처럼 보인다.
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

## 파일 구조

```
choice-radio/
├── choice-radio.tsx
├── choice-radio.md
└── index.ts
```
