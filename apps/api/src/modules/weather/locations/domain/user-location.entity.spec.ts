import { Coordinate } from "../../shared/domain/coordinate.vo.js";
import { GridCoordinate } from "../../shared/domain/grid-coordinate.vo.js";
import { UserLocation } from "./user-location.entity.js";

function snapshot(location: UserLocation) {
  return {
    userId: location.userId,
    latitude: location.latitude,
    longitude: location.longitude,
    grid: location.grid == null ? null : [location.grid.gridX, location.grid.gridY],
    timezone: location.timezone,
  };
}

describe("UserLocation — 위치·시간대와 저장 격자", () => {
  it("해결된 격자와 시간대를 재계산하지 않고 생성한다", () => {
    // Given
    const coordinate = Coordinate.of(37.5665, 126.978);
    // When
    const location = UserLocation.create({
      userId: "user-1",
      coordinate,
      grid: GridCoordinate.of(99, 77),
      timezone: "Asia/Seoul",
    });
    // Then
    expect(snapshot(location)).toEqual({
      userId: "user-1",
      latitude: 37.5665,
      longitude: 126.978,
      grid: [99, 77],
      timezone: "Asia/Seoul",
    });
  });

  it("저장된 격자를 좌표 투영 결과로 덮어쓰지 않고 복원한다", () => {
    // Given
    const persisted = {
      userId: "user-1",
      latitude: 37.5665,
      longitude: 126.978,
      gridX: 99,
      gridY: 77,
      timezone: null,
    };
    // When
    const location = UserLocation.reconstitute(persisted);
    // Then
    expect(snapshot(location)).toEqual({
      userId: "user-1",
      latitude: 37.5665,
      longitude: 126.978,
      grid: [99, 77],
      timezone: null,
    });
  });

  it("격자 없는 해외 위치는 v1 격자를 요구하면 WEATHER_1902다", () => {
    // Given
    const location = UserLocation.reconstitute({
      userId: "user-1",
      latitude: 35.6762,
      longitude: 139.6503,
      gridX: null,
      gridY: null,
      timezone: "Asia/Tokyo",
    });
    // When
    const require = () => location.requireKmaGrid();
    // Then
    expect(location.grid).toBeNull();
    expect(require).toThrow(expect.objectContaining({ errorCode: "WEATHER_1902" }));
  });
});
