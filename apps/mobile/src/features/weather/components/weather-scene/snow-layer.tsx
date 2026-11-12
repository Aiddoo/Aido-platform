import { Atlas, Group, Skia, useRSXformBuffer } from '@shopify/react-native-skia';
import { range } from 'es-toolkit';
import type { SharedValue } from 'react-native-reanimated';

import {
  createParticleSeeds,
  getParticleCount,
  PARTICLE_SEED_STRIDE,
  placeSprite,
  wrap,
} from '../../utils/weather-scene-particles.view-model';
import { PARTICLE_SAMPLING, PARTICLE_SPRITES, useParticleTexture } from './weather-scene-textures';

const SNOW_SEED = 0x5a0f;
const EDGE_MARGIN = 30;
/** 깊이는 0(먼 층)~1(가까운 층). 먼 송이가 더 많도록 치우친다. */
const DEPTH_BIAS = 1.6;
const RADIUS = { base: 0.8, depth: 3.6 } as const;
const FALL = { base: 24, speed: 60, near: 0.35 } as const;
const SWAY_AMPLITUDE = [6, 22] as const;
const SWAY_DEPTH_BASE = 0.4;
const SWAY_FREQUENCY = [0.4, 1.1] as const;
/** 눈 결정은 흔들림 빈도가 가운데 값에서 벗어난 만큼 결정마다 다르게 돈다. */
const SWAY_FREQUENCY_MIDPOINT = (SWAY_FREQUENCY[0] + SWAY_FREQUENCY[1]) / 2;
const CRYSTAL_SPIN_SPREAD = 2;
const ALPHA = { base: 0.35, depth: 0.6 } as const;
const WIND_DRIFT = 60;
const DOT_SIZE_RATIO = 3.6;
/** 이 깊이보다 가까운 송이는 결정 모양이 보이고 천천히 돈다. */
const CRYSTAL_DEPTH = 0.75;
const CRYSTAL_SIZE_RATIO = 3.2;
const CRYSTAL_ALPHA = 0.4;
const CRYSTAL_SPIN = 0.6;

type SnowLayerProps = {
  density: number;
  speed: number;
  angle: number;
  wind: number;
  isDaylight: boolean;
  width: number;
  height: number;
  isLowEndDevice: boolean;
  time: SharedValue<number>;
};

type Flake = {
  x: number;
  y: number;
  depth: number;
  radius: number;
  phase: number;
  swayAmplitude: number;
  swayFrequency: number;
};

function createFlakes(count: number): Flake[] {
  const seeds = createParticleSeeds(count, SNOW_SEED);
  const [minAmplitude, maxAmplitude] = SWAY_AMPLITUDE;
  const [minFrequency, maxFrequency] = SWAY_FREQUENCY;
  return range(count).map((index) => {
    const base = index * PARTICLE_SEED_STRIDE;
    const depth = (seeds[base + 3] ?? 0) ** DEPTH_BIAS;
    const sway = seeds[base + 2] ?? 0;
    return {
      x: seeds[base] ?? 0,
      y: seeds[base + 1] ?? 0,
      depth,
      radius: RADIUS.base + depth * RADIUS.depth,
      phase: sway * Math.PI * 2,
      swayAmplitude:
        (minAmplitude + sway * (maxAmplitude - minAmplitude)) * (SWAY_DEPTH_BASE + depth),
      swayFrequency: minFrequency + (1 - sway) * (maxFrequency - minFrequency),
    };
  });
}

/** 멀고 가까운 깊이마다 크기·속도·투명도가 다르고, 가까운 송이는 결정 모양으로 돌며 흔들린다. 바람이 세면 비스듬히 몰아친다. */
export function SnowLayer({
  density,
  speed,
  angle,
  wind,
  isDaylight,
  width,
  height,
  isLowEndDevice,
  time,
}: SnowLayerProps) {
  const texture = useParticleTexture();
  const count = getParticleCount('snow', { density, screen: { width, height }, isLowEndDevice });
  const flakes = createFlakes(count);
  const crystals = flakes.flatMap((flake, index) => (flake.depth > CRYSTAL_DEPTH ? [index] : []));
  const rgb = isDaylight ? '255,255,255' : '226,234,255';
  const { dot, crystal } = PARTICLE_SPRITES;
  const dotSprites = flakes.map(() => Skia.XYWHRect(dot.x, dot.y, dot.width, dot.height));
  const dotColors = flakes.map((flake) =>
    Skia.Color(`rgba(${rgb},${ALPHA.base + ALPHA.depth * flake.depth})`),
  );
  const crystalSprites = crystals.map(() =>
    Skia.XYWHRect(crystal.x, crystal.y, crystal.width, crystal.height),
  );
  const crystalColors = crystals.map((index) =>
    Skia.Color(`rgba(${rgb},${CRYSTAL_ALPHA * (flakes[index]?.depth ?? 0)})`),
  );
  const travelHeight = height + EDGE_MARGIN * 2;
  const travelWidth = width + EDGE_MARGIN * 2;
  const slope = Math.tan(angle);
  const dotAnchor = { x: dot.width / 2, y: dot.height / 2 };
  const crystalAnchor = { x: crystal.width / 2, y: crystal.height / 2 };

  const getPosition = (flake: Flake, t: number) => {
    'worklet';
    const fall = (FALL.base + FALL.speed * speed) * (FALL.near + flake.depth);
    const drift = fall * slope + wind * WIND_DRIFT * flake.depth;
    const sway =
      (Math.sin(t * flake.swayFrequency + flake.phase) * flake.swayAmplitude) / flake.swayFrequency;
    return {
      x: wrap(flake.x * travelWidth + t * drift + sway, travelWidth) - EDGE_MARGIN,
      y: wrap(flake.y * travelHeight + t * fall, travelHeight) - EDGE_MARGIN,
    };
  };

  const dotTransforms = useRSXformBuffer(count, (transform, index) => {
    'worklet';
    const flake = flakes[index];
    if (flake == null) {
      return;
    }
    const { x, y } = getPosition(flake, time.get());
    placeSprite(transform, (flake.radius * DOT_SIZE_RATIO) / dot.width, 0, dotAnchor, x, y);
  });

  const crystalTransforms = useRSXformBuffer(crystals.length, (transform, slot) => {
    'worklet';
    const flake = flakes[crystals[slot] ?? 0];
    if (flake == null) {
      return;
    }
    const t = time.get();
    const { x, y } = getPosition(flake, t);
    const rotation =
      flake.phase +
      (flake.swayFrequency - SWAY_FREQUENCY_MIDPOINT) * CRYSTAL_SPIN * CRYSTAL_SPIN_SPREAD * t;
    const scale = (flake.radius * CRYSTAL_SIZE_RATIO) / crystal.width;
    placeSprite(
      transform,
      scale * Math.cos(rotation),
      scale * Math.sin(rotation),
      crystalAnchor,
      x,
      y,
    );
  });

  return (
    <Group>
      <Atlas
        image={texture}
        sprites={dotSprites}
        transforms={dotTransforms}
        colors={dotColors}
        colorBlendMode="modulate"
        sampling={PARTICLE_SAMPLING}
      />
      <Atlas
        image={texture}
        sprites={crystalSprites}
        transforms={crystalTransforms}
        colors={crystalColors}
        colorBlendMode="modulate"
        sampling={PARTICLE_SAMPLING}
      />
    </Group>
  );
}
