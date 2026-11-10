import { Coordinate } from "./coordinate.vo.js";

describe("Coordinate — 지역 지원과 독립된 WGS84 좌표", () => {
  it.each([
    [37.5665, 126.978],
    [40.7128, -74.006],
    [-90, -180],
    [90, 180],
  ])("유효한 전세계 좌표를 보존한다: %p, %p", (latitude, longitude) => {
    const coordinate = Coordinate.of(latitude, longitude);
    expect({ latitude: coordinate.latitude, longitude: coordinate.longitude }).toEqual({
      latitude,
      longitude,
    });
  });

  it.each([-90.001, 90.001, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "유효하지 않은 위도는 latitude 필드의 SYS_0002로 거부한다: %p",
    (latitude) => {
      expect(() => Coordinate.of(latitude, 126.978)).toThrow(
        expect.objectContaining({
          errorCode: "SYS_0002",
          details: { field: "latitude", value: latitude },
        }),
      );
    },
  );

  it.each([-180.001, 180.001, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "유효하지 않은 경도는 longitude 필드의 SYS_0002로 거부한다: %p",
    (longitude) => {
      expect(() => Coordinate.of(37.5665, longitude)).toThrow(
        expect.objectContaining({
          errorCode: "SYS_0002",
          details: { field: "longitude", value: longitude },
        }),
      );
    },
  );
});
