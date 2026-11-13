# SurfaceCard

heroui-native `Surface`를 앱 카드 면(`rounded-2xl`, 그림자 없음, `bg-gray-1`)으로 맞춘 컨테이너. 손으로 만든 카드 `View` 대신 이것을 쓴다.

## 사용법

```tsx
<SurfaceCard className="gap-4" testID="quota-summary">{/* 내용 */}</SurfaceCard>
<SurfaceCard surface="sheet" className="flex-row items-center gap-2 px-4 py-3">{/* 시트 안 */}</SurfaceCard>
```

## Props

| prop      | 타입                  | 설명                                                                |
| --------- | --------------------- | ------------------------------------------------------------------- |
| `surface` | `'screen' \| 'sheet'` | 기본 `screen`. `sheet`는 시트 안 면이라 다크에서 `bg-gray-2`를 쓴다 |

`Surface`에서 `variant`를 뺀 나머지는 `...props`다. 안쪽 여백은 `Surface` 기본(`p-4`)이고 `className`으로 바꾼다.

## 동작

- `variant="transparent"`라서 `SurfaceContext`를 만들지 않는다. 안의 `Checkbox`·`Input`이 secondary 색으로 바뀌지 않는다. 면 색은 `bg-gray-1`이 입힌다.
- `Surface`의 `overflow: hidden`은 `overflow-visible`로, `continuous` 모서리는 `circular`로 되돌려 기존 카드와 같은 모양이다.
