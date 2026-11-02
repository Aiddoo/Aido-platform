import type { SkRSXform } from '@shopify/react-native-skia';
import { clamp } from 'es-toolkit';

export const PARTICLE_SEED_STRIDE = 4;

const MIXING_INCREMENT = 0x6d2b79f5;
const REFERENCE_SCREEN_AREA = 390 * 844;
const LIGHTNING_WINDOW_SECONDS = 7;
const LIGHTNING_SKIP_RATIO = 0.35;
const LIGHTNING_EDGE_MARGIN_SECONDS = 1.5;
const LIGHTNING_LEADER = { offset: 0, duration: 0.18, strength: 1 } as const;
const LIGHTNING_RETURN = { offset: 0.3, duration: 0.25, strength: 0.6 } as const;

export const PARTICLE_BUDGETS = {
  rain: { full: 360, standardCap: 480, lowEndCap: 200 },
  snow: { full: 220, standardCap: 300, lowEndCap: 140 },
  hail: { full: 140, standardCap: 200, lowEndCap: 90 },
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
  return pulse.strength * (1 - progress) * (1 - progress);
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
