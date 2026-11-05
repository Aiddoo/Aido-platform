# HintPopoverContent

앱의 모든 안내 말풍선(코치마크·ⓘ)이 쓰는 내용 모양이다. 아이콘·제목·작은 X가 한 줄이고 그 아래에 설명이 온다.
여는 상태와 대상은 heroui-native `Popover` 원본을 그대로 쓴다.

## 사용법

```tsx
import { HintPopoverContent, MicIcon } from '@src/shared/ui';
import { Popover, PressableFeedback } from 'heroui-native';

<Popover isOpen={isOpen} onOpenChange={setIsOpen}>
  <Popover.Trigger asChild>
    <PressableFeedback accessibilityRole="button" accessibilityLabel={label}>
      {children}
    </PressableFeedback>
  </Popover.Trigger>
  <HintPopoverContent icon={MicIcon} title={title} description={description} />
</Popover>;
```

## Props

| Prop          | 타입                    | 설명                                                                                |
| ------------- | ----------------------- | ----------------------------------------------------------------------------------- |
| icon          | `typeof MicIcon`        | 제목 앞 아이콘. `text-main`으로 그린다                                              |
| title         | `string`                | 제목. 없으면 설명과 X가 한 줄에 놓인다                                              |
| description   | `string`                | 설명                                                                                |
| isPassThrough | `boolean`               | 바깥을 막지 않아 대상과 화면을 그대로 누른다. 이때 바깥 탭으로는 닫히지 않는다      |
| children      | `ReactNode`             | 설명 아래에 더 보일 내용                                                            |
| placement 외  | `Popover.Content` props | 원본 이름 그대로. 기본은 `placement="top"`, `align="end"`, 폭 300(화면 안으로 줄임) |

닫기는 세 가지다: X, 바깥 탭(`Popover.Overlay`, `isPassThrough`면 없음), 대상 다시 누르기(`Popover.Trigger`).
`placement="bottom"`인데 아래쪽에 자리가 없으면 위로 뒤집는다. 화면 맨 위의 대상은 `placement="bottom"`으로 연다.

`children`은 앱 루트의 PortalHost에 그려져 DI·Query provider 바깥이다. 그 안에서 조회 훅을 쓰면 앱이 죽으므로 값은 `Popover`를 두는 컴포넌트에서 읽어 넘긴다.

## 파일 구조

```
hint-popover/
├── hint-popover.tsx
├── hint-popover.md
└── index.ts
```

## 자리

`placement` 쪽에 자리가 없어 상태바나 홈 표시줄과 겹치면 반대쪽으로 뒤집는다. 양쪽 다 모자라면 자리가 더 많은 쪽이다. 판단은 `getHintPlacement` 한 곳이다.
