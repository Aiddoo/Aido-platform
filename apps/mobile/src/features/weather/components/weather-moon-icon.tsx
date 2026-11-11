import type { WeatherMoonPhase } from '@aido/api/vocabulary';
import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { useId } from 'react';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

import {
  MOON_CENTER,
  MOON_RADIUS,
  MOON_VIEWBOX,
  toMoonGeometry,
} from '../utils/moon-phase.geometry';

const MOON_ICON_SIZE = 46;
/** 북반구에서 본 달의 바다 자리(반지름 비율): 폭풍의 대양·비·맑음·고요·위난·풍요·구름의 바다 순서 */
const MOON_MARIA = [
  { cx: -0.5, cy: -0.02, rx: 0.26, ry: 0.42, opacity: 0.2 },
  { cx: -0.24, cy: -0.4, rx: 0.24, ry: 0.19, opacity: 0.26 },
  { cx: 0.16, cy: -0.36, rx: 0.14, ry: 0.13, opacity: 0.24 },
  { cx: 0.3, cy: -0.08, rx: 0.17, ry: 0.14, opacity: 0.24 },
  { cx: 0.64, cy: -0.3, rx: 0.1, ry: 0.08, opacity: 0.28 },
  { cx: 0.52, cy: 0.16, rx: 0.09, ry: 0.13, opacity: 0.2 },
  { cx: -0.16, cy: 0.34, rx: 0.16, ry: 0.11, opacity: 0.18 },
] as const;
/** 티코 크레이터처럼 밝게 빛나는 자리 */
const MOON_BRIGHT_CRATER = { cx: -0.1, cy: 0.72, r: 0.06 } as const;

/** 어두운 면은 지구 반사광으로 칠하고, 반그림자 면을 한 겹 더 깔아 명암 경계를 부드럽게 넘긴다 */
export function WeatherMoonIcon({
  phase,
  latitude,
}: {
  phase: WeatherMoonPhase;
  latitude: number;
}) {
  const id = useId();
  const { illumination, litPath, penumbraPath, rotation } = toMoonGeometry(phase, latitude);
  const ids = {
    glow: `${id}glow`,
    dark: `${id}dark`,
    lit: `${id}lit`,
    disc: `${id}disc`,
    litClip: `${id}litClip`,
  };
  const toUnit = (ratio: number) => MOON_CENTER + ratio * MOON_RADIUS;
  const outlineColor = useResolvedColor('text-on-sky/10');
  const craterColor = useResolvedColor('text-on-sky');

  return (
    <Svg
      width={MOON_ICON_SIZE}
      height={MOON_ICON_SIZE}
      viewBox={`0 0 ${MOON_VIEWBOX} ${MOON_VIEWBOX}`}
      accessible={false}
    >
      <Defs>
        <RadialGradient
          id={ids.glow}
          cx={MOON_CENTER}
          cy={MOON_CENTER}
          r={MOON_CENTER}
          gradientUnits="userSpaceOnUse"
        >
          <Stop
            offset={MOON_RADIUS / MOON_CENTER}
            stopColor="#FFF6DA"
            stopOpacity={0.22 * illumination}
          />
          <Stop offset={1} stopColor="#FFF6DA" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient
          id={ids.dark}
          cx={MOON_CENTER - 3}
          cy={MOON_CENTER - 4}
          r={MOON_RADIUS + 4}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset={0} stopColor="#3A4258" />
          <Stop offset={1} stopColor="#1E2333" />
        </RadialGradient>
        <RadialGradient
          id={ids.lit}
          cx={MOON_CENTER}
          cy={MOON_CENTER}
          r={MOON_RADIUS}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset={0} stopColor="#FFFBEC" />
          <Stop offset={0.72} stopColor="#F2EBD3" />
          <Stop offset={1} stopColor="#CEC5AB" />
        </RadialGradient>
        <ClipPath id={ids.disc}>
          <Circle cx={MOON_CENTER} cy={MOON_CENTER} r={MOON_RADIUS} />
        </ClipPath>
        {litPath != null && (
          <ClipPath id={ids.litClip}>
            <Path d={litPath} />
          </ClipPath>
        )}
      </Defs>
      <Circle cx={MOON_CENTER} cy={MOON_CENTER} r={MOON_CENTER} fill={`url(#${ids.glow})`} />
      <G transform={`rotate(${rotation} ${MOON_CENTER} ${MOON_CENTER})`}>
        <Circle cx={MOON_CENTER} cy={MOON_CENTER} r={MOON_RADIUS} fill={`url(#${ids.dark})`} />
        <G clipPath={`url(#${ids.disc})`}>
          {MOON_MARIA.map(({ cx, cy, rx, ry }) => (
            <Ellipse
              key={`${cx}${cy}`}
              cx={toUnit(cx)}
              cy={toUnit(cy)}
              rx={rx * MOON_RADIUS}
              ry={ry * MOON_RADIUS}
              fill="#000000"
              opacity={0.14}
            />
          ))}
        </G>
        {penumbraPath != null && <Path d={penumbraPath} fill={`url(#${ids.lit})`} opacity={0.32} />}
        {litPath != null && (
          <>
            <Path d={litPath} fill={`url(#${ids.lit})`} />
            <G clipPath={`url(#${ids.litClip})`}>
              {MOON_MARIA.map(({ cx, cy, rx, ry, opacity }) => (
                <Ellipse
                  key={`${cx}${cy}`}
                  cx={toUnit(cx)}
                  cy={toUnit(cy)}
                  rx={rx * MOON_RADIUS}
                  ry={ry * MOON_RADIUS}
                  fill="#7C7563"
                  opacity={opacity}
                />
              ))}
              <Circle
                cx={toUnit(MOON_BRIGHT_CRATER.cx)}
                cy={toUnit(MOON_BRIGHT_CRATER.cy)}
                r={MOON_BRIGHT_CRATER.r * MOON_RADIUS}
                fill={craterColor}
                opacity={0.5}
              />
            </G>
          </>
        )}
        <Circle
          cx={MOON_CENTER}
          cy={MOON_CENTER}
          r={MOON_RADIUS - 0.25}
          fill="none"
          stroke={outlineColor}
          strokeWidth={0.5}
        />
      </G>
    </Svg>
  );
}
