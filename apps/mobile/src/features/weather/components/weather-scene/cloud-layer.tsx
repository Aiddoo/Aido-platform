import { Atlas, rect, Skia, type SkImage, useRSXformBuffer } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';

import type { WeatherSceneSky } from '../../domains/weather-scene.model';
import { WEATHER_SCENE_PALETTES } from './weather-scene-palette';
import {
  createParticleSeeds,
  PARTICLE_SEED_STRIDE,
  placeSprite,
  wrap,
} from './weather-scene-particles';
import { CLOUD_SPRITE } from './weather-scene-textures';

const CLOUD_SEED = 0xc10d;
const MIN_VISIBLE_CLOUDS = 0.02;
const MAX_CLOUDS = 9;
const BASE_DRIFT = 6;
const WIND_DRIFT = 28;
const SCALE = [0.9, 2] as const;
const CLOUD_BAND_HEIGHT_RATIO = 0.42;
const SPRITE_ORIGIN = { x: 0, y: 0 };
const MAX_SIZE_JITTER = 1.15;

type CloudLayerProps = {
  amount: number;
  wind: number;
  sky: WeatherSceneSky;
  width: number;
  height: number;
  time: SharedValue<number>;
  texture: SharedValue<SkImage | null>;
};

export function CloudLayer({ amount, wind, sky, width, height, time, texture }: CloudLayerProps) {
  const count = amount < MIN_VISIBLE_CLOUDS ? 0 : Math.round(2 + amount * (MAX_CLOUDS - 2));
  const seeds = createParticleSeeds(count, CLOUD_SEED);
  const sprites = Array.from({ length: count }, () =>
    rect(CLOUD_SPRITE.x, CLOUD_SPRITE.y, CLOUD_SPRITE.width, CLOUD_SPRITE.height),
  );
  const rgb = WEATHER_SCENE_PALETTES[sky].cloud;
  const coverage = 0.45 + amount * 0.55;
  const colors = Array.from({ length: count }, (_, index) => {
    const depth = (index + 0.5) / count;
    return Skia.Color(`rgba(${rgb},${(0.3 + depth * 0.45) * coverage})`);
  });

  const widthScale = width / CLOUD_SPRITE.width;
  const drift = BASE_DRIFT + wind * WIND_DRIFT;
  const travelWidth = width + CLOUD_SPRITE.width * widthScale * SCALE[1] * MAX_SIZE_JITTER;
  const bandHeight = height * CLOUD_BAND_HEIGHT_RATIO;

  const transforms = useRSXformBuffer(count, (transform, index) => {
    'worklet';
    const base = index * PARTICLE_SEED_STRIDE;
    const depth = (index + 0.5) / count;
    const scale =
      widthScale *
      (SCALE[0] + depth * (SCALE[1] - SCALE[0])) *
      (0.85 + (MAX_SIZE_JITTER - 0.85) * (seeds[base + 2] ?? 0));
    const spriteWidth = CLOUD_SPRITE.width * scale;
    const x = wrap(
      (seeds[base] ?? 0) * travelWidth + time.get() * drift * (0.4 + 0.6 * depth),
      travelWidth,
    );
    const y = (seeds[base + 1] ?? 0) * bandHeight - CLOUD_SPRITE.height * scale * 0.45;
    placeSprite(transform, scale, 0, SPRITE_ORIGIN, x - spriteWidth, y);
  });

  return (
    <Atlas
      image={texture}
      sprites={sprites}
      transforms={transforms}
      colors={colors}
      colorBlendMode="modulate"
    />
  );
}
