import { Atlas, rect, Skia, type SkImage, useRSXformBuffer } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';

import {
  createParticleSeeds,
  getParticleCount,
  PARTICLE_SEED_STRIDE,
  placeSprite,
  wrap,
} from './weather-scene-particles';
import { PARTICLE_SPRITES, PARTICLE_TEXTURE_SCALE } from './weather-scene-textures';

const SNOW_SEED = 0x5a0f;
const EDGE_MARGIN = 24;
const FALL_SPEED = [36, 150] as const;
const MAX_WIND_DRIFT = 70;
const SWAY_AMPLITUDE = 18;
const SCALE = [0.3, 1] as const;
const ALPHA = [0.35, 0.95] as const;

type SnowLayerProps = {
  density: number;
  speed: number;
  wind: number;
  isDaylight: boolean;
  width: number;
  height: number;
  isLowEndDevice: boolean;
  time: SharedValue<number>;
  texture: SharedValue<SkImage | null>;
};

export function SnowLayer({
  density,
  speed,
  wind,
  isDaylight,
  width,
  height,
  isLowEndDevice,
  time,
  texture,
}: SnowLayerProps) {
  const count = getParticleCount('snow', density, { width, height }, isLowEndDevice);
  const seeds = createParticleSeeds(count, SNOW_SEED);
  const sprite = PARTICLE_SPRITES.flake;
  const sprites = Array.from({ length: count }, () =>
    rect(sprite.x, sprite.y, sprite.width, sprite.height),
  );
  const rgb = isDaylight ? '255,255,255' : '222,232,255';
  const colors = Array.from({ length: count }, (_, index) => {
    const depth = seeds[index * PARTICLE_SEED_STRIDE + 3] ?? 0;
    return Skia.Color(`rgba(${rgb},${ALPHA[0] + depth * (ALPHA[1] - ALPHA[0])})`);
  });

  const fallSpeed = FALL_SPEED[0] + (FALL_SPEED[1] - FALL_SPEED[0]) * speed;
  const drift = wind * MAX_WIND_DRIFT;
  const travelHeight = height + EDGE_MARGIN * 2;
  const travelWidth = width + EDGE_MARGIN * 2;
  const anchor = { x: sprite.width / 2, y: sprite.height / 2 };

  const transforms = useRSXformBuffer(count, (transform, index) => {
    'worklet';
    const base = index * PARTICLE_SEED_STRIDE;
    const seedX = seeds[base] ?? 0;
    const seedY = seeds[base + 1] ?? 0;
    const sway = seeds[base + 2] ?? 0;
    const depth = seeds[base + 3] ?? 0;
    const parallax = 0.45 + 0.55 * depth;
    const scale = (SCALE[0] + depth * (SCALE[1] - SCALE[0])) / PARTICLE_TEXTURE_SCALE;
    const t = time.get();
    const swayOffset = Math.sin(t * (0.5 + sway) + seedX * 40) * SWAY_AMPLITUDE * parallax;
    const x = wrap(seedX * travelWidth + t * drift * parallax + swayOffset, travelWidth);
    const y = wrap(seedY * travelHeight + t * fallSpeed * parallax, travelHeight);
    placeSprite(transform, scale, 0, anchor, x - EDGE_MARGIN, y - EDGE_MARGIN);
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
