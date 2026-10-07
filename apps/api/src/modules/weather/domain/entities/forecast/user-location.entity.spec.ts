import { Coordinate } from "../../value-objects/forecast/coordinate.vo.js";
import { GridCoordinate } from "../../value-objects/forecast/grid-coordinate.vo.js";
import { UserLocation } from "./user-location.entity.js";

describe("UserLocation — 위치와 저장 격자", () => {
  it("해결된 격자를 재계산하지 않고 생성한다", () => {
    const location = UserLocation.create(
      "user-1",
      Coordinate.of(37.5665, 126.978),
      GridCoordinate.of(99, 77),
    );

    expect({
      userId: location.userId,
      latitude: location.latitude,
      longitude: location.longitude,
      gridX: location.gridX,
      gridY: location.gridY,
    }).toEqual({ userId: "user-1", latitude: 37.5665, longitude: 126.978, gridX: 99, gridY: 77 });
  });

  it("저장된 격자를 좌표 투영 결과로 덮어쓰지 않고 복원한다", () => {
    const persisted = {
      userId: "user-1",
      latitude: 37.5665,
      longitude: 126.978,
      gridX: 99,
      gridY: 77,
    };
    const location = UserLocation.reconstitute(persisted);

    expect({
      userId: location.userId,
      latitude: location.latitude,
      longitude: location.longitude,
      gridX: location.gridX,
      gridY: location.gridY,
    }).toEqual(persisted);
  });
});
