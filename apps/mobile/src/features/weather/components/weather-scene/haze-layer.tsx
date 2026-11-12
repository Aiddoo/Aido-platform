import {
  Atlas,
  Group,
  LinearGradient,
  Rect,
  Skia,
  useRSXformBuffer,
  vec,
} from '@shopify/react-native-skia';
import { range } from 'es-toolkit';
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';

import {
  createParticleSeeds,
  getAmbientCount,
  PARTICLE_SEED_STRIDE,
  placeSprite,
  wrap,
} from '../../utils/weather-scene-particles.view-model';
import { PARTICLE_SAMPLING, PARTICLE_SPRITES, useParticleTexture } from './weather-scene-textures';

const DUST_SEED = 0xd057;
const VEIL_COLORS = ['rgba(214,196,168,0.18)', 'rgba(206,186,156,0.4)'];
const VEIL_BREATH = { base: 0.92, swing: 0.08, frequency: 0.5 } as const;
const DUST_RADIUS = [0.6, 1.8] as const;
const DUST_DRIFT = [4, 10] as const;
const DUST_BOB = { amplitude: 10, frequency: 0.7 } as const;
const DUST_GLINT = { min: 0.5, swing: 0.5, frequency: 1.3 } as const;
const DUST_SPRITE_RADIUS_RATIO = 4;
const DUST_ALPHA = 0.7;
const EDGE_MARGIN = 5;

type HazeLayerProps = {
  width: number;
  height: number;
  isLowEndDevice: boolean;
  time: SharedValue<number>;
};

/** 누런 막이 하늘을 덮고, 공기 중의 미세한 먼지가 반짝이며 옆으로 떠다닌다. */
export function HazeLayer({ width, height, isLowEndDevice, time }: HazeLayerProps) {
  const texture = useParticleTexture();
  const count = getAmbientCount('dust', { screen: { width, height }, isLowEndDevice });
  const seeds = createParticleSeeds(count, DUST_SEED);
  const { warm } = PARTICLE_SPRITES;
  const sprites = range(count).map(() => Skia.XYWHRect(warm.x, warm.y, warm.width, warm.height));
  const color = Skia.Color(`rgba(255,255,255,${DUST_ALPHA})`);
  const colors = range(count).map(() => color);
  const anchor = { x: warm.width / 2, y: warm.height / 2 };
  const travelWidth = width + EDGE_MARGIN * 2;
  const veilOpacity = useDerivedValue(
    () => VEIL_BREATH.base + VEIL_BREATH.swing * Math.sin(time.get() * VEIL_BREATH.frequency),
  );

  const transforms = useRSXformBuffer(count, (transform, index) => {
    'worklet';
    const base = index * PARTICLE_SEED_STRIDE;
    const t = time.get();
    const phase = (seeds[base + 3] ?? 0) * Math.PI * 2;
    const [minRadius, maxRadius] = DUST_RADIUS;
    const [minDrift, maxDrift] = DUST_DRIFT;
    const radius = minRadius + (seeds[base + 2] ?? 0) * (maxRadius - minRadius);
    const drift = minDrift + (seeds[base + 2] ?? 0) * (maxDrift - minDrift);
    const glint = Math.sin(t * DUST_GLINT.frequency + phase);
    const scale =
      (radius * DUST_SPRITE_RADIUS_RATIO * (DUST_GLINT.min + DUST_GLINT.swing * glint * glint)) /
      warm.width;
    const x = wrap((seeds[base] ?? 0) * travelWidth + t * drift, travelWidth) - EDGE_MARGIN;
    const y =
      (seeds[base + 1] ?? 0) * height +
      Math.sin(t * DUST_BOB.frequency + phase) * DUST_BOB.amplitude;
    placeSprite(transform, scale, 0, anchor, x, y);
  });

  return (
    <Group>
      <Rect x={0} y={0} width={width} height={height} opacity={veilOpacity}>
        <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={VEIL_COLORS} />
      </Rect>
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
}
