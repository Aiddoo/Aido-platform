# Icon

기존 SVG → createStyledIcon → Uniwind 경로를 사용한다. TodoTabIcon, MemoTabIcon, MyPageTabIcon은 같은 원본에서 NativeTabs용 PNG도 생성한다.

할 일은 체크리스트, 메모는 접힌 종이와 연필, 마이는 웃는 사람의 실루엣이다. 동일한 둥근 1.8px 선으로 톤을 맞추고, 형태는 각 기능을 구분하도록 유지한다.

```tsx
<TodoTabIcon width={24} height={24} colorClassName="text-main" />
<NativeTabs.Trigger.Icon src={NATIVE_TAB_ICON_SOURCES.todo} renderingMode="template" />
```

| Props          | 의미                           |
| -------------- | ------------------------------ |
| width / height | 원본 SvgProps 크기             |
| colorClassName | Uniwind의 의미 색상            |
| color / 기타   | react-native-svg 원본 SvgProps |

- SVG 원본: assets/icons/ic_tab_*.svg
- Native PNG: assets/tab-icons/{todo,memo,mypage}.png 및 @2x/@3x (투명 24/48/72 px)
- 컴포넌트: icons.ts의 createStyledIcon 래퍼
- 이미지 source: native-tab-icons.ts
- 네이티브 탭은 template tint와 앱의 의미 색상을 사용한다. 이미지는 배경 색상을 포함하지 않는다.

SVG를 변경하면 `pnpm generate:tab-icons`로 PNG를 함께 갱신한다.
