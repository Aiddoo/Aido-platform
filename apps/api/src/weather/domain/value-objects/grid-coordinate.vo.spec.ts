/**
 * GridCoordinate 값 객체 단위 테스트
 */
import { GridCoordinate } from "./grid-coordinate.vo";

describe("GridCoordinate — 기상청 격자 좌표 값 객체", () => {
	it("격자 좌표를 생성하고 getter로 노출한다", () => {
		const grid = GridCoordinate.of(60, 127);

		expect(grid.gridX).toBe(60);
		expect(grid.gridY).toBe(127);
	});

	describe("equals", () => {
		it("동일 격자면 true", () => {
			expect(
				GridCoordinate.of(60, 127).equals(GridCoordinate.of(60, 127)),
			).toBe(true);
		});

		it("gridX가 다르면 false", () => {
			expect(
				GridCoordinate.of(60, 127).equals(GridCoordinate.of(61, 127)),
			).toBe(false);
		});

		it("gridY가 다르면 false", () => {
			expect(
				GridCoordinate.of(60, 127).equals(GridCoordinate.of(60, 128)),
			).toBe(false);
		});
	});
});
