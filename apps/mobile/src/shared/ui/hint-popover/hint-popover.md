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
  <HintPopoverContent Icon={MicIcon} title={title} description={description} />
</Popover>;
```

## Props

| Prop          | 타입                    | 설명                                                                                           |
| ------------- | ----------------------- | ---------------------------------------------------------------------------------------------- |
| Icon          | `StyledIcon`            | 제목 앞 아이콘. `text-main`으로 그린다                                                         |
| title         | `string`                | 제목. 없으면 설명과 X가 한 줄에 놓인다                                                         |
| description   | `string`                | 설명                                                                                           |
| isPassThrough | `boolean`               | 바깥과 말풍선 몸통이 아래를 막지 않아 대상과 화면을 그대로 누른다. 바깥 탭으로는 닫히지 않는다 |
| children      | `ReactNode`             | 설명 아래에 더 보일 내용                                                                       |
| placement 외  | `Popover.Content` props | 원본 이름 그대로. 기본은 `placement="top"`, `align="end"`, 폭 300(좌우 안전 영역 안으로 줄임)  |

제목과 설명은 `WordWrapText`로 그린다. 좁은 폰(Galaxy Flip 360dp 등)은 말풍선 폭이 좁아 Android에서도 한글이 단어 사이에서 꺾인다.

닫기는 세 가지다: X, 바깥 탭(`Popover.Overlay`, `isPassThrough`면 없음), 대상 다시 누르기(`Popover.Trigger`).

자동으로 뜨는 안내가 눌러야 할 대상을 가리키면 `isPassThrough`를 써서 첫 탭이 안내만 닫지 않게 한다. 이때 말풍선은 닫기(X)만 누름을 받고 글·아이콘 자리의 누름은 아래로 넘긴다. 스크린리더는 말풍선을 읽고 X로 닫으며, 모달로 가두지 않아 덮인 칩에도 간다. iOS에서 말풍선은 키보드 창 아래에 그려지므로 키보드가 떠 있으면 잘린다. 시트의 첫 안내는 키보드 없이 연다(`todo-create-bottom-sheet.tsx`는 안내가 떠 있을 때 제목 입력의 자동 포커스를 끈다).
`placement="bottom"`인데 아래쪽에 자리가 없으면 위로 뒤집는다. 화면 맨 위의 대상은 `placement="bottom"`으로 연다.

`children`은 앱 루트의 PortalHost에 그려져 DI·Query provider 바깥이다. 그 안에서 조회 훅을 쓰면 앱이 죽으므로 값은 `Popover`를 두는 컴포넌트에서 읽어 넘긴다.

## 자리

`placement` 쪽에 자리가 없어 상태바나 홈 표시줄과 겹치면 반대쪽으로 뒤집는다. 양쪽 다 모자라면 자리가 더 많은 쪽이다. 판단은 `getHintPlacement` 한 곳이다.

기본 간격은 `HINT_OFFSET`이다. 옆 요소를 건너 펴려면 호출부가 건너뛸 거리에 이 값을 더해 `offset`으로 넘긴다(메모 화면).

위아래로 열면 입력 칸을 덮는 대상(시트 아래쪽 줄의 버튼)은 `placement="left"`, `align="center"`로 연다. heroui는 `avoidCollisions`와 상관없이 말풍선을 홈 표시줄 여백 위로 올려, 대상 줄보다 높은 말풍선은 위 줄(추가 시트의 칩)을 덮는다. 그래서 이런 안내는 `isPassThrough`로 덮인 칩도 바로 눌리게 한다. 폭은 대상과 화면 왼쪽 끝(왼쪽 레일) 사이로 줄어든다(`getHintWidth`). `right`도 같은 규칙으로 오른쪽 레일까지 줄인다. 키보드는 Android에서 말풍선 위에 그려지므로 아래로 열면 가려진다.
