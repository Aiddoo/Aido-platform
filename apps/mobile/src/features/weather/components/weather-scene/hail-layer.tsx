import { Atlas, Group, Skia, useRSXformBuffer } from '@shopify/react-native-skia';
import { range } from 'es-toolkit';
import type { SharedValue } from 'react-native-reanimated';

import {
  type Bounce,
  createParticleSeeds,
  getBouncePhase,
  getBounceHeight,
  getBouncesDuration,
  getParticleCount,
  hashCycle,
  hideSprite,
  PARTICLE_SEED_STRIDE,
  placeSprite,
} from '../../utils/weather-scene-particles.view-model';
import { PARTICLE_SAMPLING, PARTICLE_SPRITES, useParticleTexture } from './weather-scene-textures';

const HAIL_SEED = 0x4a11;
/** hashCycle의 salt. 같은 알의 값끼리 겹치면 입자 모양이 같아지므로 서로 다른 번호를 쓴다. */
const SALT_START_X = 0;
const SALT_BOUNCE_SPEED = 1;
/** 튀는 횟수(bounce)를 더해 옆으로 튀는 값마다 따로 정한다. */
const SALT_SIDEWAYS = 2;
/** 파편은 SALT_SIDEWAYS 뒤 번호부터 파편마다 세 값(옆, 높이, 크기)씩 쓴다. */
const SALT_SHARD_BASE = 4;
const SALTS_PER_SHARD = 3;
const DEPTH = [0.35, 1] as const;
const RADIUS = { base: 1.8, depth: 3.4 } as const;
const FALL = { base: 300, depth: 700 } as const;
const DRIFT = { base: 0.05, wind: 0.2 } as const;
const SPIN = 4;
/** 바닥은 화면 높이 97% 지점이고, 먼 알일수록 60pt까지 위에 닿는다. */
const GROUND = 0.97;
const FAR_GROUND_LIFT = 60;
const GRAVITY = 1400;
/** 첫 번째는 높이, 두 번째는 낮게 튄다(깊이를 곱한 초속 범위). */
const BOUNCE_SPEEDS = [
  [160, 300],
  [50, 110],
] as const;
const BOUNCE_SIDEWAYS = 60;
const REST_SECONDS = [0, 0.8] as const;
const SPAWN_ABOVE = 20;
const TRAIL = { alpha: 0.16, lengthPerSpeed: 0.03 } as const;
/** 첫 바닥에서 튀는 작은 파편 */
const SHARDS_PER_STONE = 3;
const SHARD = {
  life: 0.4,
  gravity: 900,
  sideways: 80,
  lift: [60, 160],
  radius: [0.5, 1.2],
  sizeRatio: 4,
} as const;
const SHARD_COLOR = 'rgba(240,246,255,0.9)';

type HailLayerProps = {
  density: number;
  wind: number;
  width: number;
  height: number;
  isLowEndDevice: boolean;
  time: SharedValue<number>;
};

type Hailstone = {
  depth: number;
  radius: number;
  speed: number;
  drift: number;
  spin: number;
  floor: number;
  fallDuration: number;
  bounces: Bounce[];
  period: number;
  offset: number;
};

function createHailstones(count: number, wind: number, height: number): Hailstone[] {
  const seeds = createParticleSeeds(count, HAIL_SEED);
  return range(count).map((index) => {
    const base = index * PARTICLE_SEED_STRIDE;
    const [minDepth, maxDepth] = DEPTH;
    const [minRest, maxRest] = REST_SECONDS;
    const depth = minDepth + (seeds[base + 3] ?? 0) * (maxDepth - minDepth);
    const speed = FALL.base + FALL.depth * depth;
    const floor = height * GROUND - (1 - depth) * FAR_GROUND_LIFT;
    const fallDuration = (floor + SPAWN_ABOVE) / speed;
    const bounces = BOUNCE_SPEEDS.map(([min, max], bounce) => ({
      velocity: (min + hashCycle(index, bounce, SALT_BOUNCE_SPEED) * (max - min)) * depth,
      gravity: GRAVITY,
    }));
    const rest = minRest + (seeds[base + 2] ?? 0) * (maxRest - minRest);
    const period = fallDuration + getBouncesDuration(bounces) + rest;
    return {
      depth,
      radius: RADIUS.base + RADIUS.depth * depth,
      speed,
      drift: speed * (DRIFT.base + wind * DRIFT.wind),
      spin: ((seeds[base + 2] ?? 0) * 2 - 1) * SPIN,
      floor,
      fallDuration,
      bounces,
      period,
      offset: (seeds[base + 1] ?? 0) * period,
    };
  });
}

/** 크기가 다른 얼음 알이 빛을 받으며 돌며 떨어지고, 바닥에서 두 번 튀며 작은 파편이 흩어진다. */
export function HailLayer({ density, wind, width, height, isLowEndDevice, time }: HailLayerProps) {
  const texture = useParticleTexture();
  const count = getParticleCount('hail', { density, screen: { width, height }, isLowEndDevice });
  const stones = createHailstones(count, wind, height);
  const shardCount = count * SHARDS_PER_STONE;
  const { ice, streak, dot } = PARTICLE_SPRITES;
  const iceSprites = stones.map(() => Skia.XYWHRect(ice.x, ice.y, ice.width, ice.height));
  const trailSprites = stones.map(() =>
    Skia.XYWHRect(streak.x, streak.y, streak.width, streak.height),
  );
  const trailColors = stones.map((stone) =>
    Skia.Color(`rgba(230,240,255,${TRAIL.alpha * stone.depth})`),
  );
  const shardSprites = range(shardCount).map(() =>
    Skia.XYWHRect(dot.x, dot.y, dot.width, dot.height),
  );
  const shardColor = Skia.Color(SHARD_COLOR);
  const shardColors = range(shardCount).map(() => shardColor);
  const getSideways = (index: number, cycle: number, bounce: number) => {
    'worklet';
    return (hashCycle(index, cycle, SALT_SIDEWAYS + bounce) * 2 - 1) * BOUNCE_SIDEWAYS;
  };
  const iceAnchor = { x: ice.width / 2, y: ice.height / 2 };
  const trailAnchor = { x: streak.width / 2, y: streak.height };
  const dotAnchor = { x: dot.width / 2, y: dot.height / 2 };

  const stoneAt = (stone: Hailstone, index: number, t: number) => {
    'worklet';
    const elapsed = t + stone.offset;
    const cycle = Math.floor(elapsed / stone.period);
    const local = elapsed - cycle * stone.period;
    const startX = width * hashCycle(index, cycle, SALT_START_X);
    const landX = startX + stone.drift * stone.fallDuration;
    return {
      cycle,
      startX,
      landX,
      local,
      phase: getBouncePhase(local, stone.fallDuration, stone.bounces),
    };
  };

  const iceTransforms = useRSXformBuffer(count, (transform, index) => {
    'worklet';
    const stone = stones[index];
    if (stone == null) {
      return;
    }
    const t = time.get();
    const { cycle, startX, landX, local, phase } = stoneAt(stone, index, t);
    const rotation = stone.spin * t;
    const scale = (stone.radius * 2) / ice.width;
    const cos = scale * Math.cos(rotation);
    const sin = scale * Math.sin(rotation);
    if (phase.phase === 'falling') {
      placeSprite(
        transform,
        cos,
        sin,
        iceAnchor,
        startX + stone.drift * local,
        stone.speed * local - SPAWN_ABOVE,
      );
      return;
    }
    if (phase.phase === 'resting') {
      hideSprite(transform);
      return;
    }
    const bounce = stone.bounces[phase.bounce];
    if (bounce == null) {
      hideSprite(transform);
      return;
    }
    const firstBounce = stone.bounces[0];
    const reboundX =
      phase.bounce === 0 || firstBounce == null
        ? landX
        : landX + getSideways(index, cycle, 0) * ((2 * firstBounce.velocity) / firstBounce.gravity);
    placeSprite(
      transform,
      cos,
      sin,
      iceAnchor,
      reboundX + getSideways(index, cycle, phase.bounce) * phase.elapsed,
      stone.floor - getBounceHeight(bounce, phase.elapsed),
    );
  });

  const trailTransforms = useRSXformBuffer(count, (transform, index) => {
    'worklet';
    const stone = stones[index];
    if (stone == null) {
      return;
    }
    const { startX, local, phase } = stoneAt(stone, index, time.get());
    if (phase.phase !== 'falling') {
      hideSprite(transform);
      return;
    }
    const scale = (stone.speed * TRAIL.lengthPerSpeed) / streak.height;
    placeSprite(
      transform,
      scale,
      0,
      trailAnchor,
      startX + stone.drift * local,
      stone.speed * local - SPAWN_ABOVE - stone.radius,
    );
  });

  const shardTransforms = useRSXformBuffer(shardCount, (transform, slot) => {
    'worklet';
    const index = Math.floor(slot / SHARDS_PER_STONE);
    const shard = slot % SHARDS_PER_STONE;
    const stone = stones[index];
    if (stone == null) {
      return;
    }
    const { cycle, landX, phase } = stoneAt(stone, index, time.get());
    if (phase.phase !== 'bouncing' || phase.bounce !== 0 || phase.elapsed >= SHARD.life) {
      hideSprite(transform);
      return;
    }
    const s = phase.elapsed;
    const [minLift, maxLift] = SHARD.lift;
    const [minRadius, maxRadius] = SHARD.radius;
    const salt = SALT_SHARD_BASE + shard * SALTS_PER_SHARD;
    const vx = (hashCycle(index, cycle, salt) * 2 - 1) * SHARD.sideways;
    const lift = minLift + hashCycle(index, cycle, salt + 1) * (maxLift - minLift);
    const radius = minRadius + hashCycle(index, cycle, salt + 2) * (maxRadius - minRadius);
    const scale = (radius * SHARD.sizeRatio * (1 - s / SHARD.life)) / dot.width;
    placeSprite(
      transform,
      scale,
      0,
      dotAnchor,
      landX + vx * s,
      stone.floor - lift * s + 0.5 * SHARD.gravity * s * s,
    );
  });

  return (
    <Group>
      <Atlas
        image={texture}
        sprites={trailSprites}
        transforms={trailTransforms}
        colors={trailColors}
        colorBlendMode="modulate"
        sampling={PARTICLE_SAMPLING}
      />
      <Atlas
        image={texture}
        sprites={iceSprites}
        transforms={iceTransforms}
        sampling={PARTICLE_SAMPLING}
      />
      <Atlas
        image={texture}
        sprites={shardSprites}
        transforms={shardTransforms}
        colors={shardColors}
        colorBlendMode="modulate"
        sampling={PARTICLE_SAMPLING}
      />
    </Group>
  );
}
