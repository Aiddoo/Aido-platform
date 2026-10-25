# Stack 헤더

Stack 화면은 Expo Router의 **네이티브 헤더**를 씁니다. iOS가 뒤로가기·제목·버튼을 배치하므로 iPhone Duo를
접으면 세로 레일, 펼치면 가로 바, Split View에서는 바깥쪽 가장자리에 놓입니다
([Supporting iPhone Duo](https://expo.dev/blog/supporting-iphone-duo)).

헤더 버튼은 `Stack.Toolbar`의 네이티브 항목(`Stack.Toolbar.Button`, `Stack.Toolbar.Menu`)으로 둡니다.
iOS는 커스텀 뷰(`headerLeft`/`headerRight`, `Stack.Toolbar.View`)를 레일에 넣지 않습니다.
제목은 커스텀 뷰여도 됩니다(`ScreenTitleBar.Title`).

## useStackScreenOptions

배경·그림자·제목 글꼴·틴트·뒤로가기 표시를 한 번에 맞춘 screenOptions를 돌려줍니다. `header`는 덮어쓰지 않습니다.

```tsx
const screenOptions = useStackScreenOptions({ background: 'bg-white', fillContent: true });

<Stack screenOptions={screenOptions}>
  <Stack.Screen name="index" options={{ title: t('titles.index') }} />
</Stack>;
```

| 옵션          | 타입                                           | 기본값      | 설명                         |
| ------------- | ---------------------------------------------- | ----------- | ---------------------------- |
| `background`  | `'bg-gray-1' \| 'bg-white' \| 'bg-background'` | `bg-gray-1` | 헤더 배경                    |
| `fillContent` | `boolean`                                      | `false`     | 화면 배경도 같은 색으로 채움 |

## useStackBackToolbar

중첩 Stack의 첫 화면은 이전 화면이 부모 Stack에 있어 iOS가 뒤로가기를 그리지 않습니다.
같은 자리에 네이티브 뒤로가기 버튼을 두는 `Stack.Toolbar` 요소를 돌려주며, 레이아웃의 `Stack.Screen` 자식으로 넣습니다.
`Stack.Screen`은 자식 타입을 직접 읽으므로 컴포넌트로 감싸지 않고 요소를 그대로 넘깁니다.

```tsx
const backToolbar = useStackBackToolbar({ fallbackHref: '/feed' });

<Stack.Screen name="index" options={{ title: t('titles.notifications') }}>
  {backToolbar}
</Stack.Screen>;
```

`fallbackHref`는 돌아갈 화면이 없을 때(푸시·딥링크로 바로 연 경우) `router.replace`로 여는 화면입니다.

## 화면별 버튼

데이터나 폼 상태에 따라 바뀌는 버튼은 화면 컴포넌트에서 `Stack.Toolbar`를 렌더합니다. 화면에서 렌더한
오른쪽 ⋯ 메뉴는 `STACK_MORE_ICON`을 `Stack.Toolbar.Menu`의 `icon`으로 씁니다.

툴바는 레이아웃 옵션보다 우선합니다. 뒤로가기를 가로채야 하는 화면(저장 후 나가기 등)은 `STACK_BACK_ICON`으로
왼쪽 버튼을 직접 둡니다. 조건부로 보일 버튼은 렌더 여부 대신 `hidden`으로 감춥니다.

```tsx
<Stack.Toolbar placement="right">
  <Stack.Toolbar.Button
    icon={process.env.EXPO_OS === 'ios' ? 'magnifyingglass' : Search}
    accessibilityLabel={t('search.title')}
    onPress={openSearch}
  />
  <Stack.Toolbar.Button hidden={!isEditable} icon={EDIT_ICON} onPress={toggleEdit}>
    {t('list.edit')}
  </Stack.Toolbar.Button>
</Stack.Toolbar>
```

- 아이콘: iOS는 SF Symbol 이름, Android는 `@expo/material-symbols/{name}.xml`을 `process.env.EXPO_OS`로 고릅니다.
- 글자 버튼(완료·편집·저장)은 라벨을 자식으로 둡니다. Android 툴바는 라벨을 그리지 않으므로 Android에만 아이콘을 줍니다.
- `AdaptivePane` 안의 pane은 Stack 화면이 아니므로 `Stack.Toolbar`를 쓰지 않습니다(바깥 화면 헤더에 붙는다).
  pane 꼭대기는 [`ScreenTitleBar`](../screen-title-bar/screen-title-bar.md) 같은 JS 바를 씁니다.

## 파일 구조

```
stack-header/
├── use-stack-screen-options.ts   # 공통 네이티브 헤더 옵션
├── use-stack-back-toolbar.tsx    # 중첩 Stack 첫 화면의 뒤로가기
├── stack-back-icon.ts            # 플랫폼별 뒤로가기 아이콘
├── stack-header.md               # 이 문서
└── index.ts                      # 배럴
```
