import {
  Atlas,
  Group,
  LinearGradient,
  Rect,
  rect,
  Skia,
  type SkImage,
  useRSXformBuffer,
  vec,
} from '@shopify/react-native-skia';
import { clamp } from 'es-toolkit';
import { interpolate, type SharedValue, useDerivedValue } from 'react-native-reanimated';

import { WEATHER_SCENE_PALETTES } from '../../constants/weather-scene-palette';
import type { WeatherSceneSky } from '../../domains/weather-scene.model';
import { placeSprite, wrap } from './weather-scene-particles';
import { CLOUD_SPRITE } from './weather-scene-textures';

const WISP_COUNT = 4;
const WISP_MIN_AMOUNT = 0.4;
const WISP_SCALE = 1.6;
const WISP_DRIFT = 9;
const SPRITE_ORIGIN = { x: 0, y: 0 };
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
  texture: SharedValue<SkImage | null>;
};

export function FogLayer({ amount, sky, width, height, time, texture }: FogLayerProps) {
  const rgb = WEATHER_SCENE_PALETTES[sky].fog;
  const wispCount = amount < WISP_MIN_AMOUNT ? 0 : WISP_COUNT;
  const sprites = Array.from({ length: wispCount }, () =>
    rect(CLOUD_SPRITE.x, CLOUD_SPRITE.y, CLOUD_SPRITE.width, CLOUD_SPRITE.height),
  );
  const colors = Array.from({ length: wispCount }, () =>
    Skia.Color(`rgba(${rgb},${0.2 * amount})`),
  );
  const scale = (width / CLOUD_SPRITE.width) * WISP_SCALE;
  const spriteWidth = CLOUD_SPRITE.width * scale;
  const spriteHeight = CLOUD_SPRITE.height * scale;
  const travelWidth = width + spriteWidth;

  const transforms = useRSXformBuffer(wispCount, (transform, index) => {
    'worklet';
    const lane = index / (WISP_COUNT - 1);
    const direction = index % 2 === 0 ? 1 : -1;
    const x = wrap(lane * travelWidth + direction * time.get() * WISP_DRIFT, travelWidth);
    const y = height * (0.32 + lane * 0.5) - spriteHeight / 2;
    placeSprite(transform, scale, 0, SPRITE_ORIGIN, x - spriteWidth, y);
  });

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
      <Atlas
        image={texture}
        sprites={sprites}
        transforms={transforms}
        colors={colors}
        colorBlendMode="modulate"
      />
    </Group>
  );
}
