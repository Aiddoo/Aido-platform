import { PixelRatio, useWindowDimensions } from 'react-native';

/** Skia가 네이티브에서 굳혀 둔 값과 같은 때에 읽은 화면 배율 */
const SKIA_PIXEL_RATIO = PixelRatio.get();

/**
 * Android의 Skia는 앱을 켤 때의 화면 배율로 계속 그린다. 앱을 켜 둔 채 디스플레이 크기를 바꾸면
 * 레이아웃 값으로 그린 그림이 그만큼 어긋나므로, 캔버스 안에 이 배율을 곱해 되돌린다. 평소에는 1이다.
 */
export function useSkiaDensityScale(): number {
  const { scale } = useWindowDimensions();

  return scale / SKIA_PIXEL_RATIO;
}
