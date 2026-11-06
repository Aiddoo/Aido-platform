import { range, round } from 'es-toolkit';

import { toUnitPosition } from '../../domains/weather-report.model';

export interface DialPoint {
  x: number;
  y: number;
}

/** 다이얼은 120×120 viewBox의 가운데(60, 60)를 기준으로 그린다. */
const DIAL_CENTER = 60;
const TICK_OUTER_RADIUS = 54;
const MAJOR_TICK_INNER_RADIUS = 47;
const MINOR_TICK_INNER_RADIUS = 50;

function toDialPoint(degrees: number, radius: number): DialPoint {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: round(DIAL_CENTER + radius * Math.sin(radians), 2),
    y: round(DIAL_CENTER - radius * Math.cos(radians), 2),
  };
}

function toSegment(from: DialPoint, to: DialPoint): string {
  return `M${from.x} ${from.y}L${to.x} ${to.y}`;
}

function toTriangle(tip: DialPoint, left: DialPoint, right: DialPoint): string {
  return `M${tip.x} ${tip.y}L${left.x} ${left.y}L${right.x} ${right.y}z`;
}

export interface DialTicks {
  minorTicks: string;
  majorTicks: string;
}

/** from~to 각도를 step 간격으로 나누고 majorEvery번째마다 긴 눈금을 그린다. */
function toDialTicks(from: number, to: number, step: number, majorEvery: number): DialTicks {
  const count = Math.floor((to - from) / step) + 1;
  const ticks = range(count).map((index) => {
    const degrees = from + index * step;
    const isMajor = index % majorEvery === 0;
    const outer = toDialPoint(degrees, TICK_OUTER_RADIUS);
    const inner = toDialPoint(degrees, isMajor ? MAJOR_TICK_INNER_RADIUS : MINOR_TICK_INNER_RADIUS);
    return { isMajor, path: toSegment(outer, inner) };
  });
  return {
    minorTicks: ticks
      .filter((tick) => !tick.isMajor)
      .map((tick) => tick.path)
      .join(''),
    majorTicks: ticks
      .filter((tick) => tick.isMajor)
      .map((tick) => tick.path)
      .join(''),
  };
}

const CARDINAL_DIRECTIONS = ['n', 'e', 's', 'w'] as const;
type CardinalDirection = (typeof CARDINAL_DIRECTIONS)[number];

interface CompassNeedle {
  /** 바람이 불어오는 쪽 꼬리와 불어 가는 쪽 머리를 잇는 두 선분 */
  stroke: string;
  head: string;
  tail: DialPoint;
}

export interface CompassDial extends DialTicks {
  cardinals: { direction: CardinalDirection; position: DialPoint }[];
  needle: CompassNeedle | null;
}

const CARDINAL_LABEL_RADIUS = 37;

/**
 * 풍향(북=0도)은 바람이 불어오는 쪽이므로 꼬리를 그 방향에, 화살촉을 반대쪽(불어 가는 쪽)에 둔다.
 * 무풍처럼 방향이 없으면 바늘 없이 눈금만 그린다.
 */
export function toCompassDial(windDirection: number | null): CompassDial {
  const cardinals = CARDINAL_DIRECTIONS.map((direction, index) => ({
    direction,
    position: toDialPoint(index * 90, CARDINAL_LABEL_RADIUS),
  }));
  const ticks = toDialTicks(0, 355, 5, 6);
  if (windDirection == null) {
    return { ...ticks, cardinals, needle: null };
  }
  const from = windDirection;
  const to = windDirection + 180;
  const tail = toDialPoint(from, 44);
  return {
    ...ticks,
    cardinals,
    needle: {
      stroke:
        toSegment(tail, toDialPoint(from, 28)) +
        toSegment(toDialPoint(to, 28), toDialPoint(to, 38)),
      head: toTriangle(toDialPoint(to, 46), toDialPoint(to - 9, 38), toDialPoint(to + 9, 38)),
      tail,
    },
  };
}

export interface PressureGauge extends DialTicks {
  needle: string;
  head: string;
}

const PRESSURE_GAUGE_MIN_HPA = 980;
const PRESSURE_GAUGE_RANGE_HPA = 60;
const PRESSURE_GAUGE_SWEEP = 270;
const PRESSURE_GAUGE_START = -PRESSURE_GAUGE_SWEEP / 2;

/** 아래가 트인 270도 눈금판에 980~1040hPa를 펼치고, 범위를 넘는 값은 양 끝에 둔다. */
export function toPressureGauge(pressure: number): PressureGauge {
  const ratio = toUnitPosition(
    pressure,
    PRESSURE_GAUGE_MIN_HPA,
    PRESSURE_GAUGE_MIN_HPA + PRESSURE_GAUGE_RANGE_HPA,
  );
  const degrees = PRESSURE_GAUGE_START + ratio * PRESSURE_GAUGE_SWEEP;
  return {
    ...toDialTicks(PRESSURE_GAUGE_START, -PRESSURE_GAUGE_START, 7.5, 4),
    needle: toSegment(toDialPoint(degrees, 56), toDialPoint(degrees, 42)),
    head: toTriangle(
      toDialPoint(degrees, 40),
      toDialPoint(degrees - 6, 33),
      toDialPoint(degrees + 6, 33),
    ),
  };
}

/** 눈금판 아래 트인 곳 양쪽에 저·고를 적는다. */
export const PRESSURE_GAUGE_LABELS = {
  low: { x: 30, y: 98 },
  high: { x: 90, y: 98 },
} as const satisfies Record<string, DialPoint>;
