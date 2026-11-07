# Image

`expo-image`의 `Image`를 Uniwind로 감싸 `className`을 받게 한 부품이다. 로컬·원격 이미지를 그대로 그릴 때 쓴다.

## 사용법

```tsx
import { Image } from '@src/shared/ui';

<Image source={source} className="size-10 rounded-full" contentFit="cover" />;
```

## Props

| Prop     | 타입                               | 설명                                        |
| -------- | ---------------------------------- | ------------------------------------------- |
| ...props | `ComponentProps<typeof ExpoImage>` | `source`, `contentFit`, `className` 등 원본 |

## 규칙

- 비율을 먼저 잡아야 하는 원격 이미지는 `FeatureMedia`(로딩·실패 대체 포함)를 쓴다.
- feature에서 `expo-image`와 `withUniwind(Image)`를 직접 조합하지 않고 이 부품을 쓴다. `ImageSource` 같은 타입만 `expo-image`에서 가져온다.
