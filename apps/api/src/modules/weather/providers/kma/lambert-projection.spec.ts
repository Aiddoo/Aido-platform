/**
 * Lambert Conformal Conic Projection 단위 테스트
 *
 * @description
 * WGS84 위경도 → 기상청 격자(nx, ny) 변환 정확성 검증.
 * 기상청 공식 테스트 데이터 기반.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test lambert-projection.spec
 * ```
 */

import { convertToGrid } from "./lambert-projection";

describe("convertToGrid", () => {
	it("서울 (37.5665, 126.9780) → nx=60, ny=127", () => {
		// Given
		const lat = 37.5665;
		const lon = 126.978;

		// When
		const result = convertToGrid(lat, lon);

		// Then
		expect(result.nx).toBe(60);
		expect(result.ny).toBe(127);
	});

	it("부산 (35.1796, 129.0756) → nx=98, ny=76", () => {
		// Given
		const lat = 35.1796;
		const lon = 129.0756;

		// When
		const result = convertToGrid(lat, lon);

		// Then
		expect(result.nx).toBe(98);
		expect(result.ny).toBe(76);
	});

	it("제주 (33.4996, 126.5312) → nx=53, ny=38", () => {
		// Given
		const lat = 33.4996;
		const lon = 126.5312;

		// When
		const result = convertToGrid(lat, lon);

		// Then
		expect(result.nx).toBe(53);
		expect(result.ny).toBe(38);
	});

	it("인천 (37.4563, 126.7052) → nx=55, ny=124", () => {
		// Given
		const lat = 37.4563;
		const lon = 126.7052;

		// When
		const result = convertToGrid(lat, lon);

		// Then
		expect(result.nx).toBe(55);
		expect(result.ny).toBe(124);
	});

	it("같은 격자 셀 내의 좌표는 동일한 격자를 반환해야 한다", () => {
		// Given — 서울 시청 근처 두 좌표 (5km 이내)
		const coord1 = convertToGrid(37.5665, 126.978);
		const coord2 = convertToGrid(37.57, 126.98);

		// Then
		expect(coord1.nx).toBe(coord2.nx);
		expect(coord1.ny).toBe(coord2.ny);
	});

	it("정수값을 반환해야 한다", () => {
		// When
		const result = convertToGrid(37.5665, 126.978);

		// Then
		expect(Number.isInteger(result.nx)).toBe(true);
		expect(Number.isInteger(result.ny)).toBe(true);
	});
});
