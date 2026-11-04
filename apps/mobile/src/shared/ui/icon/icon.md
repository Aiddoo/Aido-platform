# Icon

기존 SVG → createStyledIcon → Uniwind 경로를 사용한다. 탭 아이콘은 SVG 원본에서 생성한 PNG를 NativeTabs에 template 이미지로 넘긴다.

세 탭은 고양이 귀가 달린 실루엣으로 톤을 맞춘다. 할 일은 체크, 메모는 줄과 접힌 모서리, 마이는 고양이 얼굴이다. 기본 상태는 둥근 1.8px 선, 선택 상태는 채운 실루엣에서 안쪽 글리프를 비운 모양이다.

```tsx
<EditIcon width={16} height={16} colorClassName="text-gray-7" />
<NativeTabs.Trigger.Icon src={NATIVE_TAB_ICON_SOURCES.todo} renderingMode="template" />
```

| Props          | 의미                           |
| -------------- | ------------------------------ |
| width / height | 원본 SvgProps 크기             |
| colorClassName | Uniwind의 의미 색상            |
| color / 기타   | react-native-svg 원본 SvgProps |

- SVG 원본: `assets/icons/ic_tab_{todo,memo,mypage}.svg`(기본), `ic_tab_{todo,memo,mypage}_selected.svg`(선택)
- Native PNG: `assets/tab-icons/{todo,memo,mypage}{,-selected}.png` 및 @2x/@3x (투명 24/48/72 px)
- 생성·검증 목록: `scripts/tab-icon-images.mjs`
- 컴포넌트: icons.ts의 createStyledIcon 래퍼
- 이미지 source: native-tab-icons.ts의 탭별 `{ default, selected }`
- 네이티브 탭은 template tint와 앱의 의미 색상을 사용한다. 이미지는 배경 색상을 포함하지 않는다.

SVG를 변경하면 `pnpm generate:tab-icons`로 PNG를 함께 갱신하고 `pnpm check:native-icons`로 크기와 투명도를 확인한다.

## 선·채움 짝과 네이티브 헤더 아이콘

- 같은 그림의 선·채움 짝은 `ic_x.svg`(1.8px 둥근 선)·`ic_x_filled.svg`로 두고 `XIcon`·`XFilledIcon`으로 내보낸다(`HeartIcon`·`HeartFilledIcon`, `BellIcon`·`BellFilledIcon`).
- Android 네이티브 헤더(`Stack.Toolbar.Button`)는 `@expo/material-symbols` 기본(outlined)을 쓰고, 채움 같은 다른 축은 `npx add-material-symbols --fill <이름> -o assets/icons/material`로 받아 같은 폴더에 둔다. iOS는 SF Symbol 이름(`bell.badge.fill`)을 쓴다.
