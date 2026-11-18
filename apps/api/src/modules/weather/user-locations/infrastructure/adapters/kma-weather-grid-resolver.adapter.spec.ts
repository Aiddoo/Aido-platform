import { Coordinate } from "../../../shared/domain/coordinate.vo.js";
import { KmaWeatherGridResolverAdapter } from "./kma-weather-grid-resolver.adapter.js";

describe("KmaWeatherGridResolverAdapter — 기상청 격자 투영", () => {
  it.each([
    { city: "서울", latitude: 37.5665, longitude: 126.978, gridX: 60, gridY: 127 },
    { city: "부산", latitude: 35.1796, longitude: 129.0756, gridX: 98, gridY: 76 },
    { city: "제주", latitude: 33.4996, longitude: 126.5312, gridX: 53, gridY: 38 },
    { city: "인천", latitude: 37.4563, longitude: 126.7052, gridX: 55, gridY: 124 },
  ])(
    "$city 좌표는 기상청 공식 격자 ($gridX, $gridY)다",
    ({ latitude, longitude, gridX, gridY }) => {
      // Given
      const coordinate = Coordinate.create(latitude, longitude);

      // When
      const resolved = new KmaWeatherGridResolverAdapter().resolveGrid(coordinate);

      // Then
      expect(resolved.value).toEqual({ gridX, gridY });
    },
  );

  it("같은 격자 칸 안의 두 좌표는 같은 격자다", () => {
    // Given
    const resolver = new KmaWeatherGridResolverAdapter();

    // When
    const cityHall = resolver.resolveGrid(Coordinate.create(37.5665, 126.978));
    const nearby = resolver.resolveGrid(Coordinate.create(37.57, 126.98));

    // Then
    expect(nearby.equals(cityHall)).toBe(true);
  });
});
