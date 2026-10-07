import { Coordinate } from "../../value-objects/forecast/coordinate.vo.js";
import { KoreanWeatherCoveragePolicy } from "./korean-weather-coverage.policy.js";

describe("한국 날씨 지원 범위", () => {
  it.each([
    [33, 124],
    [39, 132],
    [37.5665, 126.978],
  ])("기존 한국 경계를 포함해 허용한다: %p, %p", (latitude, longitude) => {
    expect(() =>
      KoreanWeatherCoveragePolicy.assertSupported(Coordinate.of(latitude, longitude)),
    ).not.toThrow();
  });

  it.each([32.9, 39.1, 40.7128])(
    "세계 좌표가 유효해도 지원 위도 밖이면 거부한다: %p",
    (latitude) => {
      expect(() =>
        KoreanWeatherCoveragePolicy.assertSupported(Coordinate.of(latitude, 126.978)),
      ).toThrow(
        expect.objectContaining({
          errorCode: "SYS_0002",
          details: { field: "latitude", value: latitude },
        }),
      );
    },
  );

  it.each([123.9, 132.1, -74.006])(
    "지원 경도 밖이면 기존 longitude 오류를 유지한다: %p",
    (longitude) => {
      expect(() =>
        KoreanWeatherCoveragePolicy.assertSupported(Coordinate.of(37.5665, longitude)),
      ).toThrow(
        expect.objectContaining({
          errorCode: "SYS_0002",
          details: { field: "longitude", value: longitude },
        }),
      );
    },
  );
});
