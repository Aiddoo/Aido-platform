# ScreenTitleBar

**Stack 화면이 아닌 pane** 꼭대기에 두는 JS 제목 바입니다. 뒤로가기 · 가운데 제목 · 보조 문구로 구성합니다.

Stack 화면의 헤더는 네이티브 헤더를 씁니다([`stack-header.md`](../stack-header/stack-header.md)).
`AdaptivePane`의 상세 pane은 Stack 화면이 아니어서 네이티브 헤더가 없고, pane 안에서 `Stack.Toolbar`를
렌더하면 바깥 화면(피드·메모 탭) 헤더에 붙어 버립니다. 그래서 pane에서만 이 컴포넌트를 씁니다.

현재 사용처: 펼친 피드의 할 일 상세 pane(`TodoCommentTitleBar`).

## 사용법

```tsx
import { ScreenTitleBar } from '@src/shared/ui';

<ScreenTitleBar
  title={t('todo:detail.pageTitle')}
  subtitle={t('todo:detail.views', { count: viewCount })}
  onBackPress={closePane}
/>;
```

### ScreenTitleBar.Title

제목과 보조 문구만 그립니다. Stack 화면에서 제목 아래 살아 있는 값(조회수 등)을 보여야 할 때
네이티브 헤더의 `headerTitle`로 넘깁니다. 버튼은 네이티브로 두고 제목만 커스텀 뷰가 됩니다.

```tsx
<Stack.Screen
  options={{ headerTitle: () => <ScreenTitleBar.Title title={title} subtitle={subtitle} /> }}
/>
```

## Props

| Prop                     | 타입         | 기본값           | 설명                                         |
| ------------------------ | ------------ | ---------------- | -------------------------------------------- |
| `title`                  | `string`     | -                | 가운데 제목 (필수)                           |
| `subtitle`               | `string`     | -                | 제목 아래 보조 문구                          |
| `onBackPress`            | `() => void` | -                | 뒤로가기 동작 (필수, pane은 라우트가 아니다) |
| `backAccessibilityLabel` | `string`     | `actions.goBack` | 뒤로가기가 화면 안 상태만 닫을 때의 이름     |
| `isBackDisabled`         | `boolean`    | `false`          | 저장 중처럼 벗어나면 안 될 때 잠근다         |

## 파일 구조

```
screen-title-bar/
├── screen-title-bar.tsx        # 컴포넌트 + .Title
├── screen-title-bar.types.ts   # Props 타입
├── screen-title-bar.md         # 이 문서
└── index.ts                    # 배럴
```
