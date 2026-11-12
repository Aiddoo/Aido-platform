import {
  Atlas,
  Rect,
  Group,
  RadialGradient,
  Skia,
  useRSXformBuffer,
  vec,
} from '@shopify/react-native-skia';
import { range } from 'es-toolkit';
import { type SharedValue, useAnimatedReaction } from 'react-native-reanimated';

import { WEATHER_SCENE_PALETTES } from '../../constants/weather-scene-palette.constants';
import {
  createParticleSeeds,
  getCloudCountPerLayer,
  getSceneReferenceWidth,
  PARTICLE_SEED_STRIDE,
  placeSprite,
  wrap,
} from '../../utils/weather-scene-particles.view-model';
import type { WeatherSceneSky } from '../../utils/weather-scene.view-model';
import {
  CLOUD_SPAN_RATIO,
  CLOUD_SPRITE,
  CLOUD_VARIANTS,
  createCloudSpriteRect,
  PARTICLE_SAMPLING,
  useCloudTexture,
} from './weather-scene-textures';

const CLOUD_SEED = 0xc10d;
/** 먼 층부터 가까운 층까지: 크기, 화면 폭 대비 초당 이동, 불투명도, 세로 위치(화면 높이 비율) */
const DEPTH_LAYERS = [
  { scale: 0.6, speed: 0.004, alpha: 0.45, top: 0.02, bottom: 0.18 },
  { scale: 0.9, speed: 0.008, alpha: 0.65, top: 0.05, bottom: 0.3 },
  { scale: 1.3, speed: 0.014, alpha: 0.8, top: 0.12, bottom: 0.42 },
] as const;
const SIZE_JITTER = [0.8, 1.2] as const;
const WIND_SPEEDUP = 4;
const COVERAGE_BASE = 0.4;
/** 구름 덩이가 화면 왼쪽 밖(폭의 0.5배)에서 들어와 오른쪽 밖(1.4배)으로 나간다. */
const TRAVEL = { start: -0.5, end: 1.4 } as const;
/** 해·달을 가렸다고 볼 구름 몸통 크기(텍스처 대비)와 운량에 따른 가중치 */
const OCCLUSION = { bodyWidth: 0.4, bodyHeight: 0.3, amountWeight: 2.2 } as const;
/** 해·달 가까이(화면 폭 45% 안) 구름 가장자리에 비치는 빛 */
const SILVER_LINING = { radius: 0.45, alpha: 0.35 } as const;
/** 밤 구름은 어두운 하늘에서 튀지 않게 낮의 절반쯤만 짙게 그린다. */
const NIGHT_ALPHA_RATIO = 0.52;
const SPRITE_CENTER = { x: CLOUD_SPRITE.width / 2, y: CLOUD_SPRITE.height / 2 };

type CloudLayerProps = {
  amount: number;
  wind: number;
  sky: WeatherSceneSky;
  isDaylight: boolean;
  /** 해·달이 떠 있으면 그 자리. 가까운 구름 가장자리가 빛나고, 그 자리를 가린 정도를 occlusion에 쓴다. */
  light: CloudLight | null;
  occlusion: SharedValue<number>;
  width: number;
  height: number;
  time: SharedValue<number>;
};

export type CloudLight = { x: number; y: number; rgb: string };

/** 뭉게구름이 먼 층·가운데 층·가까운 층으로 나뉘어 서로 다른 속도로 흐르고, 운량이 많을수록 덩이가 는다. */
export function CloudLayer({
  amount,
  wind,
  sky,
  isDaylight,
  light,
  occlusion,
  width,
  height,
  time,
}: CloudLayerProps) {
  const texture = useCloudTexture();
  const perLayer = getCloudCountPerLayer(amount);
  const count = perLayer * DEPTH_LAYERS.length;
  const seeds = createParticleSeeds(count, CLOUD_SEED);
  const sprites = range(count).map((index) => createCloudSpriteRect(index % CLOUD_VARIANTS));
  const rgb = WEATHER_SCENE_PALETTES[sky].cloud;
  const coverage =
    (COVERAGE_BASE + amount * (1 - COVERAGE_BASE)) * (isDaylight ? 1 : NIGHT_ALPHA_RATIO);
  const colors = range(count).map((index) => {
    const layer = DEPTH_LAYERS[Math.floor(index / perLayer)] ?? DEPTH_LAYERS[0];
    return Skia.Color(`rgba(${rgb},${layer.alpha * coverage})`);
  });
  const referenceWidth = getSceneReferenceWidth(width);
  const speedup = 1 + wind * WIND_SPEEDUP;
  const travel = TRAVEL.end - TRAVEL.start;
  const [minSize, maxSize] = SIZE_JITTER;
  const occlusionWeight = Math.min(1, amount * OCCLUSION.amountWeight);

  const cloudAt = (index: number, t: number) => {
    'worklet';
    const layer = DEPTH_LAYERS[Math.floor(index / perLayer)] ?? DEPTH_LAYERS[0];
    const base = index * PARTICLE_SEED_STRIDE;
    const size = layer.scale * (minSize + (seeds[base + 2] ?? 0) * (maxSize - minSize));
    const progress = wrap((seeds[base] ?? 0) * travel + t * layer.speed * speedup, travel);
    return {
      scale: (size * referenceWidth * CLOUD_SPAN_RATIO) / CLOUD_SPRITE.width,
      x: (TRAVEL.start + progress) * width,
      y: height * (layer.top + (seeds[base + 1] ?? 0) * (layer.bottom - layer.top)),
    };
  };

  const transforms = useRSXformBuffer(count, (transform, index) => {
    'worklet';
    const { scale, x, y } = cloudAt(index, time.get());
    placeSprite(transform, scale, 0, SPRITE_CENTER, x, y);
  });

  useAnimatedReaction(
    () => {
      if (light == null) {
        return 0;
      }
      let cover = 0;
      for (let index = 0; index < count; index += 1) {
        const { scale, x, y } = cloudAt(index, time.get());
        const dx = (x - light.x) / (CLOUD_SPRITE.width * scale * OCCLUSION.bodyWidth);
        const dy = (y - light.y) / (CLOUD_SPRITE.height * scale * OCCLUSION.bodyHeight);
        cover = Math.max(cover, 1 - Math.sqrt(dx * dx + dy * dy));
      }
      return Math.max(0, cover) * occlusionWeight;
    },
    (cover) => occlusion.set(cover),
  );

  const atlas = (
    <Atlas
      image={texture}
      sprites={sprites}
      transforms={transforms}
      colors={colors}
      colorBlendMode="modulate"
      sampling={PARTICLE_SAMPLING}
    />
  );
  if (light == null) {
    return atlas;
  }
  const rimRadius = referenceWidth * SILVER_LINING.radius;
  const rimColor = Skia.Color(`rgb(${light.rgb})`);

  return (
    <Group>
      {atlas}
      <Group layer blendMode="screen">
        <Atlas
          image={texture}
          sprites={sprites}
          transforms={transforms}
          colors={colors.map(() => rimColor)}
          colorBlendMode="modulate"
          sampling={PARTICLE_SAMPLING}
        />
        <Rect x={0} y={0} width={width} height={height} blendMode="dstIn">
          <RadialGradient
            c={vec(light.x, light.y)}
            r={rimRadius}
            colors={[`rgba(0,0,0,${SILVER_LINING.alpha})`, 'rgba(0,0,0,0)']}
          />
        </Rect>
      </Group>
    </Group>
  );
}
