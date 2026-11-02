import { Rect } from '@shopify/react-native-skia';
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';

import { getLightningIntensity } from './weather-scene-particles';

/** 시안 wxFlash의 첫 섬광 최대 불투명도 */
const MAX_FLASH_OPACITY = 0.45;

type LightningLayerProps = {
  width: number;
  height: number;
  time: SharedValue<number>;
};

export function LightningLayer({ width, height, time }: LightningLayerProps) {
  const opacity = useDerivedValue(() => getLightningIntensity(time.get()) * MAX_FLASH_OPACITY);
  return <Rect x={0} y={0} width={width} height={height} color="white" opacity={opacity} />;
}
