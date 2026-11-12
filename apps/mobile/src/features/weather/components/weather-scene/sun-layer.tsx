import { Circle, Group, Image, RadialGradient, vec } from '@shopify/react-native-skia';
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';
import { match } from 'ts-pattern';

import { getSceneReferenceWidth } from '../../utils/weather-scene-particles.view-model';
import type { WeatherSceneSun } from '../../utils/weather-scene.view-model';
import { useSunRaysTexture } from './weather-scene-textures';

/** 다크 모드에서는 빛무리를 조금 낮춘다. */
const THEME_GLOW = { light: 1, dark: 0.78 } as const;
/** 하늘 전체의 구름양과 해를 바로 가린 구름이 햇빛을 줄이는 비율 */
const CLOUD_DIMMING = 0.55;
const OCCLUSION_DIMMING = 0.7;
/** 8초 주기로 2.5% 숨 쉰다. */
const BREATH = { amount: 0.025, periodSeconds: 8 } as const;
/** 두 빛살 텍스처가 서로 반대로 천천히 돈다(초당 라디안). 큰 쪽은 화면 폭의 1.15배다. */
const RAYS = {
  outer: { scale: 1.15, turn: 0.015, alpha: 0.9 },
  inner: { scale: 0.92, turn: -0.012, alpha: 0.55 },
} as const;
/** 렌즈 반사는 해에서 화면 가운데(폭 45%, 높이 55%)를 향해 놓인다. */
const FLARE_TARGET = { x: 0.45, y: 0.55 } as const;
const FLARE_GHOSTS = [
  { offset: 0.38, radius: 0.028, rgb: '190,225,255', alpha: 0.12 },
  { offset: 0.55, radius: 0.012, rgb: '255,225,190', alpha: 0.16 },
  { offset: 0.78, radius: 0.045, rgb: '170,205,255', alpha: 0.07 },
  { offset: 1.05, radius: 0.02, rgb: '255,210,170', alpha: 0.09 },
] as const;

type SunStyle = {
  /** 하얀 원반·따뜻한 코로나·하늘 전체 빛의 반지름(화면 폭 비율) */
  core: number;
  corona: number;
  sky: number;
  warmth: string;
  hasRays: boolean;
  brightness: number;
};

function getSunStyle(sun: Exclude<WeatherSceneSun, 'hidden'>): SunStyle {
  return match(sun)
    .returnType<SunStyle>()
    .with('bright', () => ({
      core: 0.045,
      corona: 0.2,
      sky: 1.25,
      warmth: '255,236,205',
      hasRays: true,
      brightness: 1,
    }))
    .with('blazing', () => ({
      core: 0.055,
      corona: 0.28,
      sky: 1.5,
      warmth: '255,214,160',
      hasRays: true,
      brightness: 1.15,
    }))
    .with('diffuse', () => ({
      core: 0.05,
      corona: 0.18,
      sky: 1,
      warmth: '255,228,196',
      hasRays: false,
      brightness: 0.55,
    }))
    .exhaustive();
}

type SunLayerProps = {
  sun: Exclude<WeatherSceneSun, 'hidden'>;
  center: { x: number; y: number };
  hasLensFlare: boolean;
  clouds: number;
  isDark: boolean;
  /** 구름이 해를 바로 가린 정도(0~1) */
  occlusion: SharedValue<number>;
  width: number;
  height: number;
  time: SharedValue<number>;
};

/** 원반·코로나·하늘 빛·두 겹 빛살·렌즈 반사를 그리고, 구름양과 해를 지나는 구름만큼 어두워진다 */
export function SunLayer({
  sun,
  center,
  hasLensFlare,
  clouds,
  isDark,
  occlusion,
  width,
  height,
  time,
}: SunLayerProps) {
  const style = getSunStyle(sun);
  const size = getSceneReferenceWidth(width);
  const base =
    (1 - clouds * CLOUD_DIMMING) * style.brightness * THEME_GLOW[isDark ? 'dark' : 'light'];
  const strength = useDerivedValue(() => base * (1 - occlusion.get() * OCCLUSION_DIMMING));
  const breath = useDerivedValue(
    () => 1 + BREATH.amount * Math.sin((time.get() * Math.PI * 2) / BREATH.periodSeconds),
  );
  const glowTransform = useDerivedValue(() => [{ scale: breath.get() }]);
  const coreRadius = size * style.core;
  const coronaRadius = size * style.corona;
  const skyRadius = size * style.sky;

  return (
    <Group opacity={strength}>
      <Group blendMode="screen">
        <Group transform={glowTransform} origin={center}>
          <SunLayer.Glow
            center={center}
            radius={skyRadius}
            colors={[
              `rgba(${style.warmth},0.32)`,
              `rgba(${style.warmth},0.12)`,
              `rgba(${style.warmth},0.04)`,
              `rgba(${style.warmth},0)`,
            ]}
            positions={[0, 0.25, 0.6, 1]}
          />
        </Group>
        {style.hasRays && <SunLayer.Rays center={center} size={size} time={time} />}
        <Group transform={glowTransform} origin={center}>
          <SunLayer.Glow
            center={center}
            radius={coronaRadius}
            colors={[
              'rgba(255,252,240,0.9)',
              `rgba(${style.warmth},0.45)`,
              `rgba(${style.warmth},0)`,
            ]}
            positions={[0, 0.3, 1]}
          />
        </Group>
      </Group>
      <SunLayer.Glow
        center={center}
        radius={coreRadius}
        colors={['rgba(255,255,255,1)', 'rgba(255,253,246,1)', 'rgba(255,248,230,0)']}
        positions={[0, 0.7, 1]}
      />
      {hasLensFlare && <SunLayer.Flare center={center} size={size} width={width} height={height} />}
    </Group>
  );
}

SunLayer.Glow = function Glow({
  center,
  radius,
  colors,
  positions,
}: {
  center: { x: number; y: number };
  radius: number;
  colors: string[];
  positions?: number[];
}) {
  return (
    <Circle c={center} r={radius}>
      <RadialGradient c={center} r={radius} colors={colors} positions={positions} />
    </Circle>
  );
};

type SunRaysProps = {
  center: { x: number; y: number };
  size: number;
  time: SharedValue<number>;
};

SunLayer.Rays = function Rays({ center, size, time }: SunRaysProps) {
  const texture = useSunRaysTexture();
  return (
    <Group>
      <SunLayer.RayImage
        {...RAYS.outer}
        texture={texture}
        center={center}
        size={size}
        time={time}
      />
      <SunLayer.RayImage
        {...RAYS.inner}
        texture={texture}
        center={center}
        size={size}
        time={time}
      />
    </Group>
  );
};

type RayImageProps = SunRaysProps & {
  texture: ReturnType<typeof useSunRaysTexture>;
  scale: number;
  turn: number;
  alpha: number;
};

SunLayer.RayImage = function RayImage({
  texture,
  center,
  size,
  time,
  scale,
  turn,
  alpha,
}: RayImageProps) {
  const drawn = size * scale;
  const transform = useDerivedValue(() => [{ rotate: time.get() * turn }]);
  return (
    <Group transform={transform} origin={center} opacity={alpha}>
      <Image
        image={texture}
        x={center.x - drawn / 2}
        y={center.y - drawn / 2}
        width={drawn}
        height={drawn}
        fit="fill"
      />
    </Group>
  );
};

type SunFlareProps = {
  center: { x: number; y: number };
  size: number;
  width: number;
  height: number;
};

SunLayer.Flare = function Flare({ center, size, width, height }: SunFlareProps) {
  const target = { x: width * FLARE_TARGET.x, y: height * FLARE_TARGET.y };
  return (
    <Group blendMode="screen">
      {FLARE_GHOSTS.map((ghost) => (
        <SunLayer.Glow
          key={ghost.offset}
          center={vec(
            center.x + (target.x - center.x) * ghost.offset,
            center.y + (target.y - center.y) * ghost.offset,
          )}
          radius={size * ghost.radius}
          colors={[
            `rgba(${ghost.rgb},${ghost.alpha})`,
            `rgba(${ghost.rgb},${ghost.alpha * 0.4})`,
            `rgba(${ghost.rgb},0)`,
          ]}
          positions={[0, 0.7, 1]}
        />
      ))}
    </Group>
  );
};
