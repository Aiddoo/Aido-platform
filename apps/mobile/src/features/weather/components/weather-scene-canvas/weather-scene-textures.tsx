import {
  Blur,
  Circle,
  FilterMode,
  Group,
  LinearGradient,
  MipmapMode,
  Oval,
  Path,
  Paint,
  RadialGradient,
  Rect,
  RoundedRect,
  Shader,
  Skia,
  type SkImage,
  type SkPath,
  type SkPathBuilder,
  type SkSize,
  useTexture,
  vec,
} from '@shopify/react-native-skia';
import { range } from 'es-toolkit';
import { type DependencyList, type ReactElement, useEffect, useMemo } from 'react';
import { type SharedValue, useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';

import { createSeededRandom } from '../../utils/weather-scene-particles.view-model';

/** 작은 입자 텍스처는 3배 크기로 구워 두고 1/3로 줄여 그린다. */
export const PARTICLE_TEXTURE_SCALE = 3;

export const PARTICLE_SPRITES = {
  streak: { x: 0, y: 0, width: 3, height: 72 },
  dot: { x: 8, y: 0, width: 30, height: 30 },
  soft: { x: 8, y: 36, width: 36, height: 36 },
  ice: { x: 46, y: 0, width: 24, height: 24 },
  warm: { x: 46, y: 36, width: 24, height: 24 },
  crystal: { x: 74, y: 0, width: 32, height: 32 },
  leaf: { x: 74, y: 40, width: 30, height: 30 },
} as const;

export type ParticleSprite = (typeof PARTICLE_SPRITES)[keyof typeof PARTICLE_SPRITES];

/** 축소해 그릴 때 1px 빗줄기가 계단지지 않도록 선형 보간한다. */
export const PARTICLE_SAMPLING = { filter: FilterMode.Linear, mipmap: MipmapMode.None };

const PARTICLE_TEXTURE_SIZE = { width: 110, height: 76 };
const CRYSTAL = {
  arms: 6,
  stroke: 2.4,
  arm: 0.44,
  fork: 0.24,
  branch: 0.33,
  spread: 0.09,
} as const;
const LEAF = {
  color: '#d6c39b',
  veinColor: 'rgba(120,96,60,0.6)',
  veinWidth: 1.6,
  tilt: 0.3,
  halfLength: 0.42,
  halfWidth: 0.2,
  veinHalfLength: 0.36,
} as const;
const ICE_HIGHLIGHT = { x: 0.38, y: 0.36 } as const;

export const CLOUD_SPRITE = { width: 400, height: 220 } as const;
export const CLOUD_VARIANTS = 3;
/** 구름 덩이 하나가 화면 폭에 대해 차지하는 비율(크기 1일 때) */
export const CLOUD_SPAN_RATIO = 0.58;

const CLOUD_PUFFS_PER_CLUSTER = 9;
const CLOUD_PUFF_RADIUS = [52, 86] as const;
const CLOUD_PUFF_SPREAD = { x: 96, y: 22 } as const;
const CLOUD_SEED = 0xc10d;

export const FOG_BAND_SPRITE = { width: 512, height: 128 } as const;

export const WIND_STREAK_SPRITE = { width: 1200, height: 96 } as const;

const WIND_STREAK = { amplitude: 30, halfWaves: 1.8, stroke: 3.6, segments: 40 } as const;

export const HEAT_WAVE_SPRITE = { width: 1200, height: 60 } as const;

const HEAT_WAVE = { amplitude: 15, period: 471, stroke: 6, segments: 120 } as const;

export const GLASS_DROP_SPRITE = { width: 48, height: 48, radius: 16 } as const;

const GLASS_DROP = {
  rimStartDegrees: 162,
  rimSweepDegrees: 180,
  rimWidth: 2.1,
  highlightOffset: 0.35,
  highlightRadius: 0.22,
} as const;

/** 한 번만 구운 텍스처를 캔버스가 사라질 때 UI 스레드에서 해제한다. */
export type SceneTexture = SharedValue<SkImage | null>;

function useOwnedTexture(
  element: ReactElement,
  size: SkSize,
  deps: DependencyList = [],
): SceneTexture {
  const texture = useTexture(element, size, deps);
  useAnimatedReaction(
    () => texture.get(),
    (current, previous) => {
      if (previous != null && previous !== current) {
        previous.dispose();
      }
    },
  );
  useEffect(
    () => () => {
      scheduleOnUI(() => {
        'worklet';
        const image = texture.get();
        texture.set(null);
        image?.dispose();
      });
    },
    [texture],
  );
  return texture;
}

function getCenter(sprite: ParticleSprite) {
  return vec(sprite.x + sprite.width / 2, sprite.y + sprite.height / 2);
}

/** 한 번만 쓰는 빌더는 경로를 넘긴 뒤 바로 놓는다 */
function detachOnce(builder: SkPathBuilder): SkPath {
  const path = builder.detach();
  builder.dispose();
  return path;
}

function buildCrystalPath(): SkPath {
  const { crystal } = PARTICLE_SPRITES;
  const center = getCenter(crystal);
  const builder = Skia.PathBuilder.Make();
  for (const index of range(CRYSTAL.arms)) {
    const angle = (index / CRYSTAL.arms) * Math.PI * 2;
    const point = (distance: number, offset: number) =>
      vec(
        center.x + Math.sin(angle) * distance + Math.cos(angle) * offset,
        center.y - Math.cos(angle) * distance + Math.sin(angle) * offset,
      );
    const tip = point(crystal.width * CRYSTAL.arm, 0);
    const fork = point(crystal.width * CRYSTAL.fork, 0);
    const left = point(crystal.width * CRYSTAL.branch, -crystal.width * CRYSTAL.spread);
    const right = point(crystal.width * CRYSTAL.branch, crystal.width * CRYSTAL.spread);
    builder
      .moveTo(center.x, center.y)
      .lineTo(tip.x, tip.y)
      .moveTo(fork.x, fork.y)
      .lineTo(left.x, left.y)
      .moveTo(fork.x, fork.y)
      .lineTo(right.x, right.y);
  }
  return detachOnce(builder);
}

function buildLeafVeinPath(): SkPath {
  const center = getCenter(PARTICLE_SPRITES.leaf);
  const halfLength = PARTICLE_SPRITES.leaf.width * LEAF.veinHalfLength;
  return detachOnce(
    Skia.PathBuilder.Make()
      .moveTo(center.x - halfLength, center.y)
      .lineTo(center.x + halfLength, center.y),
  );
}

// 입력이 상수인 텍스처 경로는 앱 수명 동안 한 번만 만든다. 장면을 열 때마다 네이티브 경로를 새로 만들지 않는다
const CRYSTAL_PATH = buildCrystalPath();
const LEAF_VEIN_PATH = buildLeafVeinPath();

export function useParticleTexture() {
  const { streak, dot, soft, ice, warm, leaf } = PARTICLE_SPRITES;
  const dotCenter = getCenter(dot);
  const softCenter = getCenter(soft);
  const iceCenter = getCenter(ice);
  const warmCenter = getCenter(warm);
  const leafCenter = getCenter(leaf);
  return useOwnedTexture(
    <Group>
      <RoundedRect
        x={streak.x}
        y={streak.y}
        width={streak.width}
        height={streak.height}
        r={streak.width / 2}
      >
        <LinearGradient
          start={vec(0, streak.y)}
          end={vec(0, streak.y + streak.height)}
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,1)']}
          positions={[0, 0.55, 1]}
        />
      </RoundedRect>
      <Circle c={dotCenter} r={dot.width / 2}>
        <RadialGradient
          c={dotCenter}
          r={dot.width / 2}
          colors={['rgba(255,255,255,1)', 'rgba(255,255,255,0.75)', 'rgba(255,255,255,0)']}
          positions={[0, 0.35, 1]}
        />
      </Circle>
      <Circle c={softCenter} r={soft.width / 2}>
        <RadialGradient
          c={softCenter}
          r={soft.width / 2}
          colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.4)', 'rgba(255,255,255,0)']}
          positions={[0, 0.35, 1]}
        />
      </Circle>
      <Circle c={iceCenter} r={ice.width / 2}>
        <RadialGradient
          c={vec(ice.x + ice.width * ICE_HIGHLIGHT.x, ice.y + ice.height * ICE_HIGHLIGHT.y)}
          r={ice.width / 2}
          colors={[
            'rgba(255,255,255,1)',
            'rgba(226,238,250,0.95)',
            'rgba(160,190,225,0.6)',
            'rgba(160,190,225,0)',
          ]}
          positions={[0, 0.5, 0.92, 1]}
        />
      </Circle>
      <Circle c={warmCenter} r={warm.width / 2}>
        <RadialGradient
          c={warmCenter}
          r={warm.width / 2}
          colors={['rgba(255,230,180,1)', 'rgba(255,200,140,0)']}
        />
      </Circle>
      <Path
        path={CRYSTAL_PATH}
        style="stroke"
        strokeWidth={CRYSTAL.stroke}
        strokeCap="round"
        color="rgba(232,246,255,1)"
      />
      <Group transform={[{ rotate: LEAF.tilt }]} origin={leafCenter}>
        <Oval
          x={leafCenter.x - leaf.width * LEAF.halfLength}
          y={leafCenter.y - leaf.height * LEAF.halfWidth}
          width={leaf.width * LEAF.halfLength * 2}
          height={leaf.height * LEAF.halfWidth * 2}
          color={LEAF.color}
        />
        <Path
          path={LEAF_VEIN_PATH}
          style="stroke"
          strokeWidth={LEAF.veinWidth}
          color={LEAF.veinColor}
        />
      </Group>
    </Group>,
    PARTICLE_TEXTURE_SIZE,
  );
}

type Puff = { cx: number; cy: number; r: number };

function createCloudClusters(): Puff[][] {
  const random = createSeededRandom(CLOUD_SEED);
  const [minRadius, maxRadius] = CLOUD_PUFF_RADIUS;
  return range(CLOUD_VARIANTS).map(() =>
    range(CLOUD_PUFFS_PER_CLUSTER).map(() => ({
      cx: CLOUD_SPRITE.width / 2 + (random() * 2 - 1) * CLOUD_PUFF_SPREAD.x,
      cy: CLOUD_SPRITE.height / 2 + (random() * 2 - 1) * CLOUD_PUFF_SPREAD.y,
      r: minRadius + random() * (maxRadius - minRadius),
    })),
  );
}

export function createCloudSpriteRect(variant: number) {
  return Skia.XYWHRect(
    0,
    (variant % CLOUD_VARIANTS) * CLOUD_SPRITE.height,
    CLOUD_SPRITE.width,
    CLOUD_SPRITE.height,
  );
}

/** 뭉게구름은 부드러운 구름 알갱이를 겹친 덩이 세 종류를 한 장에 세로로 구워 쓴다. */
export function useCloudTexture() {
  const clusters = useMemo(() => createCloudClusters(), []);
  return useOwnedTexture(
    <Group>
      {clusters.map((puffs, variant) => (
        <CloudCluster key={variant} puffs={puffs} offsetY={variant * CLOUD_SPRITE.height} />
      ))}
    </Group>,
    { width: CLOUD_SPRITE.width, height: CLOUD_SPRITE.height * CLOUD_VARIANTS },
  );
}

function CloudCluster({ puffs, offsetY }: { puffs: Puff[]; offsetY: number }) {
  return (
    <Group transform={[{ translateY: offsetY }]}>
      {puffs.map((puff) => (
        <Circle key={`${puff.cx}:${puff.cy}`} cx={puff.cx} cy={puff.cy} r={puff.r}>
          <RadialGradient
            c={vec(puff.cx, puff.cy)}
            r={puff.r}
            colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
            positions={[0, 0.55, 1]}
          />
        </Circle>
      ))}
    </Group>
  );
}

export function useFogBandTexture() {
  const { width, height } = FOG_BAND_SPRITE;
  const center = vec(width / 2, height / 2);
  return useOwnedTexture(
    <Group transform={[{ scaleY: height / width }]} origin={center}>
      <Circle c={center} r={width / 2}>
        <RadialGradient
          c={center}
          r={width / 2}
          colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
          positions={[0, 0.6, 1]}
        />
      </Circle>
    </Group>,
    FOG_BAND_SPRITE,
  );
}

function buildWavePath(
  points: number,
  pointAt: (progress: number) => { x: number; y: number },
): SkPath {
  const builder = Skia.PathBuilder.Make();
  for (const index of range(points + 1)) {
    const { x, y } = pointAt(index / points);
    if (index === 0) {
      builder.moveTo(x, y);
    } else {
      builder.lineTo(x, y);
    }
  }
  return detachOnce(builder);
}

/** 바람 줄기는 가운데가 가장 크게 물결치고 양 끝이 사라지는 선이다. */
const WIND_STREAK_PATH = buildWavePath(WIND_STREAK.segments, (progress) => ({
  x: progress * WIND_STREAK_SPRITE.width,
  y:
    WIND_STREAK_SPRITE.height / 2 +
    Math.sin(progress * Math.PI * WIND_STREAK.halfWaves) *
      WIND_STREAK.amplitude *
      Math.sin(progress * Math.PI),
}));

export function useWindStreakTexture() {
  const { width } = WIND_STREAK_SPRITE;
  return useOwnedTexture(
    <Path path={WIND_STREAK_PATH} style="stroke" strokeWidth={WIND_STREAK.stroke} strokeCap="round">
      <LinearGradient
        start={vec(0, 0)}
        end={vec(width, 0)}
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,1)', 'rgba(255,255,255,0)']}
        positions={[0, 0.55, 1]}
      />
    </Path>,
    WIND_STREAK_SPRITE,
  );
}

const HEAT_WAVE_PATH = buildWavePath(HEAT_WAVE.segments, (progress) => ({
  x: progress * HEAT_WAVE_SPRITE.width,
  y:
    HEAT_WAVE_SPRITE.height / 2 +
    Math.sin(((progress * HEAT_WAVE_SPRITE.width) / HEAT_WAVE.period) * Math.PI * 2) *
      HEAT_WAVE.amplitude,
}));

export function useHeatWaveTexture() {
  return useOwnedTexture(
    <Path
      path={HEAT_WAVE_PATH}
      style="stroke"
      strokeWidth={HEAT_WAVE.stroke}
      strokeCap="round"
      color="white"
    />,
    HEAT_WAVE_SPRITE,
  );
}

const GLASS_DROP_CENTER = vec(GLASS_DROP_SPRITE.width / 2, GLASS_DROP_SPRITE.height / 2);

function buildGlassDropRimPath(): SkPath {
  const builder = Skia.PathBuilder.Make();
  builder.addArc(
    Skia.XYWHRect(
      GLASS_DROP_CENTER.x - GLASS_DROP_SPRITE.radius,
      GLASS_DROP_CENTER.y - GLASS_DROP_SPRITE.radius,
      GLASS_DROP_SPRITE.radius * 2,
      GLASS_DROP_SPRITE.radius * 2,
    ),
    GLASS_DROP.rimStartDegrees,
    GLASS_DROP.rimSweepDegrees,
  );
  return detachOnce(builder);
}

const GLASS_DROP_RIM_PATH = buildGlassDropRimPath();

/** 유리에 맺힌 물방울: 어두운 몸통, 위쪽 테두리 반사, 왼쪽 위 하이라이트 */
export function useGlassDropTexture() {
  const center = GLASS_DROP_CENTER;
  return useOwnedTexture(
    <Group>
      <Circle c={center} r={GLASS_DROP_SPRITE.radius} color="rgba(20,30,45,0.18)" />
      <Path
        path={GLASS_DROP_RIM_PATH}
        style="stroke"
        strokeWidth={GLASS_DROP.rimWidth}
        color="rgba(235,242,250,0.45)"
      />
      <Circle
        cx={center.x - GLASS_DROP_SPRITE.radius * GLASS_DROP.highlightOffset}
        cy={center.y - GLASS_DROP_SPRITE.radius * GLASS_DROP.highlightOffset}
        r={GLASS_DROP_SPRITE.radius * GLASS_DROP.highlightRadius}
        color="rgba(255,255,255,0.75)"
      />
    </Group>,
    GLASS_DROP_SPRITE,
  );
}

const SUN_RAYS_SIZE = 1024;

const SUN_RAYS = {
  count: 64,
  seed: 23,
  length: [0.18, 0.5],
  halfWidth: [2, 8],
  alpha: [0.04, 0.12],
  blur: 6,
  rgb: '255,250,235',
} as const;

type SunRay = { angle: number; length: number; alpha: number; path: SkPath };

function buildSunRayPath(length: number, halfWidth: number): SkPath {
  return detachOnce(
    Skia.PathBuilder.Make().moveTo(0, -halfWidth).lineTo(length, 0).lineTo(0, halfWidth).close(),
  );
}

function createSunRays(): SunRay[] {
  const random = createSeededRandom(SUN_RAYS.seed);
  const between = ([min, max]: readonly [number, number]) => min + random() * (max - min);
  return range(SUN_RAYS.count).map(() => {
    const angle = random() * Math.PI * 2;
    const length = SUN_RAYS_SIZE * between(SUN_RAYS.length);
    const halfWidth = between(SUN_RAYS.halfWidth);
    return {
      angle,
      length,
      alpha: between(SUN_RAYS.alpha),
      path: buildSunRayPath(length, halfWidth),
    };
  });
}

const SUN_RAY_SHAPES = createSunRays();

/** 가는 빛살 64개를 미리 흐리게 구워 두고, 그리는 동안에는 돌리기만 한다. */
export function useSunRaysTexture(): SceneTexture {
  const center = SUN_RAYS_SIZE / 2;
  return useOwnedTexture(
    <Group
      layer={
        <Paint>
          <Blur blur={SUN_RAYS.blur} />
        </Paint>
      }
    >
      {SUN_RAY_SHAPES.map((ray) => (
        <SunRayShape key={ray.angle} ray={ray} center={center} />
      ))}
    </Group>,
    { width: SUN_RAYS_SIZE, height: SUN_RAYS_SIZE },
  );
}

function SunRayShape({ ray, center }: { ray: SunRay; center: number }) {
  return (
    <Group transform={[{ translateX: center }, { translateY: center }, { rotate: ray.angle }]}>
      <Path path={ray.path}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(ray.length, 0)}
          colors={[`rgba(${SUN_RAYS.rgb},${ray.alpha})`, `rgba(${SUN_RAYS.rgb},0)`]}
        />
      </Path>
    </Group>
  );
}

const MOON_TEXTURE_SIZE = 384;

/** 달 표면(값 잡음 바다·크레이터·가장자리 어둡기·지구 반사광). 위상이 바뀔 때만 다시 굽는다 */
const MOON_SURFACE = Skia.RuntimeEffect.Make(`
uniform float size;
uniform float phase;
uniform float earthshine;
uniform float softness;
uniform float shadowOpacity;

float hash(float2 p) {
  return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453);
}

float noise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + float2(1.0, 0.0));
  float c = hash(i + float2(0.0, 1.0));
  float d = hash(i + float2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(float2 p, float seed) {
  float value = 0.0;
  float total = 0.0;
  float amplitude = 1.0;
  for (int octave = 0; octave < 4; octave++) {
    value += noise(p + seed) * amplitude;
    total += amplitude;
    p *= 2.0;
    amplitude *= 0.5;
  }
  return value / total;
}

half4 main(float2 position) {
  float2 uv = position / size;
  float2 disc = (uv - 0.5) * 2.0;
  float d = length(disc);
  if (d > 1.0) {
    return half4(0.0);
  }
  float tone = 232.0 - max(0.0, fbm(uv * 4.0, 17.0) - 0.48) * 260.0 + (fbm(uv * 16.0, 91.0) - 0.5) * 26.0;
  float2 grid = uv * 9.0;
  float2 cell = floor(grid);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      float2 id = cell + float2(float(x), float(y));
      float2 center = id + float2(hash(id + 3.1), hash(id + 7.7));
      float radius = 0.12 + pow(hash(id + 1.7), 2.5) * 0.6;
      float2 offset = grid - center;
      float crater = length(offset) / radius;
      if (hash(id + 5.3) < 0.86) {
        if (crater < 1.0) {
          tone -= 18.0 * (1.0 - crater);
        } else if (crater < 1.25) {
          tone += 16.0 * (1.0 - (crater - 1.0) / 0.25) * (offset.x < 0.0 ? 1.0 : 0.4);
        }
      }
    }
  }
  tone *= 0.62 + 0.38 * pow(max(0.0, 1.0 - d * d), 0.35);
  float k = cos(phase * 6.2831853);
  float edge = k * sqrt(max(0.0, 1.0 - disc.y * disc.y));
  float lit = phase < 0.5
    ? smoothstep(edge - softness, edge + softness, disc.x)
    : smoothstep(edge - softness, edge + softness, -disc.x);
  float light = mix(earthshine, 1.0, lit);
  float alpha = clamp((1.0 - d) * 60.0, 0.0, 1.0) * mix(shadowOpacity, 1.0, lit);
  return half4(half3(tone + 6.0, tone + 4.0, tone) / 255.0 * light * alpha, alpha);
}
`);

/** 명암 경계는 달 지름의 1.8%만큼 흐리게, 어두운 면에는 지구 반사광 9%를 남긴다. */
const MOON_TERMINATOR_SOFTNESS = 0.036;
const MOON_EARTHSHINE = 0.09;
/** 어두운 면은 반쯤 비쳐 밤하늘 색이 스며들게 한다. */
const MOON_SHADOW_OPACITY = 0.55;
export function useMoonTexture(phase: number) {
  return useOwnedTexture(
    MOON_SURFACE == null ? (
      <Group />
    ) : (
      <Rect x={0} y={0} width={MOON_TEXTURE_SIZE} height={MOON_TEXTURE_SIZE}>
        <Shader
          source={MOON_SURFACE}
          uniforms={{
            size: MOON_TEXTURE_SIZE,
            phase,
            earthshine: MOON_EARTHSHINE,
            softness: MOON_TERMINATOR_SOFTNESS,
            shadowOpacity: MOON_SHADOW_OPACITY,
          }}
        />
      </Rect>
    ),
    { width: MOON_TEXTURE_SIZE, height: MOON_TEXTURE_SIZE },
    [phase],
  );
}
