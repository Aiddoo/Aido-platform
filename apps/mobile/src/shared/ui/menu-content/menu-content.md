# MenuContent

heroui `Menu`의 `Portal`·`Overlay`·`Content`를 한데 묶고 앱 메뉴 겉모양(`rounded-2xl border border-gray-2 bg-gray-1`)을 입힌 팝오버 메뉴 본문. 트리거는 `Menu`·`Menu.Trigger`를 그대로 쓴다.

## 사용법

```tsx
<Menu isOpen={isOpen} onOpenChange={setIsOpen}>
  <Menu.Trigger>{/* ... */}</Menu.Trigger>
  <MenuContent width={180}>
    <MenuActionItem Icon={FlagIcon} title={t('menu.report')} onPress={report} />
  </MenuContent>
</Menu>
```

## Props

`Menu.Content`의 팝오버 props에서 `presentation`을 뺀 것이다(`width`, `placement`, `align` 등). `className`은 기본 겉모양 뒤에 합쳐진다.

## 동작

- `presentation`은 `popover`로 고정이다. 바텀시트 메뉴는 이 부품이 아니다.
- 기본 `placement="bottom"`, `align="end"`이고 `Menu.Content` props로 바꿀 수 있다.
- 안의 글자는 앱 `Text`로 넣는다(`MenuActionItem`). `Menu.ItemTitle`에 문자열을 바로 넣지 않는다.
