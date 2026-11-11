import { Coordinate } from "./coordinate.vo.js";
import {
  assertKoreanWeatherCovered,
  isKoreanWeatherCovered,
} from "./korean-weather-coverage.domain-service.js";

describe("한국 날씨 지원 범위", () => {
  it.each([
    [33, 124],
    [39, 132],
    [37.5665, 126.978],
  ])("기존 한국 경계를 포함해 허용한다: %p, %p", (latitude, longitude) => {
    expect(() => assertKoreanWeatherCovered(Coordinate.create(latitude, longitude))).not.toThrow();
  });

  it.each([32.9, 39.1, 40.7128])(
    "세계 좌표가 유효해도 지원 위도 밖이면 거부한다: %p",
    (latitude) => {
      expect(() => assertKoreanWeatherCovered(Coordinate.create(latitude, 126.978))).toThrow(
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
      expect(() => assertKoreanWeatherCovered(Coordinate.create(37.5665, longitude))).toThrow(
        expect.objectContaining({
          errorCode: "SYS_0002",
          details: { field: "longitude", value: longitude },
        }),
      );
    },
  );

  it.each([
    [37.5665, 126.978, true],
    [33, 124, true],
    [35.6762, 139.6503, false],
    [21.0285, 105.8542, false],
  ])("한국 공급자 범위 포함 여부를 판단한다: %p, %p → %p", (latitude, longitude, expected) => {
    // Given
    const coordinate = Coordinate.create(latitude, longitude);
    // When
    const covered = isKoreanWeatherCovered(coordinate);
    // Then
    expect(covered).toBe(expected);
  });
});
