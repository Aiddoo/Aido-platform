import { Group, LinearGradient, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import type { PropsWithChildren } from 'react';

/** 시안 배경은 그대로 두되, 상태 표시줄과 맨 아래 글자가 밝은 하늘에서도 읽히도록 가장자리만 살짝 어둡게 한다. */
const SCRIM_COLORS = {
  day: ['rgba(0,10,30,0.2)', 'rgba(0,10,30,0)', 'rgba(0,10,30,0)', 'rgba(0,10,30,0.16)'],
  night: ['rgba(0,0,0,0.12)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.12)'],
} as const;

type ScrimLayerProps = {
  isDaylight: boolean;
  width: number;
  height: number;
};

export function ScrimLayer({ isDaylight, width, height }: ScrimLayerProps) {
  return (
    <Rect x={0} y={0} width={width} height={height}>
      <LinearGradient
        start={vec(0, 0)}
        end={vec(0, height)}
        colors={[...SCRIM_COLORS[isDaylight ? 'day' : 'night']]}
        positions={[0, 0.22, 0.75, 1]}
      />
    </Rect>
  );
}

/** 지명·기온 뒤에 옅은 어둠을 깔아 그 위를 지나는 구름·빛 위에서도 큰 글자가 읽히게 한다. */
const HERO_SCRIM = {
  centerBelowContentTop: 0.1,
  radius: 0.7,
  maxRadius: 420,
  color: { day: '0,20,50', night: '0,0,0' },
  alpha: { day: 0.12, night: 0.24 },
} as const;

type HeroScrimLayerProps = ScrimLayerProps & {
  contentTop: number;
  heroLeft: number;
  heroWidth: number;
};

export function HeroScrimLayer({
  isDaylight,
  contentTop,
  heroLeft,
  heroWidth,
  width,
  height,
}: HeroScrimLayerProps) {
  const columnWidth = Math.min(width - heroLeft, heroWidth);
  const center = vec(
    heroLeft + columnWidth / 2,
    contentTop + height * HERO_SCRIM.centerBelowContentTop,
  );
  const radius = Math.min(columnWidth * HERO_SCRIM.radius, HERO_SCRIM.maxRadius);
  const time = isDaylight ? 'day' : 'night';
  const rgb = HERO_SCRIM.color[time];
  return (
    <Rect x={0} y={0} width={width} height={height}>
      <RadialGradient
        c={center}
        r={radius}
        colors={[`rgba(${rgb},${HERO_SCRIM.alpha[time]})`, `rgba(${rgb},0)`]}
      />
    </Rect>
  );
}

/** 헤더 버튼 줄 아래에서부터 서서히 보이게 해, 해·달 빛살이 버튼 뒤로 비쳐 모양처럼 보이지 않게 한다. */
const HEADER_FADE = { above: 4, below: 20 } as const;

type BelowHeaderProps = PropsWithChildren<{ contentTop: number; width: number; height: number }>;

export function BelowHeader({ contentTop, width, height, children }: BelowHeaderProps) {
  return (
    <Group layer>
      {children}
      <Rect x={0} y={0} width={width} height={height} blendMode="dstIn">
        <LinearGradient
          start={vec(0, contentTop - HEADER_FADE.above)}
          end={vec(0, contentTop + HEADER_FADE.below)}
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,1)']}
        />
      </Rect>
    </Group>
  );
}
