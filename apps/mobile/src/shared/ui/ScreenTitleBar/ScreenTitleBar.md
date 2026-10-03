# ScreenTitleBar

화면 최상단에 고정되는 제목 바입니다. 뒤로가기 · 가운데 제목 · 오른쪽 액션으로 구성합니다.

네이티브 헤더(`Stack.Screen options.title`)로는 그릴 수 없는 **살아 있는 값**(조회수, 개수 등)을
`subtitle`에 둘 수 있어, 헤더가 데이터를 읽어야 하는 화면에서 사용합니다.

## 사용법

```tsx
import { ScreenTitleBar } from '@src/shared/ui';

// 제목만
<ScreenTitleBar title="답글" />

// 서버 값이 함께 보이는 헤더
<ScreenTitleBar title="할 일 상세" subtitle={t('detail.views', { count: viewCount })} />

// 오른쪽 액션
<ScreenTitleBar
  title="알림"
  trailing={
    <PressableFeedback onPress={openSettings} className="size-11 items-center justify-center">
      <SettingIcon width={22} height={22} colorClassName="text-gray-9" />
    </PressableFeedback>
  }
/>

// 데이터를 기다리는 동안
<Suspense fallback={<ScreenTitleBar.Loading hasSubtitle />}>
  <TodoCommentTitleBar />
</Suspense>
```

## Props

| Prop          | 타입         | 기본값          | 설명                                                     |
| ------------- | ------------ | --------------- | -------------------------------------------------------- |
| `title`       | `string`     | -               | 가운데 제목 (필수)                                       |
| `subtitle`    | `string`     | -               | 제목 아래 보조 문구                                      |
| `trailing`    | `ReactNode`  | 대칭 여백       | 오른쪽 액션. 없으면 같은 폭의 빈 자리로 가운데 정렬 유지 |
| `onBackPress` | `() => void` | `router.back()` | 뒤로가기 동작                                            |

### ScreenTitleBar.Loading

| Prop          | 타입      | 기본값  | 설명                        |
| ------------- | --------- | ------- | --------------------------- |
| `hasSubtitle` | `boolean` | `false` | 보조 문구 자리까지 그릴지지 |

## 파일 구조

```
ScreenTitleBar/
├── ScreenTitleBar.tsx        # 컴포넌트 + .Loading
├── ScreenTitleBar.types.ts   # Props 타입
├── ScreenTitleBar.md         # 이 문서
└── index.ts                  # 배럴
```

## Expo Router 헤더

`ScreenTitleBar.StackHeader`는 Expo Router의 `NativeStackHeaderProps`를 그대로 받는다.
기존 `title`, `headerLeft`, `headerRight` 옵션을 공용 제목 바에 연결하고 위쪽 safe-area를 적용한다.
화면 저장/취소 버튼과 서버 데이터는 사용처의 옵션에 둔다.

```tsx
<Stack
  screenOptions={{
    header: (props) => <ScreenTitleBar.StackHeader {...props} />,
  }}
/>
```

`leading`은 기존 뒤로가기 영역을 대체하는 ReactNode다. 전달하지 않으면 기존 뒤로가기를 사용한다.
공용 custom header는 Stack의 화면 전환/뒤로가기 동작을 유지하면서 플랫폼별 native toolbar의
동적 자식 제거 경로를 사용하지 않는다.
