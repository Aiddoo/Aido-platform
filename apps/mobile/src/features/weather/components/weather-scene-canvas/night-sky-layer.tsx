import {
  Atlas,
  BlurMask,
  Circle,
  Group,
  LinearGradient,
  Image,
  Path,
  RadialGradient,
  Rect,
  Skia,
  useRSXformBuffer,
  vec,
} from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';

import {
  createStarField,
  getShootingStarProgress,
  getSceneReferenceWidth,
  getShootingStarWindow,
  hashToUnit,
  placeSprite,
} from '../../utils/weather-scene-particles.view-model';
import { getMoonIllumination } from '../../utils/weather-scene.view-model';
import {
  PARTICLE_SAMPLING,
  PARTICLE_SPRITES,
  useMoonTexture,
  useParticleTexture,
} from './weather-scene-textures';

const STAR_SEED = 0x57a2;
const STAR_ALPHA = 0.75;
const STAR_SPRITE_RADIUS_RATIO = 4;
const TWINKLE = { min: 0.25, swing: 0.75 } as const;
const HALO_RADIUS_RATIO = 3.2;
const HALO_COLOR = 'rgba(220,230,255,0.07)';
const MOON = {
  radius: 0.058,
  tilt: -0.4,
  glowRadius: 9,
  glowBase: 0.16,
  glowLit: 0.22,
  glowFalloff: 0.36,
  breath: { amount: 0.03, periodSeconds: 10 },
  cloudDimming: 0.45,
  occlusionDimming: 0.55,
  /** 22° 달무리: 달 반지름의 5.2배 고리 */
  ring: { minClouds: 0.25, alpha: 0.18, radius: 5.2, width: 0.35, blur: 4 },
} as const;
/** 다크 모드에서는 달빛 무리를 조금 낮춘다. */
const THEME_MOON_GLOW = { light: 1, dark: 0.85 } as const;
/** 별똥별은 화면 폭 10~60%, 높이 4~25%에서 출발해 오른쪽 아래로 0.9초 동안 220×90pt를 지나간다. */
const SHOOTING_STAR = {
  startX: [0.1, 0.6],
  startY: [0.04, 0.25],
  travel: { x: 220, y: 90 },
  tail: 90,
  stroke: 1.4,
} as const;
const SHOOTING_STAR_ANGLE = Math.atan2(SHOOTING_STAR.travel.y, SHOOTING_STAR.travel.x);

type NightSkyLayerProps = {
  hasMoon: boolean;
  celestialCenter: { x: number; y: number };
  moonPhase: number;
  isSouthernHemisphere: boolean;
  isDark: boolean;
  occlusion: SharedValue<number>;
  hasStars: boolean;
  hasShootingStars: boolean;
  clouds: number;
  width: number;
  height: number;
  time: SharedValue<number>;
};

/** 박자가 제각각인 별, 위상대로 차오른 달과 달무리, 가끔 지나가는 별똥별 */
export function NightSkyLayer({
  hasMoon,
  celestialCenter,
  moonPhase,
  isSouthernHemisphere,
  isDark,
  occlusion,
  hasStars,
  hasShootingStars,
  clouds,
  width,
  height,
  time,
}: NightSkyLayerProps) {
  return (
    <Group>
      {hasStars && (
        <NightSkyLayer.Stars clouds={clouds} width={width} height={height} time={time} />
      )}
      {hasMoon && (
        <NightSkyLayer.Moon
          center={celestialCenter}
          phase={moonPhase}
          isSouthernHemisphere={isSouthernHemisphere}
          clouds={clouds}
          isDark={isDark}
          occlusion={occlusion}
          width={width}
          time={time}
        />
      )}
      {hasShootingStars && <NightSkyLayer.ShootingStar width={width} height={height} time={time} />}
    </Group>
  );
}

type SkyAreaProps = { width: number; height: number; time: SharedValue<number> };

NightSkyLayer.Stars = function Stars({
  clouds,
  width,
  height,
  time,
}: SkyAreaProps & { clouds: number }) {
  const texture = useParticleTexture();
  const field = useMemo(() => createStarField(width, height, STAR_SEED), [width, height]);
  const halos = useMemo(() => {
    const builder = Skia.PathBuilder.Make();
    for (const star of field) {
      if (star.isBright) {
        builder.addCircle(star.x, star.y, star.radius * HALO_RADIUS_RATIO);
      }
    }
    const path = builder.detach();
    builder.dispose();
    return path;
  }, [field]);
  // prop 경로는 Canvas가 커밋 때 복사해 기록하므로 정리 함수에서 바로 놓는다(shared value 경로와 다르다)
  useEffect(() => () => halos.dispose(), [halos]);

  const { dot } = PARTICLE_SPRITES;
  const sprites = field.map(() => Skia.XYWHRect(dot.x, dot.y, dot.width, dot.height));
  const color = Skia.Color(`rgba(255,255,255,${STAR_ALPHA})`);
  const colors = field.map(() => color);
  const anchor = { x: dot.width / 2, y: dot.height / 2 };

  const transforms = useRSXformBuffer(field.length, (transform, index) => {
    'worklet';
    const star = field[index];
    if (star == null) {
      return;
    }
    const wave = 0.5 + 0.5 * Math.sin(time.get() * star.frequency + star.phase);
    const twinkle = TWINKLE.min + TWINKLE.swing * wave;
    const scale = (star.radius * STAR_SPRITE_RADIUS_RATIO * twinkle) / dot.width;
    placeSprite(transform, scale, 0, anchor, star.x, star.y);
  });

  return (
    <Group opacity={1 - clouds}>
      <Path path={halos} color={HALO_COLOR} />
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
};

type MoonProps = Omit<SkyAreaProps, 'height'> & {
  center: { x: number; y: number };
  phase: number;
  isSouthernHemisphere: boolean;
  clouds: number;
  isDark: boolean;
  occlusion: SharedValue<number>;
};

/** 10초 주기로 숨 쉬는 무리를 두르고, 구름이 끼면 흐려지며 25%를 넘으면 22° 달무리가 비친다 */
NightSkyLayer.Moon = function Moon({
  center,
  phase,
  isSouthernHemisphere,
  clouds,
  isDark,
  occlusion,
  width,
  time,
}: MoonProps) {
  const texture = useMoonTexture(phase);
  const radius = getSceneReferenceWidth(width) * MOON.radius;
  const lit = getMoonIllumination(phase);
  const glowStrength = THEME_MOON_GLOW[isDark ? 'dark' : 'light'];
  const visibility = 1 - clouds * MOON.cloudDimming;
  const opacity = useDerivedValue(() => visibility * (1 - occlusion.get() * MOON.occlusionDimming));
  const glowTransform = useDerivedValue(() => [
    {
      scale:
        1 + MOON.breath.amount * Math.sin((time.get() * Math.PI * 2) / MOON.breath.periodSeconds),
    },
  ]);
  const glowRadius = radius * MOON.glowRadius;
  const ringAlpha =
    Math.max(0, clouds - MOON.ring.minClouds) * MOON.ring.alpha * lit * glowStrength;
  const tilt = MOON.tilt + (isSouthernHemisphere ? Math.PI : 0);

  return (
    <Group opacity={opacity}>
      <Group blendMode="screen" transform={glowTransform} origin={center}>
        <Circle c={center} r={glowRadius}>
          <RadialGradient
            c={center}
            r={glowRadius}
            colors={[
              `rgba(205,218,245,${(MOON.glowBase + MOON.glowLit * lit) * glowStrength})`,
              `rgba(185,200,235,${(MOON.glowBase + MOON.glowLit * lit) * MOON.glowFalloff * glowStrength})`,
              'rgba(170,190,230,0)',
            ]}
            positions={[0, 0.35, 1]}
          />
        </Circle>
        {ringAlpha > 0 && (
          <Circle
            c={center}
            r={radius * MOON.ring.radius}
            style="stroke"
            strokeWidth={radius * MOON.ring.width}
            color={`rgba(210,220,245,${ringAlpha})`}
          >
            <BlurMask blur={MOON.ring.blur} style="normal" />
          </Circle>
        )}
      </Group>
      <Group transform={[{ rotate: tilt }]} origin={center}>
        <Image
          image={texture}
          x={center.x - radius}
          y={center.y - radius}
          width={radius * 2}
          height={radius * 2}
          fit="fill"
        />
      </Group>
    </Group>
  );
};

NightSkyLayer.ShootingStar = function ShootingStar({ width, height, time }: SkyAreaProps) {
  const progress = useDerivedValue(() => getShootingStarProgress(time.get()));
  const transform = useDerivedValue(() => {
    const window = getShootingStarWindow(time.get());
    const [minX, maxX] = SHOOTING_STAR.startX;
    const [minY, maxY] = SHOOTING_STAR.startY;
    const k = Math.max(0, progress.get());
    const x = width * (minX + hashToUnit(window * 3 + 1) * (maxX - minX));
    const y = height * (minY + hashToUnit(window * 3 + 2) * (maxY - minY));
    return [
      { translateX: x + k * SHOOTING_STAR.travel.x },
      { translateY: y + k * SHOOTING_STAR.travel.y },
      { rotate: SHOOTING_STAR_ANGLE },
    ];
  });
  const tail = useDerivedValue(
    () => SHOOTING_STAR.tail * Math.sin(Math.max(0, progress.get()) * Math.PI),
  );
  const tailX = useDerivedValue(() => -tail.get());
  const tailStart = useDerivedValue(() => vec(-tail.get(), 0));
  const opacity = useDerivedValue(() => (progress.get() < 0 ? 0 : 1));

  return (
    <Group transform={transform} opacity={opacity}>
      <Rect x={tailX} y={-SHOOTING_STAR.stroke / 2} width={tail} height={SHOOTING_STAR.stroke}>
        <LinearGradient
          start={tailStart}
          end={vec(0, 0)}
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.9)']}
        />
      </Rect>
    </Group>
  );
};
