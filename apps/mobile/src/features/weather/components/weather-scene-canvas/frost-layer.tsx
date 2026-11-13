import {
  Atlas,
  Group,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Skia,
  type SkPath,
  type SkPathBuilder,
  useRSXformBuffer,
  vec,
} from '@shopify/react-native-skia';
import { range } from 'es-toolkit';
import { useEffect, useMemo } from 'react';
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';

import {
  createParticleSeeds,
  createSeededRandom,
  getAmbientCount,
  getGust,
  getGustTravel,
  PARTICLE_SEED_STRIDE,
  placeSprite,
  wrap,
} from '../../utils/weather-scene-particles.view-model';
import { GustStreaks } from './gust-layer';
import { PARTICLE_SAMPLING, PARTICLE_SPRITES, useParticleTexture } from './weather-scene-textures';

const SPINDRIFT_SEED = 0x5d1f;
const CRYSTAL_SEED = 0xc75a;
const FROST_SEED = 0xf057;
/** 눈가루는 화면 높이 62~99%에서 바닥을 따라 옆으로 날린다. */
const SPINDRIFT = {
  lanes: [0.62, 0.99],
  depth: [0.3, 1],
  speed: { base: 180, depth: 260 },
  radius: { base: 0.6, depth: 1.6 },
  alpha: { base: 0.25, depth: 0.55 },
  bob: { amplitude: 7, frequency: 4 },
  sizeRatio: 4,
} as const;
const DRIFT_GLOW = { top: 0.8, color: '225,240,255', alpha: 0.18, gust: 0.06 } as const;
const CRYSTAL = {
  size: [5, 13],
  fall: [2, 7],
  carry: 40,
  sway: { amplitude: 10, frequency: 0.6 },
  spin: 0.4,
  alpha: 0.55,
  glint: { frequency: 2, sharpness: 8, sizeRatio: 0.8 },
} as const;
const EDGE_MARGIN = 12;
/** 성에는 가장자리에서 안쪽으로 다섯 번까지 갈라지는 가는 가지다. 가지 굵기는 남은 갈래 수에 비례한다. */
const FROST = {
  depth: 4,
  rootSpacing: { horizontal: 15, vertical: 21 },
  rootLength: [8, 16],
  rootSpread: 0.6,
  shrink: 0.68,
  bend: 0.5,
  forkChance: 0.6,
  forkAngle: [0.6, 1.1],
  forkShrink: 0.5,
  minLength: 2,
  widthPerDepth: 0.35,
  color: 'rgba(225,242,255,0.55)',
  breath: { base: 0.55, swing: 0.15, frequency: 0.5 },
} as const;
const VIGNETTE = {
  centerY: 0.45,
  inner: 0.3,
  outer: 0.75,
  color: 'rgba(180,225,255,0.28)',
} as const;

type FrostLayerProps = {
  width: number;
  height: number;
  isLowEndDevice: boolean;
  time: SharedValue<number>;
};

/** 강추위: 칼바람 줄기와 바닥의 눈가루, 바람에 실려 반짝이는 얼음 결정, 가장자리 성에와 차가운 테두리 */
export function FrostLayer({ width, height, isLowEndDevice, time }: FrostLayerProps) {
  const glowTop = height * DRIFT_GLOW.top;
  const glowOpacity = useDerivedValue(
    () =>
      (DRIFT_GLOW.alpha + DRIFT_GLOW.gust * getGust(time.get())) /
      (DRIFT_GLOW.alpha + DRIFT_GLOW.gust),
  );
  const center = vec(width / 2, height * VIGNETTE.centerY);
  const vignetteRadius = height * VIGNETTE.outer;

  return (
    <Group>
      <GustStreaks tone="icy" width={width} height={height} time={time} />
      <FrostLayer.Spindrift
        width={width}
        height={height}
        isLowEndDevice={isLowEndDevice}
        time={time}
      />
      <Rect x={0} y={glowTop} width={width} height={height - glowTop} opacity={glowOpacity}>
        <LinearGradient
          start={vec(0, glowTop)}
          end={vec(0, height)}
          colors={[
            `rgba(${DRIFT_GLOW.color},0)`,
            `rgba(${DRIFT_GLOW.color},${DRIFT_GLOW.alpha + DRIFT_GLOW.gust})`,
          ]}
        />
      </Rect>
      <FrostLayer.Crystals
        width={width}
        height={height}
        isLowEndDevice={isLowEndDevice}
        time={time}
      />
      <FrostLayer.EdgeFrost width={width} height={height} time={time} />
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient
          c={center}
          r={vignetteRadius}
          colors={['rgba(180,225,255,0)', 'rgba(180,225,255,0)', VIGNETTE.color]}
          positions={[0, Math.min(1, (width * VIGNETTE.inner) / vignetteRadius), 1]}
        />
      </Rect>
    </Group>
  );
}

FrostLayer.Spindrift = function Spindrift({
  width,
  height,
  isLowEndDevice,
  time,
}: FrostLayerProps) {
  const texture = useParticleTexture();
  const count = getAmbientCount('spindrift', { screen: { width, height }, isLowEndDevice });
  const seeds = createParticleSeeds(count, SPINDRIFT_SEED);
  const { dot } = PARTICLE_SPRITES;
  const [minDepth, maxDepth] = SPINDRIFT.depth;
  const getDepth = (index: number) =>
    minDepth + (seeds[index * PARTICLE_SEED_STRIDE + 3] ?? 0) * (maxDepth - minDepth);
  const sprites = range(count).map(() => Skia.XYWHRect(dot.x, dot.y, dot.width, dot.height));
  const colors = range(count).map((index) =>
    Skia.Color(
      `rgba(255,255,255,${SPINDRIFT.alpha.base + SPINDRIFT.alpha.depth * getDepth(index)})`,
    ),
  );
  const depths = range(count).map(getDepth);
  const anchor = { x: dot.width / 2, y: dot.height / 2 };
  const travelWidth = width + EDGE_MARGIN * 2;

  const transforms = useRSXformBuffer(count, (transform, index) => {
    'worklet';
    const base = index * PARTICLE_SEED_STRIDE;
    const t = time.get();
    const depth = depths[index] ?? 0;
    const [top, bottom] = SPINDRIFT.lanes;
    const speed = SPINDRIFT.speed.base + SPINDRIFT.speed.depth * depth;
    const phase = (seeds[base + 2] ?? 0) * Math.PI * 2;
    const radius = SPINDRIFT.radius.base + SPINDRIFT.radius.depth * depth;
    const x = wrap((seeds[base] ?? 0) * travelWidth + speed * getGustTravel(t), travelWidth);
    const y =
      height * (top + (seeds[base + 1] ?? 0) * (bottom - top)) +
      Math.sin(t * SPINDRIFT.bob.frequency + phase) * SPINDRIFT.bob.amplitude;
    placeSprite(
      transform,
      (radius * SPINDRIFT.sizeRatio) / dot.width,
      0,
      anchor,
      x - EDGE_MARGIN,
      y,
    );
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
};

FrostLayer.Crystals = function Crystals({ width, height, isLowEndDevice, time }: FrostLayerProps) {
  const texture = useParticleTexture();
  const count = getAmbientCount('iceCrystal', { screen: { width, height }, isLowEndDevice });
  const seeds = createParticleSeeds(count, CRYSTAL_SEED);
  const { crystal, dot } = PARTICLE_SPRITES;
  const crystalSprites = range(count).map(() =>
    Skia.XYWHRect(crystal.x, crystal.y, crystal.width, crystal.height),
  );
  const glintSprites = range(count).map(() => Skia.XYWHRect(dot.x, dot.y, dot.width, dot.height));
  const crystalColor = Skia.Color(`rgba(255,255,255,${CRYSTAL.alpha})`);
  const crystalColors = range(count).map(() => crystalColor);
  const crystalAnchor = { x: crystal.width / 2, y: crystal.height / 2 };
  const dotAnchor = { x: dot.width / 2, y: dot.height / 2 };
  const travelWidth = width + EDGE_MARGIN * 2;
  const travelHeight = height + EDGE_MARGIN * 2;

  const crystalAt = (index: number, t: number) => {
    'worklet';
    const base = index * PARTICLE_SEED_STRIDE;
    const [minSize, maxSize] = CRYSTAL.size;
    const [minFall, maxFall] = CRYSTAL.fall;
    const phase = (seeds[base + 3] ?? 0) * Math.PI * 2;
    const sway =
      (Math.sin(t * CRYSTAL.sway.frequency + phase) * CRYSTAL.sway.amplitude) /
      CRYSTAL.sway.frequency;
    const glintWave = Math.max(0, Math.sin(t * CRYSTAL.glint.frequency + phase));
    return {
      x:
        wrap(
          (seeds[base] ?? 0) * travelWidth + CRYSTAL.carry * getGustTravel(t) + sway,
          travelWidth,
        ) - EDGE_MARGIN,
      y:
        wrap(
          (seeds[base + 1] ?? 0) * travelHeight +
            (minFall + (seeds[base + 2] ?? 0) * (maxFall - minFall)) * t,
          travelHeight,
        ) - EDGE_MARGIN,
      size: minSize + (seeds[base + 2] ?? 0) * (maxSize - minSize),
      rotation: phase + ((seeds[base + 2] ?? 0) * 2 - 1) * CRYSTAL.spin * t,
      glint: glintWave ** CRYSTAL.glint.sharpness,
    };
  };

  const crystalTransforms = useRSXformBuffer(count, (transform, index) => {
    'worklet';
    const { x, y, size, rotation } = crystalAt(index, time.get());
    const scale = size / crystal.width;
    placeSprite(
      transform,
      scale * Math.cos(rotation),
      scale * Math.sin(rotation),
      crystalAnchor,
      x,
      y,
    );
  });

  const glintTransforms = useRSXformBuffer(count, (transform, index) => {
    'worklet';
    const { x, y, size, glint } = crystalAt(index, time.get());
    placeSprite(
      transform,
      (size * CRYSTAL.glint.sizeRatio * glint) / dot.width,
      0,
      dotAnchor,
      x,
      y,
    );
  });

  return (
    <Group>
      <Atlas
        image={texture}
        sprites={crystalSprites}
        transforms={crystalTransforms}
        colors={crystalColors}
        colorBlendMode="modulate"
        sampling={PARTICLE_SAMPLING}
      />
      <Atlas
        image={texture}
        sprites={glintSprites}
        transforms={glintTransforms}
        sampling={PARTICLE_SAMPLING}
      />
    </Group>
  );
};

type FrostRoot = { x: number; y: number; angle: number };

/** 굵기별로 한 경로씩 모아 성에 가지를 한 번만 만든다. 화면 크기가 바뀔 때만 다시 만든다. */
function buildEdgeFrost(width: number, height: number): SkPath[] {
  const random = createSeededRandom(FROST_SEED);
  const between = ([min, max]: readonly [number, number]) => min + random() * (max - min);
  const builders = range(FROST.depth).map(() => Skia.PathBuilder.Make());
  const spread = () => (random() * 2 - 1) * FROST.rootSpread;
  const horizontal = Math.max(1, Math.round(width / FROST.rootSpacing.horizontal));
  const vertical = Math.max(1, Math.round(height / FROST.rootSpacing.vertical));
  const roots: FrostRoot[] = [
    ...range(horizontal).flatMap((index) => {
      const x = (index / horizontal) * width;
      return [
        { x, y: 0, angle: Math.PI / 2 + spread() },
        { x, y: height, angle: -Math.PI / 2 + spread() },
      ];
    }),
    ...range(vertical).flatMap((index) => {
      const y = (index / vertical) * height;
      return [
        { x: 0, y, angle: spread() },
        { x: width, y, angle: Math.PI + spread() },
      ];
    }),
  ];

  const branch = (x: number, y: number, angle: number, length: number, depth: number) => {
    const builder: SkPathBuilder | undefined = builders[depth - 1];
    if (depth === 0 || length < FROST.minLength || builder == null) {
      return;
    }
    const nextX = x + Math.cos(angle) * length;
    const nextY = y + Math.sin(angle) * length;
    builder.moveTo(x, y).lineTo(nextX, nextY);
    branch(nextX, nextY, angle + (random() * 2 - 1) * FROST.bend, length * FROST.shrink, depth - 1);
    if (random() < FROST.forkChance) {
      const side = random() < 0.5 ? 1 : -1;
      branch(
        nextX,
        nextY,
        angle + side * between(FROST.forkAngle),
        length * FROST.forkShrink,
        depth - 1,
      );
    }
  };

  for (const root of roots) {
    branch(root.x, root.y, root.angle, between(FROST.rootLength), FROST.depth);
  }
  return builders.map((builder) => {
    const path = builder.detach();
    builder.dispose();
    return path;
  });
}

FrostLayer.EdgeFrost = function EdgeFrost({
  width,
  height,
  time,
}: Omit<FrostLayerProps, 'isLowEndDevice'>) {
  const paths = useMemo(() => buildEdgeFrost(width, height), [width, height]);
  // prop 경로는 Canvas가 커밋 때 복사해 기록하므로 정리 함수에서 바로 놓는다(shared value 경로와 다르다)
  useEffect(
    () => () => {
      for (const path of paths) {
        path.dispose();
      }
    },
    [paths],
  );
  const opacity = useDerivedValue(
    () => FROST.breath.base + FROST.breath.swing * Math.sin(time.get() * FROST.breath.frequency),
  );

  return (
    <Group opacity={opacity}>
      {paths.map((path, index) => (
        <Path
          key={index}
          path={path}
          style="stroke"
          strokeCap="round"
          strokeWidth={(index + 1) * FROST.widthPerDepth}
          color={FROST.color}
        />
      ))}
    </Group>
  );
};
