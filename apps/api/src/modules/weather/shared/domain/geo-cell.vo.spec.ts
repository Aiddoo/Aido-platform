import { Coordinate } from "./coordinate.vo.js";
import { GeoCell } from "./geo-cell.vo.js";

describe("GeoCell — geohash 5자리 칸", () => {
  it("좌표를 5자리 geohash 칸으로 묶는다", () => {
    // Given
    const seoulCityHall = Coordinate.create(37.5665, 126.978);
    // When
    const cell = GeoCell.create(seoulCityHall);
    // Then
    expect(cell.key).toBe("wydm9");
  });

  it("같은 칸 안의 가까운 두 좌표는 같은 칸을 공유한다", () => {
    // Given
    const first = Coordinate.create(37.5665, 126.978);
    const nearby = Coordinate.create(37.567, 126.9785);
    // When
    const [a, b] = [first, nearby].map((coordinate) => GeoCell.create(coordinate));
    // Then
    expect(a?.key).toBe(b?.key);
  });

  it("칸 중심은 같은 칸으로 다시 묶이며 원래 좌표와 다르다", () => {
    // Given
    const user = Coordinate.create(37.5665, 126.978);
    // When
    const cell = GeoCell.create(user);
    const center = cell.center;
    // Then
    expect(GeoCell.create(center).key).toBe(cell.key);
    expect([center.latitude, center.longitude]).not.toEqual([user.latitude, user.longitude]);
    expect(Math.abs(center.latitude - user.latitude)).toBeLessThan(0.022);
    expect(Math.abs(center.longitude - user.longitude)).toBeLessThan(0.022);
  });

  it("경도 ±180 근처와 극지 좌표도 유효한 칸을 만든다", () => {
    // Given
    const coordinates = [Coordinate.create(-16.5, 179.99), Coordinate.create(89.9, -179.99)];
    // When
    const cells = coordinates.map((coordinate) => GeoCell.create(coordinate));
    // Then
    for (const cell of cells) {
      expect(cell.key).toMatch(/^[0-9b-hjkmnp-z]{5}$/);
      expect(() => cell.center).not.toThrow();
    }
  });
});
