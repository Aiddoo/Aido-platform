import { Coordinate } from "../../shared/domain/coordinate.vo.js";
import { toTmCoordinate } from "./tm-coordinate.domain-service.js";

describe("toTmCoordinate", () => {
  it("서울시청 좌표를 TM 중부원점으로 변환해야 한다", () => {
    // Given
    const seoulCityHall = Coordinate.create(37.5665, 126.978);

    // When
    const result = toTmCoordinate(seoulCityHall);

    // Then
    // TM 중부원점 좌표 (오차 ±50m 허용)
    expect(result.tmX).toBeCloseTo(198_079, -2);
    expect(result.tmY).toBeCloseTo(451_847, -2);
  });

  it("부산시청 좌표를 변환해야 한다", () => {
    // Given
    const busanCityHall = Coordinate.create(35.1796, 129.0756);

    // When
    const result = toTmCoordinate(busanCityHall);

    // Then
    // TM 중부원점 좌표 (에어코리아 API 검증: 부산 전포동 1.3km)
    expect(result.tmX).toBeCloseTo(389_077, -1);
    expect(result.tmY).toBeCloseTo(188_994, -1);
  });
});
