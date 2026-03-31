/**
 * getRegionCode 단위 테스트
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test region-code.spec
 * ```
 */

import { getRegionCode } from "./region-code";

describe("getRegionCode", () => {
	it.each([
		{ name: "서울시청", lat: 37.5665, lon: 126.978, expected: "1100000000" },
		{ name: "부산시청", lat: 35.1796, lon: 129.0756, expected: "2600000000" },
		{ name: "대구시청", lat: 35.8714, lon: 128.6014, expected: "2700000000" },
		{ name: "인천시청", lat: 37.4563, lon: 126.7052, expected: "2300000000" },
		{ name: "광주시청", lat: 35.1595, lon: 126.8526, expected: "2400000000" },
		{ name: "대전시청", lat: 36.3504, lon: 127.3845, expected: "2500000000" },
		{ name: "울산시청", lat: 35.5384, lon: 129.3114, expected: "2200000000" },
		{ name: "제주시청", lat: 33.4996, lon: 126.5312, expected: "3900000000" },
		{ name: "춘천시청", lat: 37.8813, lon: 127.7298, expected: "3200000000" },
		{ name: "수원시청", lat: 37.2636, lon: 127.0286, expected: "3100000000" },
	])("$name ($lat, $lon) → $expected", ({ lat, lon, expected }) => {
		expect(getRegionCode(lat, lon)).toBe(expected);
	});

	it("범위 밖 좌표는 서울 기본값을 반환한다", () => {
		expect(getRegionCode(40.0, 130.0)).toBe("1100000000");
	});
});
