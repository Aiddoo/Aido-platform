import { useIsAnimationActive } from '@src/shared/hooks/use-is-animation-active';
import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { Box } from '@src/shared/ui';
import Animated, { css } from 'react-native-reanimated';
import Svg, { Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { SUN_COLORS } from '../../constants/weather-colors.constants';
import { SUN_ARC_HORIZON_Y, SUN_ARC_PATHS, SUN_ARC_VIEWBOX } from '../../utils/sun-arc.geometry';
import type { DialPoint } from '../../utils/weather-dial.geometry';

const SUN_DOT_SIZE = 14;
const NIGHT_SUN_DOT_SIZE = 10;
const SUN_DOT_RING = 2;
const NIGHT_SUN_OPACITY = 0.45;
const PULSE_DURATION_MS = 2600;
const PULSE_MAX_SCALE = 2.6;
const PULSE_START_OPACITY = 0.7;

const SUN_PULSE = css.keyframes({
  from: { opacity: PULSE_START_OPACITY, transform: [{ scale: 1 }] },
  to: { opacity: 0, transform: [{ scale: PULSE_MAX_SCALE }] },
});

const SUN_PULSE_STYLE = {
  animationName: SUN_PULSE,
  animationDuration: PULSE_DURATION_MS,
  animationTimingFunction: 'ease-out',
  animationIterationCount: 'infinite',
} as const;

/** viewBox를 부모 폭에 맞춰 늘리고, 해 점은 늘어나도 둥글도록 퍼센트 자리에 따로 올린다. */
export function WeatherSunArc({
  position,
  isNight,
}: {
  position: DialPoint | null;
  /** 해가 지평선 아래면 점을 작고 흐리게 그리고 빛 퍼짐을 끈다. */
  isNight: boolean;
}) {
  const dotSize = isNight ? NIGHT_SUN_DOT_SIZE : SUN_DOT_SIZE;
  const dayColor = useResolvedColor('text-on-sky/85');
  const nightColor = useResolvedColor('text-on-sky/28');
  const horizonColor = useResolvedColor('text-on-sky/35');

  return (
    <Box className="relative" style={{ height: SUN_ARC_VIEWBOX.height }}>
      <Svg
        width="100%"
        height={SUN_ARC_VIEWBOX.height}
        viewBox={`0 0 ${SUN_ARC_VIEWBOX.width} ${SUN_ARC_VIEWBOX.height}`}
        preserveAspectRatio="none"
        accessible={false}
      >
        <Defs>
          <LinearGradient id="weatherSunDay" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={SUN_COLORS.glow} stopOpacity={0.35} />
            <Stop offset="1" stopColor={SUN_COLORS.glow} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={SUN_ARC_PATHS.dayFill} fill="url(#weatherSunDay)" />
        <Path
          d={SUN_ARC_PATHS.nightBefore}
          fill="none"
          stroke={nightColor}
          strokeWidth={2}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <Path
          d={SUN_ARC_PATHS.day}
          fill="none"
          stroke={dayColor}
          strokeWidth={2}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <Path
          d={SUN_ARC_PATHS.nightAfter}
          fill="none"
          stroke={nightColor}
          strokeWidth={2}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <Line
          x1={0}
          x2={SUN_ARC_VIEWBOX.width}
          y1={SUN_ARC_HORIZON_Y}
          y2={SUN_ARC_HORIZON_Y}
          stroke={horizonColor}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </Svg>
      {position != null && (
        <Box
          className="absolute"
          style={{
            left: `${(position.x / SUN_ARC_VIEWBOX.width) * 100}%`,
            top: position.y,
            width: dotSize,
            height: dotSize,
            marginLeft: -dotSize / 2,
            marginTop: -dotSize / 2,
            opacity: isNight ? NIGHT_SUN_OPACITY : 1,
          }}
        >
          {!isNight && <SunPulse />}
          <Box
            className="absolute inset-0 rounded-full bg-on-sky"
            style={{ borderWidth: SUN_DOT_RING, borderColor: SUN_COLORS.ring }}
          />
        </Box>
      )}
    </Box>
  );
}

/** 시안 wxPulse: 해 점에서 퍼지는 빛. 동작 줄이기·화면 밖·앱 비활성에서는 멈춘다. */
function SunPulse() {
  const isAnimating = useIsAnimationActive();

  return (
    <Animated.View
      pointerEvents="none"
      className="absolute inset-0 rounded-full"
      style={[{ backgroundColor: SUN_COLORS.glow }, isAnimating ? SUN_PULSE_STYLE : { opacity: 0 }]}
    />
  );
}
