# IconCircle

아이콘 하나를 담는 원이다. 도장·상태 표시처럼 둥근 바탕 위에 아이콘을 얹을 때 쓴다.
장식이라 기본으로 읽기 도구에서 숨고, `accessibilityLabel`을 받으면 그 이름의 그림(`image`)으로 읽힌다.
아이콘의 색과 크기는 쓰는 쪽이 정한다(`IconButton`, `Result`와 같은 `icon` 슬롯).

## 사용법

```tsx
import { IconCircle, PawIcon } from '@src/shared/ui';

<IconCircle tone="brand" icon={<PawIcon width={20} height={20} colorClassName="text-white" />} />;
```

## Props

| Prop               | 타입                                           | 기본값      | 설명                                                                                                                  |
| ------------------ | ---------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------- |
| icon               | `ReactNode`                                    | -           | 가운데 둘 아이콘. 색·크기는 쓰는 쪽이 정한다                                                                          |
| tone               | `'brand' \| 'outline' \| 'neutral' \| 'plain'` | `'neutral'` | `brand` main 바탕, `outline` main 점선 테두리와 옅은 main 바탕, `neutral` 회색 테두리, `plain` 모양만(색은 className) |
| accessibilityLabel | `string`                                       | -           | 있으면 `image`로 읽힌다. 없으면 숨는다                                                                                |
| className, style   | -                                              | -           | 기본 44pt(`size-11`). 크기·기울기를 바꿀 때 쓴다. 배치 여백은 부모가 정한다                                           |
| pointerEvents      | `ViewProps['pointerEvents']`                   | -           | 겹쳐 놓은 장식이 아래 누름을 막지 않게 할 때                                                                          |

색은 초대 발자국 판의 도장(찍힘·기다림·빈 칸)과 같은 토큰이다.

## 파일 구조

```
icon-circle/
├── icon-circle.tsx
├── icon-circle.variants.ts
├── icon-circle.test.tsx
├── icon-circle.md
└── index.ts
```
