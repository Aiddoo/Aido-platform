# Checkbox

heroui-native `Checkbox`에 앱 체크박스 겉모양을 입힌 입력입니다. 앱에서는 heroui 원본 대신 이것을 씁니다.

## 사용법

```tsx
<Checkbox isSelected={isDone} onSelectedChange={setIsDone} />

<ControlField isSelected={agreed} onSelectedChange={setAgreed}>
  <ControlField.Indicator>
    <Checkbox />
  </ControlField.Indicator>
</ControlField>
```

## Props

원본에 더한 prop은 없습니다. `className`은 기본 겉모양 뒤에 합쳐지고, 선택 값은 원본의 `isSelected`·`onSelectedChange`입니다.

## 동작

- 기본 겉모양은 `size-5 rounded-md border border-main shadow-none`입니다.
- `ControlField.Indicator` 안에서는 `ControlField`가 선택 상태를 넘깁니다.
