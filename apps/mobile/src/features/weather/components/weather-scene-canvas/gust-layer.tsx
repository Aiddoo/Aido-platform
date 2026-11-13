import { Atlas, Group, Skia, useRSXformBuffer } from '@shopify/react-native-skia';
import { range } from 'es-toolkit';
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';
import { match } from 'ts-pattern';

import {
  createParticleSeeds,
  getAmbientCount,
  getGust,
  getGustTravel,
  getSceneReferenceWidth,
  hashCycle,
  PARTICLE_SEED_STRIDE,
  placeSprite,
  wrap,
} from '../../utils/weather-scene-particles.view-model';
import {
  PARTICLE_SAMPLING,
  PARTICLE_SPRITES,
  useParticleTexture,
  useWindStreakTexture,
  WIND_STREAK_SPRITE,
} from './weather-scene-textures';

const STREAK_SEED = 0x6057;
const LEAF_SEED = 0x1eaf;
/** 줄기는 화면 왼쪽 밖(폭의 1.4배)에서 들어와 오른쪽 밖(1.2배)으로 빠져나간다. */
const STREAK_TRAVEL = { start: -1.4, end: 1.2 } as const;
const STREAK_LANES = [0.05, 0.95] as const;
const STREAK_LENGTH = [0.35, 0.9] as const;
const STREAK_ANCHOR = { x: 0, y: WIND_STREAK_SPRITE.height / 2 };
const LEAF_SIZE = [8, 15] as const;
const LEAF_SPEED = [160, 340] as const;
const LEAF_SPIN = 6;
const LEAF_FLUTTER = { amplitude: 16, frequency: 3 } as const;
const LEAF_FLIP = { min: 0.4, swing: 0.6, frequency: 0.7 } as const;
const LEAF_LANES = [0.1, 1] as const;
const LEAF_OPACITY = 0.85;
const EDGE_MARGIN = 20;

type GustTone = 'air' | 'icy';

type StreakStyle = {
  count: number;
  /** 화면 폭 대비 초당 이동 */
  speed: readonly [min: number, max: number];
  alpha: readonly [min: number, max: number];
  rgb: string;
};

function getStreakStyle(tone: GustTone): StreakStyle {
  return match(tone)
    .returnType<StreakStyle>()
    .with('air', () => ({ count: 14, speed: [1, 1.7], alpha: [0.14, 0.3], rgb: '255,255,255' }))
    .with('icy', () => ({ count: 12, speed: [1.3, 2.2], alpha: [0.16, 0.34], rgb: '210,235,255' }))
    .exhaustive();
}

type GustStreaksProps = {
  tone: GustTone;
  width: number;
  height: number;
  time: SharedValue<number>;
};

/** 돌풍 리듬에 맞춰 세졌다 약해지며 화면을 가로지르는 물결 모양 바람 줄기 */
export function GustStreaks({ tone, width, height, time }: GustStreaksProps) {
  const texture = useWindStreakTexture();
  const style = getStreakStyle(tone);
  const seeds = createParticleSeeds(style.count, STREAK_SEED);
  const sprites = range(style.count).map(() =>
    Skia.XYWHRect(0, 0, WIND_STREAK_SPRITE.width, WIND_STREAK_SPRITE.height),
  );
  const colors = range(style.count).map((index) => {
    const [min, max] = style.alpha;
    const alpha = min + (seeds[index * PARTICLE_SEED_STRIDE + 3] ?? 0) * (max - min);
    return Skia.Color(`rgba(${style.rgb},${alpha})`);
  });
  const travel = (STREAK_TRAVEL.end - STREAK_TRAVEL.start) * width;
  const referenceWidth = getSceneReferenceWidth(width);
  const opacity = useDerivedValue(() => getGust(time.get()));

  const transforms = useRSXformBuffer(style.count, (transform, index) => {
    'worklet';
    const base = index * PARTICLE_SEED_STRIDE;
    const [minSpeed, maxSpeed] = style.speed;
    const [minLength, maxLength] = STREAK_LENGTH;
    const [topLane, bottomLane] = STREAK_LANES;
    const speed = width * (minSpeed + (seeds[base + 1] ?? 0) * (maxSpeed - minSpeed));
    const distance = (seeds[base] ?? 0) * travel + speed * getGustTravel(time.get());
    const cycle = Math.floor(distance / travel);
    const length =
      referenceWidth * (minLength + hashCycle(index, cycle, 1) * (maxLength - minLength));
    const y = height * (topLane + hashCycle(index, cycle, 2) * (bottomLane - topLane));
    const x = STREAK_TRAVEL.start * width + wrap(distance, travel);
    placeSprite(transform, length / WIND_STREAK_SPRITE.width, 0, STREAK_ANCHOR, x, y);
  });

  return (
    <Group opacity={opacity}>
      <Atlas
        image={texture}
        sprites={sprites}
        transforms={transforms}
        colors={colors}
        colorBlendMode="modulate"
        sampling={PARTICLE_SAMPLING}
      />
    </Group>
  );
}

type GustLayerProps = {
  width: number;
  height: number;
  isLowEndDevice: boolean;
  time: SharedValue<number>;
};

/** 강한 바람: 바람 줄기 사이로 마른 잎이 뒤집히며 날아간다. */
export function GustLayer({ width, height, isLowEndDevice, time }: GustLayerProps) {
  return (
    <Group>
      <GustStreaks tone="air" width={width} height={height} time={time} />
      <GustLayer.Leaves width={width} height={height} isLowEndDevice={isLowEndDevice} time={time} />
    </Group>
  );
}

GustLayer.Leaves = function Leaves({ width, height, isLowEndDevice, time }: GustLayerProps) {
  const texture = useParticleTexture();
  const count = getAmbientCount('leaf', { screen: { width, height }, isLowEndDevice });
  const seeds = createParticleSeeds(count, LEAF_SEED);
  const { leaf } = PARTICLE_SPRITES;
  const sprites = range(count).map(() => Skia.XYWHRect(leaf.x, leaf.y, leaf.width, leaf.height));
  const anchor = { x: leaf.width / 2, y: leaf.height / 2 };
  const travelWidth = width + EDGE_MARGIN * 2;

  const transforms = useRSXformBuffer(count, (transform, index) => {
    'worklet';
    const base = index * PARTICLE_SEED_STRIDE;
    const t = time.get();
    const [minSize, maxSize] = LEAF_SIZE;
    const [minSpeed, maxSpeed] = LEAF_SPEED;
    const [topLane, bottomLane] = LEAF_LANES;
    const phase = (seeds[base + 3] ?? 0) * Math.PI * 2;
    const speed = minSpeed + (seeds[base + 1] ?? 0) * (maxSpeed - minSpeed);
    const spin = ((seeds[base + 2] ?? 0) * 2 - 1) * LEAF_SPIN;
    const rotation = phase + spin * t;
    const flip =
      LEAF_FLIP.min + LEAF_FLIP.swing * Math.abs(Math.sin(rotation * LEAF_FLIP.frequency));
    const size = minSize + (seeds[base + 2] ?? 0) * (maxSize - minSize);
    const scale = (size * flip) / leaf.width;
    const distance = (seeds[base] ?? 0) * travelWidth + speed * getGustTravel(t);
    const cycle = Math.floor(distance / travelWidth);
    const x = wrap(distance, travelWidth) - EDGE_MARGIN;
    const y =
      height * (topLane + hashCycle(index, cycle, 1) * (bottomLane - topLane)) +
      Math.sin(t * LEAF_FLUTTER.frequency + phase) * LEAF_FLUTTER.amplitude;
    placeSprite(transform, scale * Math.cos(rotation), scale * Math.sin(rotation), anchor, x, y);
  });

  return (
    <Group opacity={LEAF_OPACITY}>
      <Atlas
        image={texture}
        sprites={sprites}
        transforms={transforms}
        sampling={PARTICLE_SAMPLING}
      />
    </Group>
  );
};
