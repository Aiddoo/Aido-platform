import type { SkRSXform } from '@shopify/react-native-skia';
import { clamp } from 'es-toolkit';

export const PARTICLE_SEED_STRIDE = 4;

const MIXING_INCREMENT = 0x6d2b79f5;
const REFERENCE_SCREEN_AREA = 390 * 844;
const LIGHTNING_WINDOW_SECONDS = 7;
const LIGHTNING_SKIP_RATIO = 0.35;
const LIGHTNING_EDGE_MARGIN_SECONDS = 1.5;
const LIGHTNING_LEADER = { offset: 0, duration: 0.2, strength: 1 } as const;
const LIGHTNING_RETURN = { offset: 0.34, duration: 0.24, strength: 0.62 } as const;
const LIGHTNING_ATTACK_RATIO = 0.12;
const STAR_SCREEN_AREA_PER_STAR = 5200;
const STAR_FIELD_HEIGHT_RATIO = 0.6;
const STAR_HORIZON_FALLOFF = 1.8;
const BRIGHT_STAR_RATIO = 0.12;
const MIN_VISIBLE_CLOUDS = 0.02;

export const STAR_TWINKLE_GROUPS = 5;
export const MAX_STARS = 110;
export const MAX_CLOUDS = 7;

export const PARTICLE_BUDGETS = {
  rain: { full: 160, standardCap: 240, lowEndCap: 110 },
  snow: { full: 110, standardCap: 170, lowEndCap: 80 },
  hail: { full: 70, standardCap: 110, lowEndCap: 50 },
} as const;

export type ParticleBudgetKind = keyof typeof PARTICLE_BUDGETS;

function mixToUnit(state: number): number {
  'worklet';
  let mixed = state;
  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
}

function hashToUnit(index: number): number {
  'worklet';
  return mixToUnit(Math.imul(index + 1, MIXING_INCREMENT));
}

export function createSeededRandom(seed: number): () => number {
  let state = seed | 0;
  return function nextRandom() {
    state = (state + MIXING_INCREMENT) | 0;
    return mixToUnit(state);
  };
}

export function createParticleSeeds(count: number, seed: number): number[] {
  const random = createSeededRandom(seed);
  return Array.from({ length: count * PARTICLE_SEED_STRIDE }, random);
}

export function getParticleCount(
  kind: ParticleBudgetKind,
  density: number,
  screen: { width: number; height: number },
  isLowEndDevice: boolean,
): number {
  if (!(density > 0) || !(screen.width > 0) || !(screen.height > 0)) {
    return 0;
  }
  const budget = PARTICLE_BUDGETS[kind];
  const areaRatio = (screen.width * screen.height) / REFERENCE_SCREEN_AREA;
  const cap = isLowEndDevice ? budget.lowEndCap : budget.standardCap;
  return Math.min(cap, Math.round(budget.full * clamp(density, 0, 1) * areaRatio));
}

export type Star = {
  x: number;
  y: number;
  radius: number;
  group: number;
  isBright: boolean;
};

/** 별은 지평선(아래)으로 갈수록 드물고, 일부만 크게 빛나며 반짝임 위상 그룹을 나눠 가진다. */
export function createStarField(width: number, height: number, seed: number): Star[] {
  if (!(width > 0) || !(height > 0)) {
    return [];
  }
  const random = createSeededRandom(seed);
  const count = Math.min(MAX_STARS, Math.round((width * height) / STAR_SCREEN_AREA_PER_STAR));
  return Array.from({ length: count }, (_, index) => {
    const x = random() * width;
    const y = random() ** STAR_HORIZON_FALLOFF * height * STAR_FIELD_HEIGHT_RATIO;
    const isBright = random() < BRIGHT_STAR_RATIO;
    const radius = isBright ? 1.1 + random() * 0.4 : 0.45 + random() ** 2 * 0.55;
    return { x, y, radius, group: index % STAR_TWINKLE_GROUPS, isBright };
  });
}

export function getCloudCount(amount: number): number {
  if (!(amount >= MIN_VISIBLE_CLOUDS)) {
    return 0;
  }
  return Math.round(2 + clamp(amount, 0, 1) * (MAX_CLOUDS - 2));
}

export function wrap(value: number, length: number): number {
  'worklet';
  return value - Math.floor(value / length) * length;
}

export function placeSprite(
  transform: SkRSXform,
  scaledCos: number,
  scaledSin: number,
  anchor: { x: number; y: number },
  x: number,
  y: number,
) {
  'worklet';
  transform.set(
    scaledCos,
    scaledSin,
    x - (scaledCos * anchor.x - scaledSin * anchor.y),
    y - (scaledSin * anchor.x + scaledCos * anchor.y),
  );
}

function getPulseIntensity(
  local: number,
  pulse: { offset: number; duration: number; strength: number },
): number {
  'worklet';
  const progress = (local - pulse.offset) / pulse.duration;
  if (progress < 0 || progress >= 1) {
    return 0;
  }
  if (progress < LIGHTNING_ATTACK_RATIO) {
    return (pulse.strength * progress) / LIGHTNING_ATTACK_RATIO;
  }
  const decay = (1 - progress) / (1 - LIGHTNING_ATTACK_RATIO);
  return pulse.strength * decay * decay;
}

export function getLightningIntensity(time: number): number {
  'worklet';
  const windowIndex = Math.floor(time / LIGHTNING_WINDOW_SECONDS);
  if (hashToUnit(windowIndex * 2) < LIGHTNING_SKIP_RATIO) {
    return 0;
  }
  const usable = LIGHTNING_WINDOW_SECONDS - LIGHTNING_EDGE_MARGIN_SECONDS * 2;
  const start = LIGHTNING_EDGE_MARGIN_SECONDS + hashToUnit(windowIndex * 2 + 1) * usable;
  const local = time - windowIndex * LIGHTNING_WINDOW_SECONDS - start;
  return Math.max(
    getPulseIntensity(local, LIGHTNING_LEADER),
    getPulseIntensity(local, LIGHTNING_RETURN),
  );
}
