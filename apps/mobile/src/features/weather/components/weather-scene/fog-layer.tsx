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
import type { SharedValue } from 'react-native-reanimated';

import type { WeatherSceneSky } from '../../domains/weather-scene.model';
import { WEATHER_SCENE_PALETTES } from './weather-scene-palette';
import { placeSprite } from './weather-scene-particles';
import { CLOUD_SPRITE } from './weather-scene-textures';

const WISP_COUNT = 4;
const WISP_SCALE = 1.8;
const WISP_DRIFT = 22;
const SPRITE_ORIGIN = { x: 0, y: 0 };

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
  const sprites = Array.from({ length: WISP_COUNT }, () =>
    rect(CLOUD_SPRITE.x, CLOUD_SPRITE.y, CLOUD_SPRITE.width, CLOUD_SPRITE.height),
  );
  const colors = Array.from({ length: WISP_COUNT }, () =>
    Skia.Color(`rgba(${rgb},${0.22 * amount})`),
  );
  const scale = (width / CLOUD_SPRITE.width) * WISP_SCALE;
  const spriteWidth = CLOUD_SPRITE.width * scale;
  const spriteHeight = CLOUD_SPRITE.height * scale;

  const transforms = useRSXformBuffer(WISP_COUNT, (transform, index) => {
    'worklet';
    const lane = index / (WISP_COUNT - 1);
    const direction = index % 2 === 0 ? 1 : -1;
    const sway = Math.sin(time.get() * 0.05 + index * 1.7) * WISP_DRIFT * (1 + lane);
    const x = (width - spriteWidth) / 2 + direction * sway + (lane - 0.5) * width * 0.4;
    const y = height * (0.3 + lane * 0.5) - spriteHeight / 2;
    placeSprite(transform, scale, 0, SPRITE_ORIGIN, x, y);
  });

  return (
    <Group>
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, height)}
          colors={[
            `rgba(${rgb},0)`,
            `rgba(${rgb},${0.35 * amount})`,
            `rgba(${rgb},${0.55 * amount})`,
          ]}
          positions={[0.1, 0.6, 1]}
        />
      </Rect>
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
