# TabTrigger

`heroui-native`의 `Tabs` 안에 넣는 글자 탭입니다. 글자는 자식 `<Text>`로 넣어 앱 글꼴과 글꼴 크기 설정을 따릅니다.

| 컴포넌트            | 놓는 곳                    | 모양                                    |
| ------------------- | -------------------------- | --------------------------------------- |
| `LineTabTrigger`    | `Tabs variant="secondary"` | `py-3`, `b3`, 선택하면 브랜드 색과 굵게 |
| `SegmentTabTrigger` | `Tabs variant="primary"`   | `b4`, 선택하면 진한 글자와 굵게         |

```tsx
<Tabs value={view} onValueChange={handleChange} variant="secondary">
  <Tabs.List className="border-b border-gray-2 w-full">
    <Tabs.Indicator className="h-[2px]" />
    <LineTabTrigger value="friends">{t('tabs.friends')}</LineTabTrigger>
    <LineTabTrigger value="sent">{t('tabs.sent')}</LineTabTrigger>
  </Tabs.List>
</Tabs>
```

Props는 `Tabs.Trigger`와 같습니다. `children`은 글자이고 `className`은 받지 않습니다.
