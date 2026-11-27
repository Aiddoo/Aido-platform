import { PixelRatio, useWindowDimensions } from 'react-native';

/** Skia가 네이티브에서 굳혀 둔 값과 같은 때에 읽은 화면 배율 */
const SKIA_PIXEL_RATIO = PixelRatio.get();

/** Android Skia는 앱을 켤 때의 화면 배율로 계속 그려, 켜 둔 채 디스플레이 크기를 바꾸면 이 배율로 되돌린다 */
export function useSkiaDensityScale(): number {
  const { scale } = useWindowDimensions();

  return scale / SKIA_PIXEL_RATIO;
}
