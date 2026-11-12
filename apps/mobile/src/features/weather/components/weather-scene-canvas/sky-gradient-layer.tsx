import { LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  WEATHER_SCENE_PALETTES,
  WEATHER_SCENE_SKY_POSITIONS,
} from '../../constants/weather-scene-palette.constants';
import type { WeatherSceneSky } from '../../utils/weather-scene.view-model';

const SKY_TRANSITION = { duration: 1200, easing: Easing.inOut(Easing.quad) };

type SkyGradientLayerProps = {
  sky: WeatherSceneSky;
  isDark: boolean;
  width: number;
  height: number;
};

export function SkyGradientLayer({ sky, isDark, width, height }: SkyGradientLayerProps) {
  const [top, upper, lower, bottom] = WEATHER_SCENE_PALETTES[sky].sky[isDark ? 'dark' : 'light'];
  const topColor = useSharedValue<string>(top);
  const upperColor = useSharedValue<string>(upper);
  const lowerColor = useSharedValue<string>(lower);
  const bottomColor = useSharedValue<string>(bottom);

  useEffect(() => {
    topColor.set(withTiming(top, SKY_TRANSITION));
    upperColor.set(withTiming(upper, SKY_TRANSITION));
    lowerColor.set(withTiming(lower, SKY_TRANSITION));
    bottomColor.set(withTiming(bottom, SKY_TRANSITION));
    return () => {
      for (const color of [topColor, upperColor, lowerColor, bottomColor]) {
        cancelAnimation(color);
      }
    };
  }, [top, upper, lower, bottom, topColor, upperColor, lowerColor, bottomColor]);

  const colors = useDerivedValue(() => [
    topColor.get(),
    upperColor.get(),
    lowerColor.get(),
    bottomColor.get(),
  ]);

  return (
    <Rect x={0} y={0} width={width} height={height}>
      <LinearGradient
        start={vec(0, 0)}
        end={vec(0, height)}
        colors={colors}
        positions={WEATHER_SCENE_SKY_POSITIONS}
      />
    </Rect>
  );
}
