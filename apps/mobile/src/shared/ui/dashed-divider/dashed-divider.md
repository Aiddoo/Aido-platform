# DashedDivider

영수증·리포트처럼 한 카드 안의 구획을 나누는 점선 구분선이다.
실선 구분선은 HeroUI `Separator`를 그대로 쓴다.

## 사용법

```tsx
import { DashedDivider } from '@src/shared/ui';

<DashedDivider />
<DashedDivider className="my-5 mx-5" />
```

## Props

| Prop      | 타입                          | 설명                                           |
| --------- | ----------------------------- | ---------------------------------------------- |
| className | `string`                      | 여백 등 배치만 조정한다. 선 스타일은 고정이다. |
| ...props  | `ComponentProps<typeof View>` | `children`을 제외한 View props                 |

## 파일 구조

```
dashed-divider/
├── dashed-divider.tsx
├── dashed-divider.md
└── index.ts
```
