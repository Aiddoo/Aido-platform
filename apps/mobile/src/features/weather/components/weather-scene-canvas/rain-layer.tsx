import { Atlas, Skia, useRSXformBuffer } from '@shopify/react-native-skia';
import { range } from 'es-toolkit';
import { Extrapolation, interpolate, type SharedValue } from 'react-native-reanimated';

import {
  createParticleSeeds,
  getParticleCount,
  PARTICLE_SEED_STRIDE,
  placeSprite,
  wrap,
} from '../../utils/weather-scene-particles.view-model';
import {
  PARTICLE_SAMPLING,
  PARTICLE_SPRITES,
  PARTICLE_TEXTURE_SCALE,
  type ParticleSprite,
  useParticleTexture,
} from './weather-scene-textures';

type RainVariant = 'rain' | 'drizzle';

type RainVariantStyle = {
  sprite: ParticleSprite;
  seed: number;
  fallSpeed: readonly [min: number, max: number];
  scale: readonly [far: number, near: number];
  alpha: readonly [far: number, near: number];
  rgb: { day: string; night: string };
};

const RAIN_VARIANT_STYLES = {
  rain: {
    sprite: PARTICLE_SPRITES.streak,
    seed: 0x7a1d,
    fallSpeed: [560, 1050],
    scale: [0.6, 1.5],
    alpha: [0.16, 0.6],
    rgb: { day: '220,236,255', night: '190,206,240' },
  },
  drizzle: {
    sprite: PARTICLE_SPRITES.streak,
    seed: 0xd122,
    fallSpeed: [260, 520],
    scale: [0.17, 0.42],
    alpha: [0.22, 0.52],
    rgb: { day: '226,236,250', night: '196,208,236' },
  },
} as const satisfies Record<RainVariant, RainVariantStyle>;

const EDGE_MARGIN = 48;
/** 시안 wxFall의 900px 동안 왼쪽으로 24px 기우는 기본 사선 */
const BASE_SLANT = Math.atan(24 / 900);
const FAR_DEPTH_BIAS = 1.6;
const PACE = [0.62, 1];
/** 입자마다 속도를 조금씩 달리해 줄이 맞아 보이지 않게 한다. */
const PACE_JITTER = 0.12;
const UNIT = [0, 1];

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
};

/** 빗줄기(이슬비는 짧고 가는 빗방울)는 멀수록 가늘고 짧고 흐리고 느리게, 바람이 셀수록 왼쪽으로 기울여 깊이를 만든다. */
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
}: RainLayerProps) {
  const texture = useParticleTexture();
  const style = RAIN_VARIANT_STYLES[variant];
  const count = getParticleCount(variant, { density, screen: { width, height }, isLowEndDevice });
  const seeds = createParticleSeeds(count, style.seed);
  const depths = range(count).map(
    (index) => (seeds[index * PARTICLE_SEED_STRIDE + 3] ?? 0) ** FAR_DEPTH_BIAS,
  );
  const { sprite } = style;
  const sprites = range(count).map(() =>
    Skia.XYWHRect(sprite.x, sprite.y, sprite.width, sprite.height),
  );
  const rgb = isDaylight ? style.rgb.day : style.rgb.night;
  const colors = depths.map((depth) =>
    Skia.Color(`rgba(${rgb},${interpolate(depth, UNIT, style.alpha)})`),
  );

  const fallSpeed = interpolate(speed, UNIT, style.fallSpeed, Extrapolation.CLAMP);
  const scaleRange = style.scale;
  const slant = BASE_SLANT + angle;
  const cos = Math.cos(slant);
  const sin = Math.sin(slant);
  const slope = Math.tan(slant);
  const travelHeight = height + EDGE_MARGIN * 2;
  const travelWidth = width + travelHeight * slope + EDGE_MARGIN * 2;
  const anchor = { x: sprite.width / 2, y: sprite.height };

  const transforms = useRSXformBuffer(count, (transform, index) => {
    'worklet';
    const base = index * PARTICLE_SEED_STRIDE;
    const depth = depths[index] ?? 0;
    const scale = interpolate(depth, UNIT, scaleRange) / PARTICLE_TEXTURE_SCALE;
    const pace = interpolate(depth, UNIT, PACE) + PACE_JITTER * (seeds[base + 2] ?? 0);
    const travelled = wrap(
      (seeds[base + 1] ?? 0) * travelHeight + time.get() * fallSpeed * pace,
      travelHeight,
    );
    const x = (seeds[base] ?? 0) * travelWidth - EDGE_MARGIN - travelled * slope;
    placeSprite(transform, scale * cos, scale * sin, anchor, x, travelled - EDGE_MARGIN);
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
