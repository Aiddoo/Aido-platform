import { Rect } from '@shopify/react-native-skia';
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';

import { getLightningIntensity } from './weather-scene-particles';

const MAX_FLASH_OPACITY = 0.32;

type LightningLayerProps = {
  width: number;
  height: number;
  time: SharedValue<number>;
};

export function LightningLayer({ width, height, time }: LightningLayerProps) {
  const opacity = useDerivedValue(() => getLightningIntensity(time.get()) * MAX_FLASH_OPACITY);
  return (
    <Rect x={0} y={0} width={width} height={height} color="rgb(222,230,255)" opacity={opacity} />
  );
}
