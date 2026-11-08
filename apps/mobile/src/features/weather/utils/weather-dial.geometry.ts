import { range, round } from 'es-toolkit';

import { toUnitPosition } from './weather-bar.geometry';

export interface DialPoint {
  x: number;
  y: number;
}

/** 다이얼은 120×120 viewBox의 가운데(60, 60)를 기준으로 그린다. */
export const DIAL_VIEWBOX_SIZE = 120;
export const DIAL_CENTER = DIAL_VIEWBOX_SIZE / 2;
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
function toDialTicks({
  from,
  to,
  step,
  majorEvery,
}: {
  from: number;
  to: number;
  step: number;
  majorEvery: number;
}): DialTicks {
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
/** 나침반 눈금은 5도 간격, 30도마다 긴 눈금이다. */
const COMPASS_TICKS = { from: 0, to: 355, step: 5, majorEvery: 6 } as const;
/** 바늘 꼬리와 머리, 화살촉이 놓이는 반지름 */
const NEEDLE_TAIL_RADIUS = 44;
const NEEDLE_STROKE_INNER_RADIUS = 28;
const NEEDLE_STROKE_OUTER_RADIUS = 38;
const NEEDLE_TIP_RADIUS = 46;
const NEEDLE_HEAD_HALF_ANGLE = 9;

/**
 * 풍향(북=0도)은 바람이 불어오는 쪽이므로 꼬리를 그 방향에, 화살촉을 반대쪽(불어 가는 쪽)에 둔다.
 * 무풍처럼 방향이 없으면 바늘 없이 눈금만 그린다.
 */
export function toCompassDial(windDirection: number | null): CompassDial {
  const cardinals = CARDINAL_DIRECTIONS.map((direction, index) => ({
    direction,
    position: toDialPoint(index * 90, CARDINAL_LABEL_RADIUS),
  }));
  const ticks = toDialTicks(COMPASS_TICKS);
  if (windDirection == null) {
    return { ...ticks, cardinals, needle: null };
  }
  const from = windDirection;
  const to = windDirection + 180;
  const tail = toDialPoint(from, NEEDLE_TAIL_RADIUS);
  return {
    ...ticks,
    cardinals,
    needle: {
      stroke:
        toSegment(tail, toDialPoint(from, NEEDLE_STROKE_INNER_RADIUS)) +
        toSegment(
          toDialPoint(to, NEEDLE_STROKE_INNER_RADIUS),
          toDialPoint(to, NEEDLE_STROKE_OUTER_RADIUS),
        ),
      head: toTriangle(
        toDialPoint(to, NEEDLE_TIP_RADIUS),
        toDialPoint(to - NEEDLE_HEAD_HALF_ANGLE, NEEDLE_STROKE_OUTER_RADIUS),
        toDialPoint(to + NEEDLE_HEAD_HALF_ANGLE, NEEDLE_STROKE_OUTER_RADIUS),
      ),
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
/** 기압 눈금은 7.5도 간격, 4번째마다 긴 눈금이다. */
const PRESSURE_TICK_STEP = 7.5;
const PRESSURE_TICK_MAJOR_EVERY = 4;
/** 기압 바늘 선분과 화살촉이 놓이는 반지름 */
const GAUGE_NEEDLE_OUTER_RADIUS = 56;
const GAUGE_NEEDLE_INNER_RADIUS = 42;
const GAUGE_HEAD_TIP_RADIUS = 40;
const GAUGE_HEAD_BASE_RADIUS = 33;
const GAUGE_HEAD_HALF_ANGLE = 6;

/** 아래가 트인 270도 눈금판에 980~1040hPa를 펼치고, 범위를 넘는 값은 양 끝에 둔다. */
export function toPressureGauge(pressure: number): PressureGauge {
  const ratio = toUnitPosition(
    pressure,
    PRESSURE_GAUGE_MIN_HPA,
    PRESSURE_GAUGE_MIN_HPA + PRESSURE_GAUGE_RANGE_HPA,
  );
  const degrees = PRESSURE_GAUGE_START + ratio * PRESSURE_GAUGE_SWEEP;
  return {
    ...toDialTicks({
      from: PRESSURE_GAUGE_START,
      to: -PRESSURE_GAUGE_START,
      step: PRESSURE_TICK_STEP,
      majorEvery: PRESSURE_TICK_MAJOR_EVERY,
    }),
    needle: toSegment(
      toDialPoint(degrees, GAUGE_NEEDLE_OUTER_RADIUS),
      toDialPoint(degrees, GAUGE_NEEDLE_INNER_RADIUS),
    ),
    head: toTriangle(
      toDialPoint(degrees, GAUGE_HEAD_TIP_RADIUS),
      toDialPoint(degrees - GAUGE_HEAD_HALF_ANGLE, GAUGE_HEAD_BASE_RADIUS),
      toDialPoint(degrees + GAUGE_HEAD_HALF_ANGLE, GAUGE_HEAD_BASE_RADIUS),
    ),
  };
}

/** 눈금판 아래 트인 곳 양쪽에 저·고를 적는다. */
export const PRESSURE_GAUGE_LABELS = {
  low: { x: 30, y: 98 },
  high: { x: 90, y: 98 },
} as const satisfies Record<string, DialPoint>;
