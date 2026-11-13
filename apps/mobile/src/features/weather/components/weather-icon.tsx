import type { WeatherCondition } from '@aido/api/vocabulary';
import { useFontScaleRatio } from '@src/shared/hooks/use-font-scale-ratio';
import { createStyledIcon } from '@src/shared/ui';
import { round } from 'es-toolkit';
import type { ComponentProps } from 'react';
import Svg, { Path } from 'react-native-svg';
import { match, P } from 'ts-pattern';

import { ALERT_GLYPH_COLORS } from '../constants/weather-colors.constants';

const StyledSvg = createStyledIcon(Svg);

/** 흰 면은 currentColor로 그려 on-sky 토큰(colorClassName)을 따른다. */
const WHITE = 'currentColor';
const SUN_YELLOW = '#FFD54A';
const RAIN_BLUE = '#6CC0FF';
const MOON_CREAM = '#F3EEDB';
const SUNSET_ORANGE = '#FFB35C';
const MONO_STROKE_WIDTH = 1.9;
const CARD_STROKE_WIDTH = 2.2;
const CARD_ICON_SIZE = 13;
const GLYPH_ICON_SIZE = 24;

const PATH_PRECISION = 2;

/** 겹치는 도형이 nonzero 규칙으로 합쳐지도록 원·사각형·귀를 모두 시계 방향으로 그린다. */
function circlePath(cx: number, cy: number, r: number) {
  const left = round(cx - r, PATH_PRECISION);
  return `M${left} ${round(cy, PATH_PRECISION)}a${round(r, PATH_PRECISION)} ${round(r, PATH_PRECISION)} 0 1 1 ${round(2 * r, PATH_PRECISION)} 0a${round(r, PATH_PRECISION)} ${round(r, PATH_PRECISION)} 0 1 1 ${round(-2 * r, PATH_PRECISION)} 0z`;
}

function catCloudPath(dx: number, dy: number, scale: number) {
  const x = (value: number) => round(value * scale + dx, PATH_PRECISION);
  const y = (value: number) => round(value * scale + dy, PATH_PRECISION);
  return [
    circlePath(x(12), y(10), 5 * scale),
    circlePath(x(7.5), y(13.5), 3.5 * scale),
    circlePath(x(17), y(13), 4 * scale),
    `M${x(7.5)} ${y(12)}H${x(17)}V${y(17)}H${x(7.5)}z`,
    `M${x(8.4)} ${y(7.6)}L${x(8.8)} ${y(3.4)}L${x(11.4)} ${y(5.2)}z`,
    `M${x(12.6)} ${y(5.2)}L${x(15.2)} ${y(3.4)}L${x(15.6)} ${y(7.6)}z`,
  ].join('');
}

interface GlyphPart {
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

/** color는 하늘 카드 위 채움형(시안 V2Screen), mono는 단색 선형(시안 Icons의 흰색 단색 행)이다. */
interface Glyph {
  color: GlyphPart[];
  mono: string;
}

const MONO_RAIN_CLOUD =
  'M7 14h10a4 4 0 0 0 .4-8 5.4 5.4 0 0 0-10.2-.2A4.1 4.1 0 0 0 7 14zM8.6 5.9l.8-2.9 2 1.7M14.2 4.1l1.8-1.8.7 2.8';
const SUN_RAYS =
  'M12 2.6v2.1M12 19.3v2.1M2.6 12h2.1M19.3 12h2.1M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M5.4 18.6l1.5-1.5M17.1 6.9l1.5-1.5';
const HORIZON_SUN = 'M6.5 18.5a5.5 5.5 0 0 1 11 0z';
const SUNSET_ARROW = 'M3 18.5h18M12 4v6M9.6 7.8L12 10.2l2.4-2.4';
const SUNRISE_ARROW = 'M3 18.5h18M12 10V4M9.6 6.4L12 4l2.4 2.4';
const WARNING_TRIANGLE = 'M10.3 3.8a2 2 0 0 1 3.4 0l8 13.7A2 2 0 0 1 20 20.5H4a2 2 0 0 1-1.7-3z';
const WARNING_MARK = 'M12 9v4.5M12 16.8v.01';

const GLYPHS = {
  sun: {
    color: [
      { d: circlePath(12, 12, 4.6), fill: SUN_YELLOW },
      { d: SUN_RAYS, stroke: SUN_YELLOW, strokeWidth: 1.9 },
    ],
    mono: 'M12 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
  },
  moon: {
    color: [{ d: 'M15.3 3.6a8.6 8.6 0 1 0 5.1 12.6 7.1 7.1 0 0 1-5.1-12.6z', fill: MOON_CREAM }],
    mono: 'M15.5 3.5a8 8 0 1 0 5 10.8 6.5 6.5 0 0 1-5-10.8zM9.6 5.4l.6-2.6 1.7 1.5',
  },
  partlyCloudy: {
    color: [
      { d: circlePath(8.6, 8.4, 3.6), fill: SUN_YELLOW },
      {
        d: 'M8.6 2.4v1.3M2.6 8.4h1.3M4.4 4.2l.9.9M12.8 4.2l-.9.9',
        stroke: SUN_YELLOW,
        strokeWidth: 1.7,
      },
      { d: catCloudPath(3, 4.6, 0.8), fill: WHITE },
    ],
    mono: 'M12 2v1.5M4.8 4.8l1 1M2 12h1.5M9.5 5.5a3.5 3.5 0 0 1 5.6 2.4M8 19h9a3.5 3.5 0 0 0 .3-7 4.7 4.7 0 0 0-8.9-.2A3.6 3.6 0 0 0 8 19zM9.4 11.7l.7-2.4 1.7 1.4M14.2 10.2l1.5-1.5.6 2.4',
  },
  cloudy: {
    color: [{ d: catCloudPath(0, 2, 1), fill: WHITE }],
    mono: 'M7 18h10a4 4 0 0 0 .4-8 5.4 5.4 0 0 0-10.2-.2A4.1 4.1 0 0 0 7 18zM8.6 9.9l.8-2.9 2 1.7M14.2 8.1l1.8-1.8.7 2.8',
  },
  fog: {
    color: [
      { d: catCloudPath(0, -2.5, 1), fill: WHITE },
      { d: 'M4 18h12M7 21h13', stroke: WHITE, strokeWidth: 1.9 },
    ],
    mono: 'M7 12h10a4 4 0 0 0 .4-8 5.4 5.4 0 0 0-10.2-.2A4.1 4.1 0 0 0 7 12zM8.6 3.9l.8-2.9 2 1.7M4 15.5h12M7 18.5h13M5 21.5h9',
  },
  wind: {
    color: [
      { d: 'M3 9h11a3 3 0 1 0-3-3M3 14h15a3 3 0 1 1-3 3M3 19h7', stroke: WHITE, strokeWidth: 1.9 },
    ],
    mono: 'M3 9h11a3 3 0 1 0-3-3M3 14h15a3 3 0 1 1-3 3M3 19h7',
  },
  rain: {
    color: [
      { d: catCloudPath(0, -1, 1), fill: WHITE },
      {
        d: 'M8.6 18.4l-1 2.8M12.6 18.4l-1 2.8M16.6 18.4l-1 2.8',
        stroke: RAIN_BLUE,
        strokeWidth: 2,
      },
    ],
    mono: `${MONO_RAIN_CLOUD}M8.5 17l-1 3M12.5 17l-1 3M16.5 17l-1 3`,
  },
  thunder: {
    color: [
      { d: catCloudPath(0, -1.5, 1), fill: WHITE },
      { d: 'M13.2 14.2l-3.4 4.8h2.8l-1.4 3.8 4.2-5.6h-2.8l1.8-3z', fill: SUN_YELLOW },
    ],
    mono: `${MONO_RAIN_CLOUD}M12.5 14l-2 3.5h3l-2 3.5`,
  },
  snow: {
    color: [
      { d: catCloudPath(0, -1.5, 1), fill: WHITE },
      {
        d: circlePath(8.2, 19.4, 1.15) + circlePath(12, 21.4, 1.15) + circlePath(15.8, 19.4, 1.15),
        fill: WHITE,
      },
    ],
    mono: `${MONO_RAIN_CLOUD}M8 17.5v2.5M6.8 18.75h2.4M12 17.5v2.5M10.8 18.75h2.4M16 17.5v2.5M14.8 18.75h2.4`,
  },
  sunrise: {
    color: [
      { d: HORIZON_SUN, fill: SUNSET_ORANGE },
      { d: SUNRISE_ARROW, stroke: WHITE, strokeWidth: 1.8 },
    ],
    mono: `${HORIZON_SUN}${SUNRISE_ARROW}`,
  },
  sunset: {
    color: [
      { d: HORIZON_SUN, fill: SUNSET_ORANGE },
      { d: SUNSET_ARROW, stroke: WHITE, strokeWidth: 1.8 },
    ],
    mono: `${HORIZON_SUN}${SUNSET_ARROW}`,
  },
  warning: {
    color: [
      { d: WARNING_TRIANGLE, fill: ALERT_GLYPH_COLORS.triangle },
      { d: WARNING_MARK, stroke: ALERT_GLYPH_COLORS.mark, strokeWidth: 2.2 },
    ],
    mono: `${WARNING_TRIANGLE}${WARNING_MARK}`,
  },
} satisfies Record<string, Glyph>;

/** 카드 제목 옆 단색 아이콘(시안 카드 아이콘). 위치 표시만 채움형이다. */
const CARD_GLYPHS = {
  briefing: { d: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
  sunMoon: { d: 'M3 18h18M7 18a5 5 0 0 1 10 0M12 9V5M5.6 11.6l-1.4-1.4M18.4 11.6l1.4-1.4' },
  air: { d: 'M3 8h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 18h7' },
  thermo: { d: 'M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z' },
  uv: { d: 'M12 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2' },
  wind: { d: 'M3 9h11a3 3 0 1 0-3-3M3 14h15a3 3 0 1 1-3 3M3 19h7' },
  drop: { d: 'M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z' },
  humidity: { d: 'M7 14a5 5 0 0 0 10 0c0-3-5-9-5-9s-5 6-5 9z' },
  eye: { d: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6' },
  gauge: { d: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 12l4-3' },
  cloud: { d: 'M7 18h10a4 4 0 0 0 .4-8 5.4 5.4 0 0 0-10.2-.2A4.1 4.1 0 0 0 7 18z' },
  location: { d: 'M21 3L3 10.5l7.5 2 2 7.5z', isFilled: true },
} satisfies Record<string, { d: string; isFilled?: boolean }>;

export type WeatherCardGlyph = keyof typeof CARD_GLYPHS;

type GlyphName = keyof typeof GLYPHS;

type ConditionIcon =
  | 'clear'
  | 'partlyCloudy'
  | 'cloudy'
  | 'fog'
  | 'wind'
  | 'rain'
  | 'thunder'
  | 'snow';

const CONDITION_ICONS = {
  CLEAR: 'clear',
  MOSTLY_CLEAR: 'clear',
  HOT: 'clear',
  PARTLY_CLOUDY: 'partlyCloudy',
  MOSTLY_CLOUDY: 'partlyCloudy',
  CLOUDY: 'cloudy',
  FRIGID: 'cloudy',
  FOGGY: 'fog',
  HAZY: 'fog',
  WINDY: 'wind',
  DRIZZLE: 'rain',
  RAIN: 'rain',
  HEAVY_RAIN: 'rain',
  THUNDERSTORMS: 'thunder',
  SLEET: 'snow',
  SNOW: 'snow',
  HEAVY_SNOW: 'snow',
  HAIL: 'snow',
} satisfies Record<WeatherCondition, ConditionIcon>;

/** 밤에는 해 대신 달을 그린다. 구름 조금 낀 밤도 하늘이 대체로 열려 있어 달로 보여 준다. */
function toGlyphName({
  condition,
  isDaylight,
}: {
  condition: WeatherCondition;
  isDaylight: boolean;
}): GlyphName {
  return match([CONDITION_ICONS[condition], isDaylight] as const)
    .with(['clear', true], () => 'sun' as const)
    .with(['partlyCloudy', true], () => 'partlyCloudy' as const)
    .with(['clear', false], ['partlyCloudy', false], () => 'moon' as const)
    .with(
      [P.union('cloudy', 'fog', 'wind', 'rain', 'thunder', 'snow'), P.boolean],
      ([icon]) => icon,
    )
    .exhaustive();
}

type WeatherIconVariant = 'color' | 'mono';

interface GlyphIconProps extends Omit<
  ComponentProps<typeof StyledSvg>,
  'color' | 'viewBox' | 'children'
> {
  /** color는 하늘 카드 위 채움형(기본), mono는 테마 표면 위 colorClassName 단색 선형이다. */
  variant?: WeatherIconVariant;
}

interface WeatherIconProps extends GlyphIconProps {
  condition: WeatherCondition;
  isDaylight: boolean;
}

/** 상태 이름은 옆 글자가 읽어 주므로 보조 기술에서 숨기고, 움직임은 배경 장면이 맡아 정지 아이콘이다 */
export function WeatherIcon({ condition, isDaylight, ...props }: WeatherIconProps) {
  return <GlyphIcon glyph={GLYPHS[toGlyphName({ condition, isDaylight })]} {...props} />;
}

WeatherIcon.Sunrise = function Sunrise(props: GlyphIconProps) {
  return <GlyphIcon glyph={GLYPHS.sunrise} {...props} />;
};

WeatherIcon.Sunset = function Sunset(props: GlyphIconProps) {
  return <GlyphIcon glyph={GLYPHS.sunset} {...props} />;
};

WeatherIcon.Warning = function Warning(props: GlyphIconProps) {
  return <GlyphIcon glyph={GLYPHS.warning} {...props} />;
};

interface CardIconProps extends Omit<
  ComponentProps<typeof StyledSvg>,
  'color' | 'viewBox' | 'children' | 'width' | 'height'
> {
  glyph: WeatherCardGlyph;
  /** 앱 글자 크기 배율을 곱하기 전 크기 */
  size?: number;
}

/** 카드 제목·작은 표시 옆 아이콘. 제목 글자와 함께 앱 글자 크기를 따라 커진다. */
WeatherIcon.Card = function Card({
  glyph,
  size = CARD_ICON_SIZE,
  colorClassName = 'text-on-sky/[0.62]',
  ...props
}: CardIconProps) {
  const scaledSize = Math.round(size * useFontScaleRatio());
  const { d, isFilled = false }: { d: string; isFilled?: boolean } = CARD_GLYPHS[glyph];
  return (
    <StyledSvg
      width={scaledSize}
      height={scaledSize}
      viewBox="0 0 24 24"
      fill="none"
      colorClassName={colorClassName}
      accessible={false}
      importantForAccessibility="no"
      {...props}
    >
      <Path
        d={d}
        fill={isFilled ? 'currentColor' : 'none'}
        stroke={isFilled ? 'none' : 'currentColor'}
        strokeWidth={isFilled ? 0 : CARD_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </StyledSvg>
  );
};

function GlyphIcon({
  glyph,
  variant = 'color',
  width = GLYPH_ICON_SIZE,
  height = GLYPH_ICON_SIZE,
  colorClassName = 'text-on-sky',
  ...props
}: GlyphIconProps & { glyph: Glyph }) {
  // 단색은 부르는 쪽 색을 따르고, 색 글리프의 흰 면은 하늘 위 흰색으로 고정한다
  const glyphColorClassName = {
    mono: colorClassName,
    color: 'text-on-sky/[0.96]',
  } satisfies Record<WeatherIconVariant, string>;

  return (
    <StyledSvg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      colorClassName={glyphColorClassName[variant]}
      accessible={false}
      importantForAccessibility="no"
      {...props}
    >
      {variant === 'mono' ? (
        <Path
          d={glyph.mono}
          stroke="currentColor"
          strokeWidth={MONO_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        glyph.color.map((part) => (
          <Path
            key={part.d}
            d={part.d}
            fill={part.fill ?? 'none'}
            stroke={part.stroke ?? 'none'}
            strokeWidth={part.strokeWidth ?? 0}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))
      )}
    </StyledSvg>
  );
}
