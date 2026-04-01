/**
 * 위경도 → 기상청 생활기상지수 행정구역코드(areaNo) 매핑
 *
 * 17개 시도 단위. 좌표가 겹치는 지역은 위에서 먼저 매칭된 것이 우선.
 * 경계 좌표는 각 시도의 대략적 행정경계 bounding-box 기준.
 */

interface RegionEntry {
	code: string;
	name: string;
	latMin: number;
	latMax: number;
	lonMin: number;
	lonMax: number;
}

const REGIONS: RegionEntry[] = [
	// 특별시·광역시 (범위가 좁으므로 먼저 매칭)
	{
		code: "1100000000",
		name: "서울",
		latMin: 37.42,
		latMax: 37.7,
		lonMin: 126.76,
		lonMax: 127.18,
	},
	{
		code: "2300000000",
		name: "인천",
		latMin: 37.35,
		latMax: 37.6,
		lonMin: 126.35,
		lonMax: 126.78,
	},
	{
		code: "2600000000",
		name: "부산",
		latMin: 34.88,
		latMax: 35.39,
		lonMin: 128.75,
		lonMax: 129.27,
	},
	{
		code: "2700000000",
		name: "대구",
		latMin: 35.76,
		latMax: 36.05,
		lonMin: 128.35,
		lonMax: 128.77,
	},
	{
		code: "2400000000",
		name: "광주",
		latMin: 35.06,
		latMax: 35.25,
		lonMin: 126.75,
		lonMax: 127.0,
	},
	{
		code: "2500000000",
		name: "대전",
		latMin: 36.2,
		latMax: 36.48,
		lonMin: 127.25,
		lonMax: 127.56,
	},
	{
		code: "2200000000",
		name: "울산",
		latMin: 35.44,
		latMax: 35.73,
		lonMin: 129.04,
		lonMax: 129.47,
	},
	{
		code: "2900000000",
		name: "세종",
		latMin: 36.44,
		latMax: 36.69,
		lonMin: 126.85,
		lonMax: 127.1,
	},
	// 도 (넓은 범위)
	{
		code: "3200000000",
		name: "강원",
		latMin: 37.0,
		latMax: 38.62,
		lonMin: 127.55,
		lonMax: 129.36,
	},
	{
		code: "3100000000",
		name: "경기",
		latMin: 36.89,
		latMax: 38.3,
		lonMin: 126.37,
		lonMax: 127.87,
	},
	{
		code: "3300000000",
		name: "충북",
		latMin: 36.0,
		latMax: 37.18,
		lonMin: 127.26,
		lonMax: 128.65,
	},
	{
		code: "3400000000",
		name: "충남",
		latMin: 35.97,
		latMax: 37.03,
		lonMin: 125.93,
		lonMax: 127.33,
	},
	{
		code: "3500000000",
		name: "전북",
		latMin: 35.27,
		latMax: 36.13,
		lonMin: 126.36,
		lonMax: 127.92,
	},
	{
		code: "3600000000",
		name: "전남",
		latMin: 33.95,
		latMax: 35.5,
		lonMin: 125.97,
		lonMax: 127.92,
	},
	{
		code: "3700000000",
		name: "경북",
		latMin: 35.57,
		latMax: 37.08,
		lonMin: 128.32,
		lonMax: 131.87,
	},
	{
		code: "3800000000",
		name: "경남",
		latMin: 34.59,
		latMax: 35.91,
		lonMin: 127.55,
		lonMax: 129.24,
	},
	{
		code: "3900000000",
		name: "제주",
		latMin: 33.0,
		latMax: 34.0,
		lonMin: 126.0,
		lonMax: 127.0,
	},
];

/** 서울 — 매칭 실패 시 기본값 */
const DEFAULT_REGION_CODE = "1100000000";

/**
 * 위경도로부터 가장 가까운 시도 행정구역코드를 반환합니다.
 * bounding-box 내 첫 매칭을 반환하며, 매칭 실패 시 서울 코드를 반환합니다.
 */
export function getRegionCode(lat: number, lon: number): string {
	for (const region of REGIONS) {
		if (
			lat >= region.latMin &&
			lat <= region.latMax &&
			lon >= region.lonMin &&
			lon <= region.lonMax
		) {
			return region.code;
		}
	}
	return DEFAULT_REGION_CODE;
}
