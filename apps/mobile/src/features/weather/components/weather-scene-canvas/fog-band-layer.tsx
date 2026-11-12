import { Atlas, Skia, useRSXformBuffer } from '@shopify/react-native-skia';
import { range } from 'es-toolkit';
import type { SharedValue } from 'react-native-reanimated';

import { WEATHER_SCENE_PALETTES } from '../../constants/weather-scene-palette.constants';
import {
  createParticleSeeds,
  getSceneReferenceWidth,
  PARTICLE_SEED_STRIDE,
  placeSprite,
  wrap,
} from '../../utils/weather-scene-particles.view-model';
import type { WeatherSceneSky } from '../../utils/weather-scene.view-model';
import { FOG_BAND_SPRITE, PARTICLE_SAMPLING, useFogBandTexture } from './weather-scene-textures';

const FOG_BAND_SEED = 0xf09b;
const BAND_COUNT = 8;
/** 띠는 화면 높이 18%부터 10%씩 아래로 놓이고, 위아래로 3%까지 흔들린다. */
const BAND_LANES = { top: 0.18, step: 0.1, jitter: 0.03 } as const;
/** 띠 폭은 화면 폭의 1.4~2.6배 */
const BAND_WIDTH = [1.44, 2.56] as const;
/** 화면 폭 대비 초당 이동. 홀수 번째 띠는 반대로 흐른다. */
const BAND_SPEED = [0.006, 0.018] as const;
const BAND_ALPHA = [0.35, 0.6] as const;
/** 띠 가운데가 화면 폭의 -0.9배에서 1.1배 사이를 돌며 흐른다. */
const BAND_TRAVEL = { start: -0.9, length: 2 } as const;
const SPRITE_CENTER = { x: FOG_BAND_SPRITE.width / 2, y: FOG_BAND_SPRITE.height / 2 };

type FogBandLayerProps = {
  sky: WeatherSceneSky;
  width: number;
  height: number;
  time: SharedValue<number>;
};

/** 짙은 안개 띠 여러 겹이 서로 반대 방향으로 천천히 흐른다. */
export function FogBandLayer({ sky, width, height, time }: FogBandLayerProps) {
  const texture = useFogBandTexture();
  const seeds = createParticleSeeds(BAND_COUNT, FOG_BAND_SEED);
  const rgb = WEATHER_SCENE_PALETTES[sky].fog;
  const sprites = range(BAND_COUNT).map(() =>
    Skia.XYWHRect(0, 0, FOG_BAND_SPRITE.width, FOG_BAND_SPRITE.height),
  );
  const colors = range(BAND_COUNT).map((index) => {
    const [min, max] = BAND_ALPHA;
    const alpha = min + (seeds[index * PARTICLE_SEED_STRIDE + 3] ?? 0) * (max - min);
    return Skia.Color(`rgba(${rgb},${alpha})`);
  });

  const referenceWidth = getSceneReferenceWidth(width);

  const transforms = useRSXformBuffer(BAND_COUNT, (transform, index) => {
    'worklet';
    const base = index * PARTICLE_SEED_STRIDE;
    const [minWidth, maxWidth] = BAND_WIDTH;
    const [minSpeed, maxSpeed] = BAND_SPEED;
    const direction = index % 2 === 0 ? 1 : -1;
    const speed = direction * (minSpeed + (seeds[base + 2] ?? 0) * (maxSpeed - minSpeed));
    const bandWidth = referenceWidth * (minWidth + (seeds[base + 1] ?? 0) * (maxWidth - minWidth));
    const progress = wrap(
      (seeds[base] ?? 0) * BAND_TRAVEL.length + time.get() * speed,
      BAND_TRAVEL.length,
    );
    const jitter = ((seeds[base + 3] ?? 0) * 2 - 1) * BAND_LANES.jitter;
    placeSprite(
      transform,
      bandWidth / FOG_BAND_SPRITE.width,
      0,
      SPRITE_CENTER,
      width * (BAND_TRAVEL.start + progress) + width / 2,
      height * (BAND_LANES.top + index * BAND_LANES.step + jitter),
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
}
