# ViewTabs

`heroui-native`의 `Tabs`에 보기 스키마를 더한 부품입니다. `Tabs`의 `value`, `onValueChange`는 `string`이라 틀린 값이 컴파일을 지나갑니다. `ViewTabs`는 둘을 스키마의 값 타입으로 좁히고, 탭이 준 값을 검증해 아는 값만 넘깁니다. 나머지 Props와 안쪽 `Tabs.List`, `Tabs.Indicator`, `Tabs.Content`는 원본과 같습니다.

```tsx
const [view, setView] = useView('view', invitedFriendsViewSchema);

<ViewTabs schema={invitedFriendsViewSchema} value={view} onValueChange={setView} variant="primary">
  <Tabs.List>
    <Tabs.Indicator />
    <SegmentTabTrigger value="all">{t('tab.all')}</SegmentTabTrigger>
    <SegmentTabTrigger value="waiting">{t('tab.waiting')}</SegmentTabTrigger>
  </Tabs.List>
</ViewTabs>;
```

| Prop            | 타입                          | 설명                                     |
| --------------- | ----------------------------- | ---------------------------------------- |
| `schema`        | `.catch`가 붙은 문자열 스키마 | `useView`에 넘긴 모듈 상수와 같은 스키마 |
| `value`         | 스키마의 출력 타입            | 지금 보기                                |
| `onValueChange` | `(view) => void`              | 스키마가 아는 값일 때만 불린다           |

다른 탭으로 바뀌면 `view_tab_changed { screen_name, view }`를 남깁니다. 고른 탭을 다시 누르면 남기지 않습니다.

**검증은 `.catch`를 벗긴 스키마로 합니다.** `.catch`가 있는 채로 `safeParse`하면 모르는 값도 기본값으로 성공해, 잘못된 탭이 조용히 첫 탭으로 바뀝니다. `ViewTabs`는 `schema.unwrap()`으로 검증해 모르는 값을 버립니다. `.catch`가 없는 스키마는 타입에서 거절합니다.

**URL에 없는 탭**(언어 선택처럼 `useState`나 저장소 값)은 원본 `Tabs`를 그대로 씁니다. 로딩 자리처럼 바꾸지 않는 탭도 `Tabs`입니다.
