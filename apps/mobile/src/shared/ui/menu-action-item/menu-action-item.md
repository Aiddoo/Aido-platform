# MenuActionItem

heroui `Menu` 안의 항목입니다. 아이콘은 주황색, `variant="danger"`면 아이콘과 제목이 같은 빨간색(`text-danger`)입니다. 글자는 앱 글꼴 설정을 따르도록 자식 `Text`로 넣습니다.

```tsx
<MenuActionItem Icon={FlagIcon} title={t('menu.report')} onPress={report} />
<MenuActionItem Icon={TrashIcon} title={t('actions.delete')} variant="danger" onPress={remove} />
```

- `Icon`은 그릴 아이콘 컴포넌트입니다. 크기와 색은 항목이 정합니다.
- `description`은 제목 아래 한 줄입니다(예: 남은 AI 횟수).
- 네이티브 `Stack.Toolbar.Menu`의 아이콘 색은 시스템이 정합니다.
- 고르는 메뉴(`Menu.ItemIndicator`)에는 쓰지 않습니다.
