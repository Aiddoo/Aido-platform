import { Atlas, rect, Skia, type SkImage, useRSXformBuffer } from '@shopify/react-native-skia';
import { interpolate, type SharedValue } from 'react-native-reanimated';

import { WEATHER_SCENE_PALETTES } from '../../constants/weather-scene-palette';
import type { WeatherSceneSky } from '../../domains/weather-scene.model';
import {
  createParticleSeeds,
  getCloudCount,
  PARTICLE_SEED_STRIDE,
  placeSprite,
  wrap,
} from './weather-scene-particles';
import { CLOUD_SPRITE } from './weather-scene-textures';

const CLOUD_SEED = 0xc10d;
const CLOUD_BODY_WIDTH = 262;
const MAX_REFERENCE_WIDTH = 600;
const BODY_WIDTH_RATIO = [0.5, 1];
const BASE_DRIFT = 8;
const WIND_DRIFT = 26;
const CLOUD_BAND = { top: 0.06, height: 0.5 } as const;
const ALPHA = [0.1, 0.26];
const UNIT = [0, 1];
const SPRITE_ORIGIN = { x: 0, y: 0 };

type CloudLayerProps = {
  amount: number;
  wind: number;
  sky: WeatherSceneSky;
  width: number;
  height: number;
  time: SharedValue<number>;
  texture: SharedValue<SkImage | null>;
};

/** 시안 wxDrift처럼 흐린 구름 덩이가 깊이에 따라 다른 속도로 흘러가고, 운량이 많을수록 수와 농도가 는다. */
export function CloudLayer({ amount, wind, sky, width, height, time, texture }: CloudLayerProps) {
  const count = getCloudCount(amount);
  const seeds = createParticleSeeds(count, CLOUD_SEED);
  const sprites = Array.from({ length: count }, () =>
    rect(CLOUD_SPRITE.x, CLOUD_SPRITE.y, CLOUD_SPRITE.width, CLOUD_SPRITE.height),
  );
  const rgb = WEATHER_SCENE_PALETTES[sky].cloud;
  const coverage = 0.55 + amount * 0.45;
  const colors = Array.from({ length: count }, (_, index) => {
    const depth = (index + 0.5) / count;
    return Skia.Color(`rgba(${rgb},${interpolate(depth, UNIT, ALPHA) * coverage})`);
  });

  const referenceWidth = Math.min(width, MAX_REFERENCE_WIDTH);
  const maxScale = (referenceWidth * Math.max(...BODY_WIDTH_RATIO)) / CLOUD_BODY_WIDTH;
  const drift = BASE_DRIFT + wind * WIND_DRIFT;
  const travelWidth = width + CLOUD_SPRITE.width * maxScale;

  const transforms = useRSXformBuffer(count, (transform, index) => {
    'worklet';
    const base = index * PARTICLE_SEED_STRIDE;
    const depth = (index + 0.5) / count;
    const size = 0.5 * depth + 0.5 * (seeds[base + 2] ?? 0);
    const scale = (referenceWidth * interpolate(size, UNIT, BODY_WIDTH_RATIO)) / CLOUD_BODY_WIDTH;
    const x = wrap(
      (seeds[base] ?? 0) * travelWidth + time.get() * drift * (0.45 + 0.55 * depth),
      travelWidth,
    );
    const y =
      height * (CLOUD_BAND.top + (seeds[base + 1] ?? 0) * CLOUD_BAND.height) -
      CLOUD_SPRITE.height * scale * 0.55;
    placeSprite(transform, scale, 0, SPRITE_ORIGIN, x - CLOUD_SPRITE.width * scale, y);
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
