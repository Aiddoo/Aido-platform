import {
  Atlas,
  Group,
  LinearGradient,
  Path,
  Rect,
  Skia,
  usePathValue,
  useRSXformBuffer,
  vec,
} from '@shopify/react-native-skia';
import { range } from 'es-toolkit';
import type { SharedValue } from 'react-native-reanimated';

import {
  createParticleSeeds,
  getAmbientCount,
  hashCycle,
  PARTICLE_SEED_STRIDE,
  placeSprite,
} from '../../utils/weather-scene-particles';
import {
  GLASS_DROP_SPRITE,
  PARTICLE_SAMPLING,
  useGlassDropTexture,
} from './weather-scene-textures';

const DROP_SEED = 0x91a5;
const MIST_COLORS = ['rgba(210,220,232,0.06)', 'rgba(210,220,232,0.2)'];
const TRAIL_COLOR = 'rgba(230,238,248,0.12)';
/** 물방울은 1~8초 맺혀 있다가 초속 60pt로 80pt 흘러내린 뒤 다른 자리에 다시 맺힌다. */
const WAIT_SECONDS = [1, 8] as const;
const SLIDE_SPEED = 60;
const SLIDE_DISTANCE = 80;
const SLIDE_SECONDS = SLIDE_DISTANCE / SLIDE_SPEED;
const DROP_RADIUS = [2, 5.5] as const;
const DROP_AREA = [0.04, 0.96] as const;
const TRAIL_WIDTH_RATIO = 0.6;
const SPRITE_CENTER = { x: GLASS_DROP_SPRITE.width / 2, y: GLASS_DROP_SPRITE.height / 2 };

type GlassDropletLayerProps = {
  width: number;
  height: number;
  isLowEndDevice: boolean;
  time: SharedValue<number>;
};

/** 옅은 물안개 위로 화면 유리에 맺힌 물방울이 가끔 주르륵 흘러내린다. */
export function GlassDropletLayer({ width, height, isLowEndDevice, time }: GlassDropletLayerProps) {
  const texture = useGlassDropTexture();
  const count = getAmbientCount('glassDrop', { screen: { width, height }, isLowEndDevice });
  const seeds = createParticleSeeds(count, DROP_SEED);
  const sprites = range(count).map(() =>
    Skia.XYWHRect(0, 0, GLASS_DROP_SPRITE.width, GLASS_DROP_SPRITE.height),
  );

  const dropAt = (index: number, t: number) => {
    'worklet';
    const base = index * PARTICLE_SEED_STRIDE;
    const [minWait, maxWait] = WAIT_SECONDS;
    const [minRadius, maxRadius] = DROP_RADIUS;
    const [start, end] = DROP_AREA;
    const wait = minWait + (seeds[base] ?? 0) * (maxWait - minWait);
    const period = wait + SLIDE_SECONDS;
    const elapsed = t + (seeds[base + 1] ?? 0) * period;
    const cycle = Math.floor(elapsed / period);
    const local = elapsed - cycle * period;
    return {
      x: width * (start + hashCycle(index, cycle, 0) * (end - start)),
      y: height * (start + hashCycle(index, cycle, 1) * (end - start)),
      radius: minRadius + hashCycle(index, cycle, 2) * (maxRadius - minRadius),
      slide: Math.max(0, local - wait) * SLIDE_SPEED,
    };
  };

  const transforms = useRSXformBuffer(count, (transform, index) => {
    'worklet';
    const drop = dropAt(index, time.get());
    placeSprite(
      transform,
      drop.radius / GLASS_DROP_SPRITE.radius,
      0,
      SPRITE_CENTER,
      drop.x,
      drop.y + drop.slide,
    );
  });

  const trails = usePathValue((builder) => {
    'worklet';
    const t = time.get();
    for (let index = 0; index < count; index += 1) {
      const drop = dropAt(index, t);
      if (drop.slide > 0) {
        // 프레임마다 물방울 수만큼 Rect 객체를 만들지 않도록 같은 사각형을 선으로 그린다
        const left = drop.x - (drop.radius * TRAIL_WIDTH_RATIO) / 2;
        const right = left + drop.radius * TRAIL_WIDTH_RATIO;
        const bottom = drop.y + drop.slide;
        builder
          .moveTo(left, drop.y)
          .lineTo(right, drop.y)
          .lineTo(right, bottom)
          .lineTo(left, bottom)
          .close();
      }
    }
  });

  return (
    <Group>
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={MIST_COLORS} />
      </Rect>
      <Path path={trails} color={TRAIL_COLOR} />
      <Atlas
        image={texture}
        sprites={sprites}
        transforms={transforms}
        sampling={PARTICLE_SAMPLING}
      />
    </Group>
  );
}
