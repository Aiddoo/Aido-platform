# FeatureMedia

비율이 정해진 이미지 자리다. `AspectRatio` + `expo-image`로, 받기 전에도 자리를 잡아 화면이 밀리지 않는다.
비율이 정해진 이미지를 박스에 채울 때 쓴다(서버 이미지, 번들 화면 캡처). 아바타처럼 크기가 고정이면 쓰지 않는다.

## 사용법

```tsx
import { FeatureMedia } from '@src/shared/ui';

<FeatureMedia
  ratio={9 / 16}
  source={{ uri: media.url }}
  alt={media.description}
  recyclingKey={media.id}
  className="rounded-3xl"
/>;
```

## Props

| Prop         | 타입                       | 설명                                                       |
| ------------ | -------------------------- | ---------------------------------------------------------- |
| ratio        | `number`                   | 가로 ÷ 세로 (`AspectRatio`)                                |
| source       | `ImageProps['source']`     | expo-image 원본                                            |
| alt          | `string`                   | 스크린 리더 설명. 장식이면 `''`                            |
| contentFit   | `ImageProps['contentFit']` | 기본 `cover`                                               |
| recyclingKey | `string`                   | 목록 재활용 때 이전 이미지가 비치지 않게 행마다 다른 값    |
| fallback     | `ReactNode`                | 불러오기에 실패했을 때 같은 자리에 그릴 것. 없으면 빈 표면 |
| ...props     | `AspectRatioProps`         | `className`, `style` 등. 폭과 여백은 부모가 정한다         |

## 동작

- 로딩 중: 같은 자리에 heroui `Skeleton`. 움직임 줄이기(`useIsReduceMotionEnabled`)면 멈추고 이미지 페이드도 없다.
- 실패: 스켈레톤을 거두고 `fallback`(없으면 빈 표면)을 그린다. 자리는 그대로다.
- 메모리: `cachePolicy="memory-disk"`, 표시 크기로 줄여 디코딩(expo-image 기본).
- 색은 토큰이라 다크에서도 같다.
