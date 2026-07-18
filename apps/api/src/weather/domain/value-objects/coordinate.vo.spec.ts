/**
 * Coordinate 값 객체 단위 테스트
 *
 * 한국 좌표 범위 불변식과 격자 변환을 검증한다.
 */
import { DomainException } from "@/shared/domain/exceptions/domain.exception";
import { Coordinate } from "./coordinate.vo";
import { GridCoordinate } from "./grid-coordinate.vo";

describe("Coordinate — WGS84 위경도 값 객체", () => {
	describe("of", () => {
		it("한국 범위 내 좌표를 생성한다", () => {
			const coord = Coordinate.of(37.5665, 126.978);

			expect(coord.latitude).toBe(37.5665);
			expect(coord.longitude).toBe(126.978);
		});

		it.each([32.9, 39.1])(
			"위도가 범위(33~39)를 벗어나면 DomainException을 던진다: %p",
			(lat) => {
				expect(() => Coordinate.of(lat, 126.978)).toThrow(DomainException);
			},
		);

		it.each([123.9, 132.1])(
			"경도가 범위(124~132)를 벗어나면 DomainException을 던진다: %p",
			(lon) => {
				expect(() => Coordinate.of(37.5665, lon)).toThrow(DomainException);
			},
		);

		it("범위를 벗어나면 SYS_0002 에러코드를 실는다", () => {
			expect(() => Coordinate.of(10, 126.978)).toThrow(
				expect.objectContaining({ errorCode: "SYS_0002" }),
			);
		});
	});

	describe("toGrid", () => {
		it("기상청 격자 좌표로 변환한다", () => {
			const grid = Coordinate.of(37.5665, 126.978).toGrid();

			expect(grid).toBeInstanceOf(GridCoordinate);
			expect(Number.isInteger(grid.gridX)).toBe(true);
			expect(Number.isInteger(grid.gridY)).toBe(true);
		});

		it("동일 좌표는 결정적으로 동일 격자를 낸다", () => {
			const a = Coordinate.of(37.5665, 126.978).toGrid();
			const b = Coordinate.of(37.5665, 126.978).toGrid();

			expect(a.equals(b)).toBe(true);
		});
	});
});
