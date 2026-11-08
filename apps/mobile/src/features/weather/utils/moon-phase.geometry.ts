import type { WeatherMoonPhase } from '@aido/api/vocabulary';
import { clamp, round } from 'es-toolkit';

export const MOON_PHASE_CYCLE = {
  NEW: 0,
  WAXING_CRESCENT: 0.125,
  FIRST_QUARTER: 0.25,
  WAXING_GIBBOUS: 0.375,
  FULL: 0.5,
  WANING_GIBBOUS: 0.625,
  THIRD_QUARTER: 0.75,
  WANING_CRESCENT: 0.875,
} as const satisfies Record<WeatherMoonPhase, number>;

export const MOON_VIEWBOX = 48;
export const MOON_CENTER = 24;
export const MOON_RADIUS = 18;
const MOON_PENUMBRA = 0.12;

export interface MoonGeometry {
  illumination: number;
  litPath: string | null;
  penumbraPath: string | null;
  rotation: 0 | 180;
}

function toLitPath(terminator: number, { isWaxing }: { isWaxing: boolean }): string {
  const clamped = clamp(terminator, -1, 1);
  const terminatorRx = round(MOON_RADIUS * Math.abs(clamped), 2);
  const isGibbous = clamped > 0;
  const outerSweep = isWaxing ? 1 : 0;
  const innerSweep = isWaxing === isGibbous ? 1 : 0;
  return `M${MOON_CENTER} ${MOON_CENTER - MOON_RADIUS}a${MOON_RADIUS} ${MOON_RADIUS} 0 0 ${outerSweep} 0 ${MOON_RADIUS * 2}a${terminatorRx} ${MOON_RADIUS} 0 0 ${innerSweep} 0 ${-MOON_RADIUS * 2}z`;
}

export function toMoonGeometry(phase: WeatherMoonPhase, latitude: number): MoonGeometry {
  const cycle = MOON_PHASE_CYCLE[phase];
  const terminator = -Math.cos(2 * Math.PI * cycle);
  const isWaxing = cycle <= 0.5;
  const isNew = phase === 'NEW';
  return {
    illumination: round((1 + terminator) / 2, 3),
    litPath: isNew ? null : toLitPath(terminator, { isWaxing }),
    penumbraPath: isNew ? null : toLitPath(terminator + MOON_PENUMBRA, { isWaxing }),
    rotation: latitude < 0 ? 180 : 0,
  };
}
