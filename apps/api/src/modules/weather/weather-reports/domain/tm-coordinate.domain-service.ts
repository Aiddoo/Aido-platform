import { round } from "es-toolkit";

import type { Coordinate } from "../../shared/domain/coordinate.vo.js";

// 대기질 측정소 조회가 받는 좌표계다: TM 중부원점(EPSG:5181, GRS80). 원점 38°N·127°E, 가산 200,000·500,000m
const GRS80 = {
  a: 6_378_137.0,
  f: 1 / 298.257222101,
} as const;

const TM_CENTRAL = {
  phi0: (38 * Math.PI) / 180,
  lambda0: (127 * Math.PI) / 180,
  k0: 1.0,
  x0: 200_000,
  y0: 500_000,
} as const;

export interface TmCoordinate {
  readonly tmX: number;
  readonly tmY: number;
}

function meridianArc(phi: number, a: number, e2: number): number {
  const e4 = e2 * e2;
  const e6 = e4 * e2;
  return (
    a *
    ((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * phi -
      ((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * phi) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * phi) -
      ((35 * e6) / 3072) * Math.sin(6 * phi))
  );
}

/** WGS84 좌표를 TM 중부원점 좌표(m, 소수 한 자리)로 투영한다. */
export function toTmCoordinate(coordinate: Coordinate): TmCoordinate {
  const { a, f } = GRS80;
  const b = a * (1 - f);
  const e2 = (a * a - b * b) / (a * a);
  const ep2 = (a * a - b * b) / (b * b);

  const phi = (coordinate.latitude * Math.PI) / 180;
  const lambda = (coordinate.longitude * Math.PI) / 180;

  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) * Math.sin(phi));
  const T = Math.tan(phi) * Math.tan(phi);
  const C = ep2 * Math.cos(phi) * Math.cos(phi);
  const A = Math.cos(phi) * (lambda - TM_CENTRAL.lambda0);

  const M = meridianArc(phi, a, e2);
  const M0 = meridianArc(TM_CENTRAL.phi0, a, e2);

  const A2 = A * A;
  const A3 = A2 * A;
  const A4 = A3 * A;
  const A5 = A4 * A;
  const A6 = A5 * A;

  const tmX =
    TM_CENTRAL.x0 +
    TM_CENTRAL.k0 *
      N *
      (A + ((1 - T + C) * A3) / 6 + ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * A5) / 120);

  const tmY =
    TM_CENTRAL.y0 +
    TM_CENTRAL.k0 *
      (M -
        M0 +
        N *
          Math.tan(phi) *
          (A2 / 2 +
            ((5 - T + 9 * C + 4 * C * C) * A4) / 24 +
            ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * A6) / 720));

  return { tmX: round(tmX, 1), tmY: round(tmY, 1) };
}
