import type { WeatherMoonPhase } from '@aido/api';
import { clamp, round } from 'es-toolkit';

/** 위상을 한 바퀴 0~1로 둔 값. 0은 삭, 0.5는 보름이다. */
const MOON_PHASE_CYCLE = {
  NEW: 0,
  WAXING_CRESCENT: 0.125,
  FIRST_QUARTER: 0.25,
  WAXING_GIBBOUS: 0.375,
  FULL: 0.5,
  WANING_GIBBOUS: 0.625,
  THIRD_QUARTER: 0.75,
  WANING_CRESCENT: 0.875,
} as const satisfies Record<WeatherMoonPhase, number>;

/** 달 아이콘은 48×48 viewBox 가운데에 그리고, 바깥 여백에는 은은한 빛무리를 둔다. */
export const MOON_VIEWBOX = 48;
export const MOON_CENTER = 24;
export const MOON_RADIUS = 18;
/** 명암 경계를 부드럽게 보이도록 반그림자 면을 밝은 면보다 이만큼(반지름 비율) 넓힌다. */
const MOON_PENUMBRA = 0.12;

export interface MoonGeometry {
  /** 밝게 보이는 면적 비율(0~1) */
  illumination: number;
  /** 명암 경계 반타원의 가로 반지름 */
  terminatorRx: number;
  /** 북반구에서 본 밝은 면. 삭이면 null이다. */
  litPath: string | null;
  /** 명암 경계 바깥쪽으로 조금 넓힌 반그림자 면 */
  penumbraPath: string | null;
  /** 남반구에서는 달이 위아래·좌우가 뒤집혀 보이므로 180도 돌린다. */
  rotation: 0 | 180;
}

/**
 * terminator는 -1(밝은 면 없음)~1(보름) 사이 명암 경계 자리다. 0이면 반달로 경계가 곧다.
 * 바깥 반원과 경계 반타원을 이어 밝은 면을 그린다.
 */
function toLitPath(terminator: number, isWaxing: boolean): string {
  const clamped = clamp(terminator, -1, 1);
  const terminatorRx = round(MOON_RADIUS * Math.abs(clamped), 2);
  const isGibbous = clamped > 0;
  const outerSweep = isWaxing ? 1 : 0;
  const innerSweep = isWaxing === isGibbous ? 1 : 0;
  return `M${MOON_CENTER} ${MOON_CENTER - MOON_RADIUS}a${MOON_RADIUS} ${MOON_RADIUS} 0 0 ${outerSweep} 0 ${MOON_RADIUS * 2}a${terminatorRx} ${MOON_RADIUS} 0 0 ${innerSweep} 0 ${-MOON_RADIUS * 2}z`;
}

/** 위상과 위도로 사실적인 달을 그릴 밝은 면·반그림자·밝기를 구한다. 차오를 때 북반구에서는 오른쪽이 밝다. */
export function toMoonGeometry(phase: WeatherMoonPhase, latitude: number): MoonGeometry {
  const cycle = MOON_PHASE_CYCLE[phase];
  const terminator = -Math.cos(2 * Math.PI * cycle);
  const isWaxing = cycle <= 0.5;
  const isNew = phase === 'NEW';
  return {
    illumination: round((1 + terminator) / 2, 3),
    terminatorRx: round(MOON_RADIUS * Math.abs(terminator), 2),
    litPath: isNew ? null : toLitPath(terminator, isWaxing),
    penumbraPath: isNew ? null : toLitPath(terminator + MOON_PENUMBRA, isWaxing),
    rotation: latitude < 0 ? 180 : 0,
  };
}
