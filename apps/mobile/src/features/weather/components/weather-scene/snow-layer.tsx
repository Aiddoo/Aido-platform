import { Atlas, rect, Skia, type SkImage, useRSXformBuffer } from '@shopify/react-native-skia';
import { Extrapolation, interpolate, type SharedValue } from 'react-native-reanimated';

import {
  createParticleSeeds,
  getParticleCount,
  PARTICLE_SEED_STRIDE,
  placeSprite,
  wrap,
} from './weather-scene-particles';
import {
  PARTICLE_SAMPLING,
  PARTICLE_SPRITES,
  PARTICLE_TEXTURE_SCALE,
} from './weather-scene-textures';

const SNOW_SEED = 0x5a0f;
const EDGE_MARGIN = 24;
const FALL_SPEED = [60, 160];
const MAX_WIND_DRIFT = 60;
const SWAY_AMPLITUDE = [8, 18];
const SWAY_FREQUENCY = [0.7, 1.3];
/** 이 깊이보다 가까운 눈송이는 초점이 나간 큰 송이로 그린다. */
const BOKEH_DEPTH = 0.62;
const FAR = { depth: [0, BOKEH_DEPTH], scale: [0.3, 0.6], alpha: [0.5, 0.85] };
const NEAR = { depth: [BOKEH_DEPTH, 1], scale: [0.6, 1.1], alpha: [0.32, 0.55] };
const UNIT = [0, 1];

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

/** 멀리 있는 눈송이는 작고 또렷하고 느리게, 가까운 송이는 크고 흐리게 그려 시차를 만든다. */
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
  const depthOf = (index: number) => seeds[index * PARTICLE_SEED_STRIDE + 3] ?? 0;
  const sprites = Array.from({ length: count }, (_, index) => {
    const sprite =
      depthOf(index) < BOKEH_DEPTH ? PARTICLE_SPRITES.flake : PARTICLE_SPRITES.flakeSoft;
    return rect(sprite.x, sprite.y, sprite.width, sprite.height);
  });
  const rgb = isDaylight ? '255,255,255' : '226,234,255';
  const colors = Array.from({ length: count }, (_, index) => {
    const depth = depthOf(index);
    const tier = depth < BOKEH_DEPTH ? FAR : NEAR;
    const alpha = interpolate(depth, tier.depth, tier.alpha, Extrapolation.CLAMP);
    return Skia.Color(`rgba(${rgb},${alpha})`);
  });

  const fallSpeed = interpolate(speed, UNIT, FALL_SPEED, Extrapolation.CLAMP);
  const drift = wind * MAX_WIND_DRIFT;
  const travelHeight = height + EDGE_MARGIN * 2;
  const travelWidth = width + EDGE_MARGIN * 2;
  const farAnchor = PARTICLE_SPRITES.flake.width / 2;
  const nearAnchor = PARTICLE_SPRITES.flakeSoft.width / 2;

  const transforms = useRSXformBuffer(count, (transform, index) => {
    'worklet';
    const base = index * PARTICLE_SEED_STRIDE;
    const seedX = seeds[base] ?? 0;
    const seedY = seeds[base + 1] ?? 0;
    const sway = seeds[base + 2] ?? 0;
    const depth = seeds[base + 3] ?? 0;
    const isNear = depth >= BOKEH_DEPTH;
    const tier = isNear ? NEAR : FAR;
    const scale =
      interpolate(depth, tier.depth, tier.scale, Extrapolation.CLAMP) / PARTICLE_TEXTURE_SCALE;
    const anchor = isNear ? nearAnchor : farAnchor;
    const parallax = 0.45 + 0.55 * depth;
    const t = time.get();
    const swayOffset =
      Math.sin(t * interpolate(sway, UNIT, SWAY_FREQUENCY) + seedX * 40) *
      interpolate(depth, UNIT, SWAY_AMPLITUDE);
    const x = wrap(seedX * travelWidth + t * drift * parallax + swayOffset, travelWidth);
    const y = wrap(seedY * travelHeight + t * fallSpeed * parallax, travelHeight);
    placeSprite(transform, scale, 0, { x: anchor, y: anchor }, x - EDGE_MARGIN, y - EDGE_MARGIN);
  });

  return (
    <Atlas
      image={texture}
      sprites={sprites}
      transforms={transforms}
      colors={colors}
      colorBlendMode="modulate"
      sampling={PARTICLE_SAMPLING}
    />
  );
}
