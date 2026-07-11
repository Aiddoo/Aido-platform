/**
 * WGS84 위경도 → 기상청 격자(nx, ny) 변환
 *
 * Lambert Conformal Conic Projection (LCC)
 * 기상청 단기예보 격자 체계 기준
 *
 * @see https://www.data.go.kr/data/15084084/openapi.do (격자 변환 참고)
 */

const GRID = {
	RE: 6371.00877, // 지구 반경 (km)
	GRID: 5.0, // 격자 간격 (km)
	SLAT1: 30.0, // 투영 위도 1 (degree)
	SLAT2: 60.0, // 투영 위도 2 (degree)
	OLON: 126.0, // 기준점 경도 (degree)
	OLAT: 38.0, // 기준점 위도 (degree)
	XO: 43, // 기준점 X 좌표 (격자)
	YO: 136, // 기준점 Y 좌표 (격자)
} as const;

const DEG_TO_RAD = Math.PI / 180.0;

export function convertToGrid(
	lat: number,
	lon: number,
): { nx: number; ny: number } {
	const re = GRID.RE / GRID.GRID;
	const slat1 = GRID.SLAT1 * DEG_TO_RAD;
	const slat2 = GRID.SLAT2 * DEG_TO_RAD;
	const olon = GRID.OLON * DEG_TO_RAD;
	const olat = GRID.OLAT * DEG_TO_RAD;

	let sn =
		Math.tan(Math.PI * 0.25 + slat2 * 0.5) /
		Math.tan(Math.PI * 0.25 + slat1 * 0.5);
	sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);

	let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
	sf = (sf ** sn * Math.cos(slat1)) / sn;

	let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
	ro = (re * sf) / ro ** sn;

	let ra = Math.tan(Math.PI * 0.25 + lat * DEG_TO_RAD * 0.5);
	ra = (re * sf) / ra ** sn;

	let theta = lon * DEG_TO_RAD - olon;
	if (theta > Math.PI) theta -= 2.0 * Math.PI;
	if (theta < -Math.PI) theta += 2.0 * Math.PI;
	theta *= sn;

	const nx = Math.floor(ra * Math.sin(theta) + GRID.XO + 0.5);
	const ny = Math.floor(ro - ra * Math.cos(theta) + GRID.YO + 0.5);

	return { nx, ny };
}
