/**
 * UserLocation 애그리게잇 단위 테스트
 *
 * 좌표로부터 격자를 결정적으로 파생하는지, 복원이 저장된 격자를 그대로
 * 유지하는지 검증한다.
 */
import { Coordinate } from "../value-objects/coordinate.vo";
import { UserLocation } from "./user-location.entity";

describe("UserLocation — 사용자 위치 애그리게잇", () => {
	describe("create", () => {
		it("좌표로부터 격자를 파생하여 생성한다", () => {
			const location = UserLocation.create(
				"user-1",
				Coordinate.of(37.5665, 126.978),
			);

			expect(location.userId).toBe("user-1");
			expect(location.latitude).toBe(37.5665);
			expect(location.longitude).toBe(126.978);
			expect(Number.isInteger(location.gridX)).toBe(true);
			expect(Number.isInteger(location.gridY)).toBe(true);
		});

		it("좌표가 같으면 파생 격자도 같다 (결정적)", () => {
			const a = UserLocation.create("user-1", Coordinate.of(37.5665, 126.978));
			const b = UserLocation.create("user-2", Coordinate.of(37.5665, 126.978));

			expect(a.grid.equals(b.grid)).toBe(true);
		});
	});

	describe("reconstitute", () => {
		it("저장된 값에서 복원하며 격자를 그대로 유지한다", () => {
			const location = UserLocation.reconstitute({
				userId: "user-1",
				latitude: 37.5665,
				longitude: 126.978,
				gridX: 60,
				gridY: 127,
			});

			expect(location.userId).toBe("user-1");
			expect(location.gridX).toBe(60);
			expect(location.gridY).toBe(127);
			expect(location.coordinate).toBeInstanceOf(Coordinate);
		});
	});
});
