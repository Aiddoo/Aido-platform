# ListRow

왼쪽·가운데·오른쪽 세 칸의 목록 행이다. 행 높이·여백·구분선·누름을 한 곳에서 정해 설정·영수증·제안 목록이 같은 모양이 된다. 가운데 글자는 `ListRow.Texts`로 1~3줄을 고른다.

## 사용법

```tsx
// features/billing/subscription/components/subscription-welcome.tsx
<ListRow
  onPress={open}
  contents={<ListRow.Texts type="2RowTypeA" top={title} bottom={description} />}
  right={<ArrowRightIcon colorClassName="text-gray-5" />}
/>
```

## Props

`HStack`(`ViewProps`)을 펼친다. `children` 대신 세 칸을 받는다.

| Prop                              | 값                                                       | 기본     |
| --------------------------------- | -------------------------------------------------------- | -------- |
| `contents`(필수), `left`, `right` | `ReactNode`                                              | -        |
| `onPress`                         | 넘기면 행 전체가 `button` 역할의 `PressableFeedback`이다 | -        |
| `verticalPadding`                 | `small`(4) · `medium`(8) · `large`(16) · `xlarge`(20)    | `medium` |
| `horizontalPadding`               | `none` · `small`(8) · `medium`(16)                       | `none`   |
| `border`                          | `none` · `indented`(아래 `border-gray-3`)                | `none`   |
| `leftAlignment`, `rightAlignment` | `top` · `center`                                         | `center` |
| `isDisabled`                      | 흐리게(`opacity-40`) 그리고 누름을 막는다                | `false`  |

### ListRow.Texts

`type`이 줄 수를 정하고 그 줄의 글자가 필수다(판별 유니온). 각 줄의 `*Props`는 `Text` Props(`children` 제외)다.

| `type`      | 줄과 기본 글꼴                                          |
| ----------- | ------------------------------------------------------- |
| `1RowTypeA` | `top`(b2)                                               |
| `2RowTypeA` | `top`(b2), `bottom`(e1, shade 5)                        |
| `3RowTypeA` | `top`(b2), `middle`(b3, shade 6), `bottom`(e1, shade 5) |

`ListRow.Texts.Loading`은 같은 `type`으로 같은 줄을 `TextSkeleton`으로 채운다. 실제 행에서 바꾼 크기만 `topProps`·`middleProps`·`bottomProps`(`TextSkeletonProps`)로 다시 준다.

```tsx
<ListRow
  left={<Skeleton className="size-10 rounded-full" />}
  contents={
    <ListRow.Texts.Loading type="2RowTypeA" bottomProps={{ size: 'b3', className: 'w-full' }} />
  }
/>
```

## 동작

- 세 칸 사이 간격은 12다. `left`·`right`가 없으면 칸을 그리지 않는다.
- 목록의 `.Loading`은 `ListRow`의 같은 슬롯에 `ListRow.Texts.Loading`을 넣어 행 높이를 실제 행과 맞춘다([레이아웃 시프트](../../../../docs/architecture/ui.md#레이아웃-시프트워터폴목록)).
- 카드 안에서 카드 전체를 누르게 할 때는 바깥 `PressableFeedback`에 동작을 두고 `ListRow`에는 `onPress`를 주지 않는다(`suggestion-entry.tsx`). 오른쪽 칩처럼 스스로 눌리는 부품은 `pointerEvents="none"`으로 탭을 넘긴다.
