import type { SkRSXform } from '@shopify/react-native-skia';
import { clamp, range, sumBy } from 'es-toolkit';

export const PARTICLE_SEED_STRIDE = 4;

const MIXING_INCREMENT = 0x6d2b79f5;
const CYCLE_HASH_STRIDE = 7919;
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
const STAR_TWINKLE_FREQUENCY = [0.8, 2.4] as const;
const MIN_VISIBLE_CLOUDS = 0.05;
const CLOUDS_PER_LAYER = 4;
/** 돌풍은 0.65배에서 1배 사이로 약 3.5초마다 몰아친다. */
const GUST_BASE = 0.65;
const GUST_SWELL = 0.35;
const GUST_FREQUENCY = 0.9;
const SHOOTING_STAR_WINDOW_SECONDS = 7;
const SHOOTING_STAR_DURATION_SECONDS = 0.9;

const MAX_STARS = 110;
/** 해와 달은 헤더 버튼 줄 바로 아래, 지명 오른쪽(화면 폭 90%, 높이 11.8%)에 둔다. */
const CELESTIAL_POSITION = { x: 0.9, y: 0.118 } as const;
/** 달(가장 큰 원반)의 지름이 기준 폭에서 차지하는 비율 */
const MOON_DISC_WIDTH_RATIO = 0.058;
/** 달 지름의 이 배수만큼 헤더 아래로 띄워 헤더가 높은 기기에서도 헤더 버튼에 가리지 않게 한다 */
const MOON_HEADER_CLEARANCE_DISCS = 1.6;
const CELESTIAL_HEADER_CLEARANCE = MOON_DISC_WIDTH_RATIO * MOON_HEADER_CLEARANCE_DISCS;
export const NO_LIGHTNING_WINDOW = -1;
const NO_SHOOTING_STAR = -1;

/** 기준 화면(390×844)에서 밀도 1일 때 개수. 넓은 화면은 넓이만큼 늘려 밀도를 유지하되 기기 등급별 상한을 넘지 않는다. */
const PARTICLE_BUDGETS = {
  rain: { full: 160, standardCap: 240, lowEndCap: 110 },
  drizzle: { full: 240, standardCap: 320, lowEndCap: 140 },
  pellet: { full: 60, standardCap: 90, lowEndCap: 40 },
  snow: { full: 190, standardCap: 280, lowEndCap: 120 },
  hail: { full: 60, standardCap: 90, lowEndCap: 40 },
  dust: { full: 110, standardCap: 200, lowEndCap: 60 },
  ember: { full: 48, standardCap: 90, lowEndCap: 28 },
  spindrift: { full: 140, standardCap: 240, lowEndCap: 80 },
  iceCrystal: { full: 46, standardCap: 80, lowEndCap: 28 },
  leaf: { full: 26, standardCap: 46, lowEndCap: 16 },
  glassDrop: { full: 22, standardCap: 40, lowEndCap: 14 },
} as const;

export type ParticleBudgetKind = keyof typeof PARTICLE_BUDGETS;

/** 강수와 무관하게 대기 효과마다 늘 깔리는 입자 */
export type AmbientBudgetKind = Exclude<
  ParticleBudgetKind,
  'rain' | 'drizzle' | 'pellet' | 'snow' | 'hail'
>;

/** 해·구름·띠 같은 큰 요소는 이 폭까지만 화면에 맞춰 키워 태블릿·가로 화면에서 과하게 커지지 않게 한다. */
const SCENE_MAX_REFERENCE_WIDTH = 600;

function mixToUnit(state: number): number {
  'worklet';
  let mixed = state;
  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
}

export function hashToUnit(index: number): number {
  'worklet';
  return mixToUnit(Math.imul(index + 1, MIXING_INCREMENT));
}

/** 같은 입자가 다시 나타날 때마다(주기마다) 다른 자리를 고르도록 입자·주기·항목으로 섞는다. */
export function hashCycle(index: number, cycle: number, salt: number): number {
  'worklet';
  return hashToUnit((index * CYCLE_HASH_STRIDE + cycle) * PARTICLE_SEED_STRIDE + salt);
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
  return range(count * PARTICLE_SEED_STRIDE).map(() => random());
}

function getAreaRatio(screen: { width: number; height: number }): number {
  return (screen.width * screen.height) / REFERENCE_SCREEN_AREA;
}

function hasArea(screen: { width: number; height: number }): boolean {
  return screen.width > 0 && screen.height > 0;
}

export function getParticleCount(
  kind: ParticleBudgetKind,
  {
    density,
    screen,
    isLowEndDevice,
  }: { density: number; screen: { width: number; height: number }; isLowEndDevice: boolean },
): number {
  if (!(density > 0) || !hasArea(screen)) {
    return 0;
  }
  const budget = PARTICLE_BUDGETS[kind];
  const cap = isLowEndDevice ? budget.lowEndCap : budget.standardCap;
  return Math.min(cap, Math.round(budget.full * clamp(density, 0, 1) * getAreaRatio(screen)));
}

export function getAmbientCount(
  kind: AmbientBudgetKind,
  {
    screen,
    isLowEndDevice,
  }: { screen: { width: number; height: number }; isLowEndDevice: boolean },
): number {
  return getParticleCount(kind, { density: 1, screen, isLowEndDevice });
}

export function getSceneReferenceWidth(width: number): number {
  return Math.min(width, SCENE_MAX_REFERENCE_WIDTH);
}

/** 운량이 많을수록 깊이 층마다 구름 덩이가 는다. 거의 맑으면 그리지 않는다. */
export function getCloudCountPerLayer(amount: number): number {
  if (!(amount >= MIN_VISIBLE_CLOUDS)) {
    return 0;
  }
  return Math.max(1, Math.round(clamp(amount, 0, 1) * CLOUDS_PER_LAYER));
}

export type Star = {
  x: number;
  y: number;
  radius: number;
  frequency: number;
  phase: number;
  isBright: boolean;
};

/** 별은 지평선(아래)으로 갈수록 드물고, 일부만 크게 빛나며 저마다 다른 박자로 반짝인다. */
export function createStarField(width: number, height: number, seed: number): Star[] {
  if (!(width > 0) || !(height > 0)) {
    return [];
  }
  const random = createSeededRandom(seed);
  const count = Math.min(MAX_STARS, Math.round((width * height) / STAR_SCREEN_AREA_PER_STAR));
  const [minFrequency, maxFrequency] = STAR_TWINKLE_FREQUENCY;
  return range(count).map(() => {
    const x = random() * width;
    const y = random() ** STAR_HORIZON_FALLOFF * height * STAR_FIELD_HEIGHT_RATIO;
    const isBright = random() < BRIGHT_STAR_RATIO;
    const radius = isBright ? 1.1 + random() * 0.4 : 0.45 + random() ** 2 * 0.55;
    const frequency = minFrequency + random() * (maxFrequency - minFrequency);
    return { x, y, radius, frequency, phase: random() * Math.PI * 2, isBright };
  });
}

/** 지명·기온 단(넓은 화면은 왼쪽 단)의 오른쪽, contentTop보다 원반 하나만큼 아래에 둔다 */
export function getCelestialCenter(
  screen: { width: number; height: number },
  { contentTop, heroLeft, heroWidth }: { contentTop: number; heroLeft: number; heroWidth: number },
): { x: number; y: number } {
  return {
    x: heroLeft + Math.min(screen.width - heroLeft, heroWidth) * CELESTIAL_POSITION.x,
    y: Math.max(
      screen.height * CELESTIAL_POSITION.y,
      contentTop + getSceneReferenceWidth(screen.width) * CELESTIAL_HEADER_CLEARANCE,
    ),
  };
}

export function wrap(value: number, length: number): number {
  'worklet';
  return value - Math.floor(value / length) * length;
}

/** 프레임마다 입자 수만큼 도는 worklet이라 객체를 만들지 않으려고 위치 인자를 유지한다 */
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

/** 보이지 않아야 하는 입자는 크기 0으로 둔다. Atlas 길이는 그대로라 버퍼를 다시 만들지 않는다. */
export function hideSprite(transform: SkRSXform) {
  'worklet';
  transform.set(0, 0, 0, 0);
}

export function getGust(time: number): number {
  'worklet';
  const swell = Math.sin(time * GUST_FREQUENCY);
  return GUST_BASE + GUST_SWELL * swell * swell;
}

/** 돌풍 세기를 시간에 대해 적분한 값. 속도 × 이 값이 그 시각까지 바람에 실려 간 거리다. */
export function getGustTravel(time: number): number {
  'worklet';
  return (
    GUST_BASE * time +
    GUST_SWELL * (time / 2 - Math.sin(2 * GUST_FREQUENCY * time) / (4 * GUST_FREQUENCY))
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

/** 번개가 치는 구간의 번호. 같은 구간에는 같은 모양의 번개 줄기를 그린다. */
export function getLightningWindow(time: number): number {
  'worklet';
  if (getLightningIntensity(time) <= 0) {
    return NO_LIGHTNING_WINDOW;
  }
  return Math.floor(time / LIGHTNING_WINDOW_SECONDS);
}

/** 별똥별은 7초 구간마다 한 번, 구간 안의 임의 시각에 0.9초 동안 지나간다. 지나가지 않으면 `NO_SHOOTING_STAR`다. */
export function getShootingStarProgress(time: number): number {
  'worklet';
  const windowIndex = Math.floor(time / SHOOTING_STAR_WINDOW_SECONDS);
  const usable = SHOOTING_STAR_WINDOW_SECONDS - SHOOTING_STAR_DURATION_SECONDS;
  const start = hashToUnit(windowIndex * 3) * usable;
  const progress =
    (time - windowIndex * SHOOTING_STAR_WINDOW_SECONDS - start) / SHOOTING_STAR_DURATION_SECONDS;
  return 0 <= progress && progress < 1 ? progress : NO_SHOOTING_STAR;
}

export function getShootingStarWindow(time: number): number {
  'worklet';
  return Math.floor(time / SHOOTING_STAR_WINDOW_SECONDS);
}

export type Bounce = { velocity: number; gravity: number };

export type BouncePhase =
  | { phase: 'falling'; elapsed: number }
  | { phase: 'bouncing'; bounce: number; elapsed: number }
  | { phase: 'resting' };

/** 위치를 매 프레임 누적하지 않고 시각만으로 계산해 멈췄다 다시 움직여도 어긋나지 않는다 */
export function getBouncePhase(
  elapsed: number,
  fallDuration: number,
  bounces: readonly Bounce[],
): BouncePhase {
  'worklet';
  if (elapsed < fallDuration) {
    return { phase: 'falling', elapsed };
  }
  let remaining = elapsed - fallDuration;
  for (let bounce = 0; bounce < bounces.length; bounce += 1) {
    const current = bounces[bounce];
    if (current == null) {
      break;
    }
    const airtime = (2 * current.velocity) / current.gravity;
    if (remaining < airtime) {
      return { phase: 'bouncing', bounce, elapsed: remaining };
    }
    remaining -= airtime;
  }
  return { phase: 'resting' };
}

export function getBounceHeight(bounce: Bounce, elapsed: number): number {
  'worklet';
  return bounce.velocity * elapsed - 0.5 * bounce.gravity * elapsed * elapsed;
}

export function getBouncesDuration(bounces: readonly Bounce[]): number {
  return sumBy(bounces, (bounce) => (2 * bounce.velocity) / bounce.gravity);
}
