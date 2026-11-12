import { Group, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { clamp } from 'es-toolkit';
import { interpolate, type SharedValue, useDerivedValue } from 'react-native-reanimated';

import { WEATHER_SCENE_PALETTES } from '../../constants/weather-scene-palette.constants';
import type { WeatherSceneSky } from '../../utils/weather-scene.view-model';

/** 시안 wxHaze: 6초 주기로 12px 떠오르며 0.3→0.55로 짙어지는 띠 */
const HAZE_PERIOD_SECONDS = 6;
const HAZE_RISE = 12;
const HAZE_OPACITY = [0.3, 0.55];
const UNIT = [0, 1];
const HAZE_BAND = { center: 0.52, height: 0.24 } as const;
const HAZE_FULL_AMOUNT = 0.4;

type FogLayerProps = {
  amount: number;
  sky: WeatherSceneSky;
  width: number;
  height: number;
  time: SharedValue<number>;
};

/** 화면 아래쪽에 낮게 깔린 물안개와 천천히 떠오르는 옅은 띠 */
export function FogLayer({ amount, sky, width, height, time }: FogLayerProps) {
  const rgb = WEATHER_SCENE_PALETTES[sky].fog;
  const bandStrength = clamp(amount / HAZE_FULL_AMOUNT, 0, 1);
  const bandHeight = height * HAZE_BAND.height;
  const bandTop = height * HAZE_BAND.center - bandHeight / 2;
  const breath = useDerivedValue(
    () => 0.5 - 0.5 * Math.cos((time.get() / HAZE_PERIOD_SECONDS) * Math.PI * 2),
  );
  const bandOpacity = useDerivedValue(
    () => bandStrength * interpolate(breath.get(), UNIT, HAZE_OPACITY),
  );
  const bandTransform = useDerivedValue(() => [{ translateY: -HAZE_RISE * breath.get() }]);

  return (
    <Group>
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, height)}
          colors={[
            `rgba(${rgb},0)`,
            `rgba(${rgb},${0.3 * amount})`,
            `rgba(${rgb},${0.5 * amount})`,
          ]}
          positions={[0.25, 0.7, 1]}
        />
      </Rect>
      <Group opacity={bandOpacity} transform={bandTransform}>
        <Rect x={0} y={bandTop} width={width} height={bandHeight}>
          <LinearGradient
            start={vec(0, bandTop)}
            end={vec(0, bandTop + bandHeight)}
            colors={[`rgba(${rgb},0)`, `rgba(${rgb},1)`, `rgba(${rgb},0)`]}
          />
        </Rect>
      </Group>
    </Group>
  );
}
