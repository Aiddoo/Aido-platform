# TimeSpinner

시각(시와 분)을 고르는 부품. iOS는 휠 `TimeSpinner`, Android는 시스템 대화상자 `openAndroidTimePicker()`다. 설정 알림 시각과 할 일 시간이 같은 부품을 써서 피커 날짜·언어·12/24시간 처리를 한 곳에 둔다.

## 사용법

```tsx
<Box className="items-center">
  <TimeSpinner value={draft} onChange={setDraft} timeFormat={timeFormat} minimum={minimumTime} />
</Box>;

const picked = await openAndroidTimePicker({ value, timeFormat });
if (picked != null) {
  onChange(picked);
}
```

## Props

| prop         | 타입                         | 설명                                            |
| ------------ | ---------------------------- | ----------------------------------------------- |
| `value`      | `TimeOfDay`                  | 휠에 보일 시와 분                               |
| `onChange`   | `(value: TimeOfDay) => void` | 휠을 돌릴 때마다 고른 시와 분                   |
| `timeFormat` | `TimeFormat`                 | 오전/오후 휠 여부와 언어(`getTimePickerLocale`) |
| `minimum`    | `TimeOfDay`                  | 이보다 이른 시각은 휠이 막는다                  |
| `maximum`    | `TimeOfDay`                  | 이보다 늦은 시각은 휠이 막는다                  |

나머지는 `...props`(iOS `DateTimePicker`에서 값·모드·언어·범위를 뺀 것)다. 높이는 216pt로 고정이다.

`openAndroidTimePicker({ value, timeFormat })`는 고르면 그 시각, 닫거나 열지 못하면 `null`이다.

## 동작

- 피커와는 시와 분만 주고받는다. 피커에 넘기는 날짜는 서머타임 전환이 없는 고정 날짜(`toPickerDate`)이고 돌려받은 날짜에서 기기 시간대의 시와 분만 읽는다. 할 일 날짜나 오늘에 시각을 얹으면 전환일에 02:30이 03:30으로 밀린다.
- 앱 시간대를 쓰지 않는다. 휠은 기기 시간대로 그리고 읽으므로 둘 다 기기 기준이어야 시각이 바뀌지 않는다.
- Android 시스템 대화상자는 범위를 받지 않는다. 범위가 있는 입력(알림 시각)은 고른 뒤 호출부가 확인하고 벗어나면 안내한다.
- 언어는 앱 언어를 따르고, 24시간 형식이면 오전/오후 휠이 없는 언어로 연다.
