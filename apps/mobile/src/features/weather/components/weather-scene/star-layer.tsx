import { Group, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';

import { createSeededRandom } from './weather-scene-particles';

const STAR_SEED = 0x57a2;
const STAR_GROUP_COUNT = 3;
const SCREEN_AREA_PER_STAR = 3600;
const MAX_STARS = 140;
const STAR_FIELD_HEIGHT_RATIO = 0.62;

function buildStarPaths(width: number, height: number): SkPath[] {
  const random = createSeededRandom(STAR_SEED);
  const builders = Array.from({ length: STAR_GROUP_COUNT }, () => Skia.PathBuilder.Make());
  const count = Math.min(MAX_STARS, Math.round((width * height) / SCREEN_AREA_PER_STAR));
  for (let index = 0; index < count; index += 1) {
    const x = random() * width;
    const y = random() ** 1.6 * height * STAR_FIELD_HEIGHT_RATIO;
    const radius = 0.45 + random() ** 3 * 1.1;
    builders[index % STAR_GROUP_COUNT]?.addCircle(x, y, radius);
  }
  return builders.map((builder) => builder.detach());
}

type StarLayerProps = {
  clouds: number;
  width: number;
  height: number;
  time: SharedValue<number>;
};

export function StarLayer({ clouds, width, height, time }: StarLayerProps) {
  const paths = buildStarPaths(width, height);
  const visibility = 1 - clouds;

  return (
    <Group opacity={visibility}>
      {paths.map((path, index) => (
        <TwinklingStars key={index} path={path} phase={index} time={time} />
      ))}
    </Group>
  );
}

type TwinklingStarsProps = {
  path: SkPath;
  phase: number;
  time: SharedValue<number>;
};

function TwinklingStars({ path, phase, time }: TwinklingStarsProps) {
  const opacity = useDerivedValue(
    () => 0.6 + 0.4 * Math.sin(time.get() * (0.7 + phase * 0.45) + phase * 2.1),
  );
  return <Path path={path} color="rgba(255,255,255,0.9)" opacity={opacity} />;
}
