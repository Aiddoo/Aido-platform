import { LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { Easing, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';

import type { WeatherSceneSky } from '../../domains/weather-scene.model';
import { WEATHER_SCENE_PALETTES } from './weather-scene-palette';

const SKY_TRANSITION = { duration: 1200, easing: Easing.inOut(Easing.quad) };

type SkyGradientLayerProps = {
  sky: WeatherSceneSky;
  width: number;
  height: number;
};

export function SkyGradientLayer({ sky, width, height }: SkyGradientLayerProps) {
  const [top, middle, bottom] = WEATHER_SCENE_PALETTES[sky].sky;
  const topColor = useSharedValue<string>(top);
  const middleColor = useSharedValue<string>(middle);
  const bottomColor = useSharedValue<string>(bottom);

  useEffect(() => {
    topColor.set(withTiming(top, SKY_TRANSITION));
    middleColor.set(withTiming(middle, SKY_TRANSITION));
    bottomColor.set(withTiming(bottom, SKY_TRANSITION));
  }, [top, middle, bottom, topColor, middleColor, bottomColor]);

  const colors = useDerivedValue(() => [topColor.get(), middleColor.get(), bottomColor.get()]);

  return (
    <Rect x={0} y={0} width={width} height={height}>
      <LinearGradient start={vec(0, 0)} end={vec(width * 0.3, height)} colors={colors} />
    </Rect>
  );
}
