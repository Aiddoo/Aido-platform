import { Coordinate } from "#api/modules/weather/shared/domain/coordinate.vo";

import { TzLookupTimezoneResolverAdapter } from "./tz-lookup-timezone-resolver.adapter.js";

describe("TzLookupTimezoneResolverAdapter — 좌표의 시간대와 국가", () => {
  const resolver = new TzLookupTimezoneResolverAdapter();

  it.each([
    ["서울", 37.5665, 126.978, { timezone: "Asia/Seoul", countryCode: "KR" }],
    ["도쿄", 35.6762, 139.6503, { timezone: "Asia/Tokyo", countryCode: "JP" }],
    ["뉴욕", 40.7128, -74.006, { timezone: "America/New_York", countryCode: "US" }],
  ])("%s 좌표의 IANA 시간대와 국가를 돌려준다", (_city, latitude, longitude, expected) => {
    // Given
    const coordinate = Coordinate.create(latitude, longitude);
    // When
    const region = resolver.resolve(coordinate);
    // Then
    expect(region).toEqual(expected);
  });

  it("나라가 없는 바다 한가운데는 시간대만 있고 국가는 null이다", () => {
    // Given
    const southPacific = Coordinate.create(-40, -130);
    // When
    const region = resolver.resolve(southPacific);
    // Then
    expect(region).toEqual({ timezone: "Etc/GMT+9", countryCode: null });
  });
});
