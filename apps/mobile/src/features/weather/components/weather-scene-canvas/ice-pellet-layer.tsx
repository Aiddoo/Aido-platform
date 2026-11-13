import { Atlas, Skia, useRSXformBuffer } from '@shopify/react-native-skia';
import { range } from 'es-toolkit';
import type { SharedValue } from 'react-native-reanimated';

import {
  createParticleSeeds,
  getBounceHeight,
  getParticleCount,
  hashCycle,
  hideSprite,
  PARTICLE_SEED_STRIDE,
  placeSprite,
} from '../../utils/weather-scene-particles.view-model';
import { PARTICLE_SAMPLING, PARTICLE_SPRITES, useParticleTexture } from './weather-scene-textures';

const PELLET_SEED = 0x5ee7;
const DEPTH = [0.4, 1] as const;
const RADIUS = { base: 1, depth: 1.6 } as const;
const FALL = { base: 160, depth: 380 } as const;
const DRIFT_RATIO = 0.06;
/** 바닥은 화면 높이 97% 지점이고, 먼 알갱이일수록 40pt까지 위에 닿는다. */
const GROUND = 0.97;
const FAR_GROUND_LIFT = 40;
const GRAVITY = 900;
const BOUNCE_SPEED = [60, 140] as const;
const BOUNCE_SIDEWAYS = 30;
const SPAWN_ABOVE = 10;
const EXIT_BELOW = 10;
const ALPHA = 0.75;

type IcePelletLayerProps = {
  density: number;
  width: number;
  height: number;
  isLowEndDevice: boolean;
  time: SharedValue<number>;
};

type Pellet = {
  radius: number;
  speed: number;
  floor: number;
  fallDuration: number;
  bounce: { velocity: number; gravity: number };
  period: number;
  offset: number;
};

/** 바닥에서 한 번 튄 뒤 화면 아래로 빠져나갈 때까지 걸리는 시간 */
function getReboundDuration(velocity: number, drop: number): number {
  return (velocity + Math.sqrt(velocity * velocity + 2 * GRAVITY * drop)) / GRAVITY;
}

function createPellets(count: number, height: number): Pellet[] {
  const seeds = createParticleSeeds(count, PELLET_SEED);
  return range(count).map((index) => {
    const base = index * PARTICLE_SEED_STRIDE;
    const [minDepth, maxDepth] = DEPTH;
    const [minBounce, maxBounce] = BOUNCE_SPEED;
    const depth = minDepth + (seeds[base + 3] ?? 0) * (maxDepth - minDepth);
    const speed = FALL.base + FALL.depth * depth;
    const floor = height * GROUND - (1 - depth) * FAR_GROUND_LIFT;
    const fallDuration = (floor + SPAWN_ABOVE) / speed;
    const velocity = (minBounce + (seeds[base + 2] ?? 0) * (maxBounce - minBounce)) * depth;
    const period = fallDuration + getReboundDuration(velocity, height + EXIT_BELOW - floor);
    return {
      radius: RADIUS.base + RADIUS.depth * depth,
      speed,
      floor,
      fallDuration,
      bounce: { velocity, gravity: GRAVITY },
      period,
      offset: (seeds[base + 1] ?? 0) * period,
    };
  });
}

/** 진눈깨비: 빗줄기 사이로 반투명한 얼음 알갱이가 떨어져 바닥에서 톡 튄다. */
export function IcePelletLayer({
  density,
  width,
  height,
  isLowEndDevice,
  time,
}: IcePelletLayerProps) {
  const texture = useParticleTexture();
  const count = getParticleCount('pellet', { density, screen: { width, height }, isLowEndDevice });
  const pellets = createPellets(count, height);
  const { ice } = PARTICLE_SPRITES;
  const sprites = pellets.map(() => Skia.XYWHRect(ice.x, ice.y, ice.width, ice.height));
  const color = Skia.Color(`rgba(255,255,255,${ALPHA})`);
  const colors = pellets.map(() => color);
  const anchor = { x: ice.width / 2, y: ice.height / 2 };

  const transforms = useRSXformBuffer(count, (transform, index) => {
    'worklet';
    const pellet = pellets[index];
    if (pellet == null) {
      return;
    }
    const elapsed = time.get() + pellet.offset;
    const cycle = Math.floor(elapsed / pellet.period);
    const local = elapsed - cycle * pellet.period;
    const startX = width * hashCycle(index, cycle, 0);
    const scale = (pellet.radius * 2) / ice.width;
    if (local < pellet.fallDuration) {
      placeSprite(
        transform,
        scale,
        0,
        anchor,
        startX + pellet.speed * DRIFT_RATIO * local,
        pellet.speed * local - SPAWN_ABOVE,
      );
      return;
    }
    const rebound = local - pellet.fallDuration;
    const y = pellet.floor - getBounceHeight(pellet.bounce, rebound);
    if (y > height + EXIT_BELOW) {
      hideSprite(transform);
      return;
    }
    const landX = startX + pellet.speed * DRIFT_RATIO * pellet.fallDuration;
    const sideways = (hashCycle(index, cycle, 1) * 2 - 1) * BOUNCE_SIDEWAYS;
    placeSprite(transform, scale, 0, anchor, landX + sideways * rebound, y);
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
