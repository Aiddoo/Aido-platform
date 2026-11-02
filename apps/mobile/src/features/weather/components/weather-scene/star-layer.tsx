import { Group, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { range } from 'es-toolkit';
import { useEffect, useMemo } from 'react';
import { interpolate, type SharedValue, useDerivedValue } from 'react-native-reanimated';

import { createStarField, STAR_TWINKLE_GROUPS, type Star } from './weather-scene-particles';

const STAR_SEED = 0x57a2;
/** 시안 wxTwinkle: 3.4초 주기로 0.15↔0.9. 그룹마다 주기·위상을 달리해 한꺼번에 깜빡이지 않게 한다. */
const TWINKLE_PERIOD_SECONDS = 3.4;
const TWINKLE_OPACITY = [0.15, 0.9];
const UNIT = [0, 1];
const HALO_RADIUS_RATIO = 3.2;

function buildPath(stars: Star[], radiusRatio = 1): SkPath {
  const builder = Skia.PathBuilder.Make();
  for (const star of stars) {
    builder.addCircle(star.x, star.y, star.radius * radiusRatio);
  }
  return builder.detach();
}

type StarLayerProps = {
  clouds: number;
  width: number;
  height: number;
  time: SharedValue<number>;
};

export function StarLayer({ clouds, width, height, time }: StarLayerProps) {
  const { groups, halos } = useMemo(() => {
    const stars = createStarField(width, height, STAR_SEED);
    return {
      groups: range(STAR_TWINKLE_GROUPS).map((group) =>
        buildPath(stars.filter((star) => star.group === group)),
      ),
      halos: buildPath(
        stars.filter((star) => star.isBright),
        HALO_RADIUS_RATIO,
      ),
    };
  }, [width, height]);

  useEffect(
    () => () => {
      for (const path of [...groups, halos]) {
        path.dispose();
      }
    },
    [groups, halos],
  );

  return (
    <Group opacity={1 - clouds}>
      <Path path={halos} color="rgba(220,230,255,0.07)" />
      {groups.map((path, group) => (
        <TwinklingStars key={group} path={path} group={group} time={time} />
      ))}
    </Group>
  );
}

type TwinklingStarsProps = {
  path: SkPath;
  group: number;
  time: SharedValue<number>;
};

function TwinklingStars({ path, group, time }: TwinklingStarsProps) {
  const period = TWINKLE_PERIOD_SECONDS * (0.85 + group * 0.12);
  const phase = group * 2.3;
  const opacity = useDerivedValue(() => {
    const wave = 0.5 - 0.5 * Math.cos((time.get() / period) * Math.PI * 2 + phase);
    return interpolate(wave, UNIT, TWINKLE_OPACITY);
  });
  return <Path path={path} color="white" opacity={opacity} />;
}
