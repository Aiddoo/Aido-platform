# AspectRatio

자식이 들어오기 전에 자리를 먼저 잡는 비율 박스다. shadcn `AspectRatio`와 같은 인터페이스로, RN `aspectRatio` 스타일만 쓴다.
바깥 크기(폭, 여백)는 부모가 정한다. 기본 폭은 부모 폭 전체다.

## 사용법

```tsx
import { AspectRatio } from '@src/shared/ui/aspect-ratio';

<AspectRatio ratio={9 / 16} className="overflow-hidden rounded-3xl bg-gray-2">
  <Image source={source} contentFit="cover" style={StyleSheet.absoluteFill} />
</AspectRatio>;
```

## Props

| Prop     | 타입                          | 설명                                     |
| -------- | ----------------------------- | ---------------------------------------- |
| ratio    | `number`                      | 가로 ÷ 세로                              |
| ...props | `ComponentProps<typeof View>` | `className`, `style`, `children` 등 원본 |

## 규칙

- 자식은 박스를 채운다(`absoluteFill` 또는 `flex-1`). 이미지·영상·웹뷰가 뜨는 자리에 쓴다.
- 아바타, 아이콘처럼 크기가 고정이면 쓰지 않는다.
