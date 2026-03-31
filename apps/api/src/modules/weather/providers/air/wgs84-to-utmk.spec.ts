/**
 * WGS84 → TM 중부원점 좌표 변환 테스트
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test wgs84-to-utmk.spec
 * ```
 */

import { convertToTm } from "./wgs84-to-utmk";

describe("convertToTm", () => {
	it("서울시청 좌표를 TM 중부원점으로 변환해야 한다", () => {
		// Given: 서울시청 WGS84 좌표
		const result = convertToTm(37.5665, 126.978);

		// Then: TM 중부원점 좌표 (오차 ±50m 허용)
		expect(result.tmX).toBeCloseTo(198079, -2);
		expect(result.tmY).toBeCloseTo(451847, -2);
	});

	it("부산시청 좌표를 변환해야 한다", () => {
		// Given: 부산시청 WGS84 좌표
		const result = convertToTm(35.1796, 129.0756);

		// Then: TM 중부원점 좌표 (에어코리아 API 검증: 부산 전포동 1.3km)
		expect(result.tmX).toBeCloseTo(389077, -1);
		expect(result.tmY).toBeCloseTo(188994, -1);
	});
});
