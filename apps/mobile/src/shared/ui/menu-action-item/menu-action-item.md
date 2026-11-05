# MenuActionItem

heroui `Menu` 안의 항목입니다. 아이콘은 주황색, `variant="danger"`면 빨간색입니다.

```tsx
<MenuActionItem icon={FlagIcon} title={t('menu.report')} onPress={report} />
<MenuActionItem icon={TrashIcon} title={t('actions.delete')} variant="danger" onPress={remove} />
```

- `description`은 제목 아래 한 줄입니다(예: 남은 AI 횟수).
- 네이티브 `Stack.Toolbar.Menu`의 아이콘 색은 시스템이 정합니다.
- 고르는 메뉴(`Menu.ItemIndicator`)에는 쓰지 않습니다.
