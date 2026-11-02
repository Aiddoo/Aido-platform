import { Atlas, rect, Skia, type SkImage, useRSXformBuffer } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';

import {
  createParticleSeeds,
  getParticleCount,
  PARTICLE_SEED_STRIDE,
  placeSprite,
  wrap,
} from './weather-scene-particles';
import {
  PARTICLE_SPRITES,
  PARTICLE_TEXTURE_SCALE,
  type ParticleSprite,
} from './weather-scene-textures';

type RainVariant = 'rain' | 'hail';

type RainVariantStyle = {
  sprite: ParticleSprite;
  seed: number;
  fallSpeed: readonly [min: number, max: number];
  scale: readonly [min: number, max: number];
  alpha: readonly [min: number, max: number];
  rgb: { day: string; night: string };
};

const RAIN_VARIANT_STYLES = {
  rain: {
    sprite: PARTICLE_SPRITES.streak,
    seed: 0x7a1d,
    fallSpeed: [700, 1500],
    scale: [0.45, 1],
    alpha: [0.18, 0.5],
    rgb: { day: '255,255,255', night: '196,212,255' },
  },
  hail: {
    sprite: PARTICLE_SPRITES.pellet,
    seed: 0x4a11,
    fallSpeed: [900, 1400],
    scale: [0.5, 1],
    alpha: [0.6, 0.95],
    rgb: { day: '246,250,255', night: '214,226,245' },
  },
} as const satisfies Record<RainVariant, RainVariantStyle>;

const EDGE_MARGIN = 48;

type RainLayerProps = {
  variant: RainVariant;
  density: number;
  speed: number;
  angle: number;
  isDaylight: boolean;
  width: number;
  height: number;
  isLowEndDevice: boolean;
  time: SharedValue<number>;
  texture: SharedValue<SkImage | null>;
};

export function RainLayer({
  variant,
  density,
  speed,
  angle,
  isDaylight,
  width,
  height,
  isLowEndDevice,
  time,
  texture,
}: RainLayerProps) {
  const style = RAIN_VARIANT_STYLES[variant];
  const count = getParticleCount(variant, density, { width, height }, isLowEndDevice);
  const seeds = createParticleSeeds(count, style.seed);
  const { sprite } = style;
  const sprites = Array.from({ length: count }, () =>
    rect(sprite.x, sprite.y, sprite.width, sprite.height),
  );
  const rgb = isDaylight ? style.rgb.day : style.rgb.night;
  const [minAlpha, maxAlpha] = style.alpha;
  const colors = Array.from({ length: count }, (_, index) => {
    const depth = seeds[index * PARTICLE_SEED_STRIDE + 3] ?? 0;
    return Skia.Color(`rgba(${rgb},${minAlpha + depth * (maxAlpha - minAlpha)})`);
  });

  const [minFall, maxFall] = style.fallSpeed;
  const fallSpeed = minFall + (maxFall - minFall) * speed;
  const [minScale, maxScale] = style.scale;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const slope = Math.tan(angle);
  const travelHeight = height + EDGE_MARGIN * 2;
  const travelWidth = width + height * slope + EDGE_MARGIN * 2;
  const anchor = { x: sprite.width / 2, y: sprite.height / 2 };

  const transforms = useRSXformBuffer(count, (transform, index) => {
    'worklet';
    const base = index * PARTICLE_SEED_STRIDE;
    const depth = seeds[base + 3] ?? 0;
    const scale = (minScale + depth * (maxScale - minScale)) / PARTICLE_TEXTURE_SCALE;
    const distance = time.get() * fallSpeed * (0.7 + 0.3 * depth + 0.2 * (seeds[base + 2] ?? 0));
    const travelled = wrap((seeds[base + 1] ?? 0) * travelHeight + distance, travelHeight);
    const x = (seeds[base] ?? 0) * travelWidth - EDGE_MARGIN - height * slope + travelled * slope;
    placeSprite(transform, scale * cos, -scale * sin, anchor, x, travelled - EDGE_MARGIN);
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
