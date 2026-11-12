import {
  Atlas,
  BackdropFilter,
  Group,
  LinearGradient,
  Rect,
  RuntimeShader,
  Skia,
  useRSXformBuffer,
  vec,
} from '@shopify/react-native-skia';
import { range } from 'es-toolkit';
import { PixelRatio } from 'react-native';
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';

import {
  createParticleSeeds,
  getAmbientCount,
  PARTICLE_SEED_STRIDE,
  placeSprite,
  wrap,
} from '../../utils/weather-scene-particles.view-model';
import {
  HEAT_WAVE_SPRITE,
  PARTICLE_SAMPLING,
  PARTICLE_SPRITES,
  useHeatWaveTexture,
  useParticleTexture,
} from './weather-scene-textures';

/** 일렁임은 화면 높이 55% 아래에서 시작해 바닥으로 갈수록 세진다. */
const SHIMMER_START = 0.55;
const HEAT_SHIMMER = Skia.RuntimeEffect.Make(`
uniform shader image;
uniform float time;
uniform float start;
uniform float span;
uniform float pixelRatio;

half4 main(float2 position) {
  float y = position.y / pixelRatio;
  float strength = clamp((y - start) / span, 0.0, 1.0);
  float offset = (sin(y * 0.08 + time * 5.0) * 3.2 + sin(y * 0.027 - time * 2.3) * 2.0) * strength;
  return image.eval(float2(position.x + offset * pixelRatio, position.y));
}
`);
const WAVE_SEED = 0x4ea7;
const WAVE_COUNT = 7;
/** 열기 물결은 화면 높이 102%에서 35%까지 올라가며, 위쪽 20% 구간에서 사라진다. */
const WAVE_RANGE = { bottom: 1.02, top: 0.35, fade: 0.2 } as const;
const WAVE_SPEED = [10, 18] as const;
const WAVE_ALPHA = [0.08, 0.16] as const;
const WAVE_SWAY = { amplitude: 20, frequency: 1.3 } as const;
const WAVE_ANCHOR = { x: 0, y: HEAT_WAVE_SPRITE.height / 2 };
const WAVE_COLOR = '255,214,160';
const GLOW_COLORS = ['rgba(255,150,70,0)', 'rgba(255,120,50,0.28)'];
const GLOW_BREATH = { base: 0.79, swing: 0.21, frequency: 1.6 } as const;
const EMBER_SEED = 0xe4b3;
const EMBER_RADIUS = [1, 3] as const;
const EMBER_RISE = [6, 16] as const;
/** 불씨는 바닥에서 화면 높이 15%까지 올라간다. */
const EMBER_TOP = 0.15;
const EMBER_SWAY = 15;
const EMBER_GLINT = { base: 0.5, swing: 0.5, frequency: 2 } as const;
const EMBER_SIZE_RATIO = 4;
const EMBER_ALPHA = 0.6;

type HeatLayerProps = {
  width: number;
  height: number;
  isLowEndDevice: boolean;
  time: SharedValue<number>;
};

/** 무더위: 아래쪽 공기가 일렁이고, 열기 물결이 올라가며, 바닥에서 주황빛 열기와 불씨가 피어오른다. */
export function HeatLayer({ width, height, isLowEndDevice, time }: HeatLayerProps) {
  const start = height * SHIMMER_START;
  const glowOpacity = useDerivedValue(
    () => GLOW_BREATH.base + GLOW_BREATH.swing * Math.sin(time.get() * GLOW_BREATH.frequency),
  );

  return (
    <Group>
      <HeatLayer.Waves width={width} height={height} time={time} />
      <Rect x={0} y={start} width={width} height={height - start} opacity={glowOpacity}>
        <LinearGradient start={vec(0, start)} end={vec(0, height)} colors={GLOW_COLORS} />
      </Rect>
      <HeatLayer.Embers width={width} height={height} isLowEndDevice={isLowEndDevice} time={time} />
      <HeatLayer.Shimmer width={width} height={height} time={time} />
    </Group>
  );
}

type HeatAreaProps = { width: number; height: number; time: SharedValue<number> };

/** 먼저 그린 열기 물결·불씨를 셰이더로 좌우로 흔들어 아지랑이를 만든다. */
HeatLayer.Shimmer = function Shimmer({ width, height, time }: HeatAreaProps) {
  const start = height * SHIMMER_START;
  const pixelRatio = PixelRatio.get();
  const uniforms = useDerivedValue(() => ({
    time: time.get(),
    start,
    span: height - start,
    pixelRatio,
  }));
  if (HEAT_SHIMMER == null) {
    return null;
  }
  return (
    <BackdropFilter
      clip={Skia.XYWHRect(0, start, width, height - start)}
      filter={<RuntimeShader source={HEAT_SHIMMER} uniforms={uniforms} />}
    />
  );
};

HeatLayer.Waves = function Waves({ width, height, time }: HeatAreaProps) {
  const texture = useHeatWaveTexture();
  const seeds = createParticleSeeds(WAVE_COUNT, WAVE_SEED);
  const sprites = range(WAVE_COUNT).map(() =>
    Skia.XYWHRect(0, 0, HEAT_WAVE_SPRITE.width, HEAT_WAVE_SPRITE.height),
  );
  const colors = range(WAVE_COUNT).map((index) => {
    const [min, max] = WAVE_ALPHA;
    const alpha = min + (seeds[index * PARTICLE_SEED_STRIDE + 3] ?? 0) * (max - min);
    return Skia.Color(`rgba(${WAVE_COLOR},${alpha})`);
  });
  const bottom = height * WAVE_RANGE.bottom;
  const top = height * WAVE_RANGE.top;
  const travel = bottom - top;
  const fadeEnd = top + height * WAVE_RANGE.fade;
  const scale = (width + WAVE_SWAY.amplitude * 2) / HEAT_WAVE_SPRITE.width;

  const transforms = useRSXformBuffer(WAVE_COUNT, (transform, index) => {
    'worklet';
    const base = index * PARTICLE_SEED_STRIDE;
    const t = time.get();
    const [minSpeed, maxSpeed] = WAVE_SPEED;
    const speed = minSpeed + (seeds[base + 1] ?? 0) * (maxSpeed - minSpeed);
    const phase = (seeds[base + 2] ?? 0) * Math.PI * 2;
    const y =
      bottom - wrap(((index + (seeds[base] ?? 0)) / WAVE_COUNT) * travel + speed * t, travel);
    const x = -WAVE_SWAY.amplitude * (1 + Math.sin(t * WAVE_SWAY.frequency + phase));
    placeSprite(transform, scale, 0, WAVE_ANCHOR, x, y);
  });

  return (
    <Group layer>
      <Atlas
        image={texture}
        sprites={sprites}
        transforms={transforms}
        colors={colors}
        colorBlendMode="modulate"
        sampling={PARTICLE_SAMPLING}
      />
      <Rect x={0} y={0} width={width} height={height} blendMode="dstIn">
        <LinearGradient
          start={vec(0, top)}
          end={vec(0, fadeEnd)}
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,1)']}
        />
      </Rect>
    </Group>
  );
};

HeatLayer.Embers = function Embers({
  width,
  height,
  isLowEndDevice,
  time,
}: HeatAreaProps & { isLowEndDevice: boolean }) {
  const texture = useParticleTexture();
  const count = getAmbientCount('ember', { screen: { width, height }, isLowEndDevice });
  const seeds = createParticleSeeds(count, EMBER_SEED);
  const { warm } = PARTICLE_SPRITES;
  const sprites = range(count).map(() => Skia.XYWHRect(warm.x, warm.y, warm.width, warm.height));
  const color = Skia.Color(`rgba(255,255,255,${EMBER_ALPHA})`);
  const colors = range(count).map(() => color);
  const anchor = { x: warm.width / 2, y: warm.height / 2 };
  const travel = height * (1 - EMBER_TOP);

  const transforms = useRSXformBuffer(count, (transform, index) => {
    'worklet';
    const base = index * PARTICLE_SEED_STRIDE;
    const t = time.get();
    const [minRadius, maxRadius] = EMBER_RADIUS;
    const [minRise, maxRise] = EMBER_RISE;
    const phase = (seeds[base + 3] ?? 0) * Math.PI * 2;
    const radius = minRadius + (seeds[base + 2] ?? 0) * (maxRadius - minRadius);
    const rise = minRise + (seeds[base + 1] ?? 0) * (maxRise - minRise);
    const glint =
      EMBER_GLINT.base + EMBER_GLINT.swing * Math.sin(t * EMBER_GLINT.frequency + phase);
    const scale = (radius * EMBER_SIZE_RATIO * glint) / warm.width;
    const y = height - wrap((seeds[base + 1] ?? 0) * travel + rise * t, travel);
    const x = (seeds[base] ?? 0) * width + Math.sin(t + phase) * EMBER_SWAY;
    placeSprite(transform, scale, 0, anchor, x, y);
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
