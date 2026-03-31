/**
 * WGS84 위경도 → TM 중부원점 (GRS80) 좌표 변환
 *
 * 에어코리아 인근측정소 조회 API의 tmX, tmY 파라미터에 사용합니다.
 * EPSG:5181 (Korea 2000 / Central Belt) 좌표계 기준.
 *
 * @see https://www.data.go.kr/data/15073877/openapi.do (에어코리아 측정소 API)
 */

/** GRS80 타원체 상수 */
const GRS80 = {
	a: 6378137.0, // 장반경 (m)
	f: 1 / 298.257222101, // 편평률
} as const;

/** TM 중부원점 투영 파라미터 */
const TM_CENTRAL = {
	phi0: (38 * Math.PI) / 180, // 원점 위도 38°N
	lambda0: (127 * Math.PI) / 180, // 중앙 경선 127°E
	k0: 1.0, // 축척 계수
	x0: 200_000, // 가산 동향 (m)
	y0: 500_000, // 가산 북향 (m)
} as const;

export interface TmCoordinate {
	tmX: number;
	tmY: number;
}

/**
 * WGS84 위경도를 TM 중부원점 좌표로 변환합니다.
 *
 * @example convertToTm(37.5665, 126.978) // { tmX: ~198079, tmY: ~451847 }
 */
export function convertToTm(lat: number, lon: number): TmCoordinate {
	const { a, f } = GRS80;
	const b = a * (1 - f);
	const e2 = (a * a - b * b) / (a * a);
	const ep2 = (a * a - b * b) / (b * b);

	const phi = (lat * Math.PI) / 180;
	const lambda = (lon * Math.PI) / 180;

	const N = a / Math.sqrt(1 - e2 * Math.sin(phi) * Math.sin(phi));
	const T = Math.tan(phi) * Math.tan(phi);
	const C = ep2 * Math.cos(phi) * Math.cos(phi);
	const A = Math.cos(phi) * (lambda - TM_CENTRAL.lambda0);

	const e4 = e2 * e2;
	const e6 = e4 * e2;
	const M =
		a *
		((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * phi -
			((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * phi) +
			((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * phi) -
			((35 * e6) / 3072) * Math.sin(6 * phi));

	const M0 =
		a *
		((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * TM_CENTRAL.phi0 -
			((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) *
				Math.sin(2 * TM_CENTRAL.phi0) +
			((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * TM_CENTRAL.phi0) -
			((35 * e6) / 3072) * Math.sin(6 * TM_CENTRAL.phi0));

	const A2 = A * A;
	const A3 = A2 * A;
	const A4 = A3 * A;
	const A5 = A4 * A;
	const A6 = A5 * A;

	const tmX =
		TM_CENTRAL.x0 +
		TM_CENTRAL.k0 *
			N *
			(A +
				((1 - T + C) * A3) / 6 +
				((5 - 18 * T + T * T + 72 * C - 58 * ep2) * A5) / 120);

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

	return {
		tmX: Math.round(tmX * 10) / 10,
		tmY: Math.round(tmY * 10) / 10,
	};
}
