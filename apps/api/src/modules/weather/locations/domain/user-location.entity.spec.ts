import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { TimeZone } from "#api/shared/domain/time/time-zone.vo";

import { Coordinate } from "../../shared/domain/coordinate.vo.js";
import { GridCoordinate } from "../../shared/domain/grid-coordinate.vo.js";
import { UserLocation, type UserLocationPrimitives } from "./user-location.entity.js";

const NOW = Temporal.Instant.from("2026-11-10T00:00:00Z");

function primitives(overrides: Partial<UserLocationPrimitives> = {}): UserLocationPrimitives {
  return {
    userId: "user-1",
    latitude: 37.5665,
    longitude: 126.978,
    gridX: 99,
    gridY: 77,
    timezone: "Asia/Seoul",
    updatedAt: NOW,
    ...overrides,
  };
}

describe("UserLocation — 위치·시간대와 저장 격자", () => {
  it("해결된 격자와 시간대를 재계산하지 않고 생성한다", () => {
    // Given
    const coordinate = Coordinate.create(37.5665, 126.978);

    // When
    const location = UserLocation.create({
      userId: UserId.reconstitute("user-1"),
      coordinate,
      grid: GridCoordinate.create(99, 77),
      timezone: TimeZone.create("Asia/Seoul"),
      now: NOW,
    });

    // Then
    expect(location.toPrimitives()).toEqual(primitives());
  });

  it("저장된 격자를 좌표 투영 결과로 덮어쓰지 않고 복원한다", () => {
    // Given
    const persisted = primitives({ timezone: null });

    // When
    const location = UserLocation.reconstitute(persisted);

    // Then
    expect(location.toPrimitives()).toEqual(persisted);
    expect(location.timezone).toBeNull();
  });

  it("격자 없는 해외 위치는 v1 격자를 요구하면 WEATHER_1902다", () => {
    // Given
    const location = UserLocation.reconstitute(
      primitives({
        latitude: 35.6762,
        longitude: 139.6503,
        gridX: null,
        gridY: null,
        timezone: "Asia/Tokyo",
      }),
    );

    // When
    const require = () => location.requireKmaGrid();

    // Then
    expect(location.grid).toBeNull();
    expect(require).toThrow(expect.objectContaining({ errorCode: "WEATHER_1902" }));
  });
});
