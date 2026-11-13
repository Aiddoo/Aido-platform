import {
  UserLocation,
  type UserLocationPrimitives,
} from "#api/modules/weather/locations/domain/user-location.aggregate";

export const USER_LOCATION_FIXTURE_NOW = Temporal.Instant.from("2026-11-10T00:00:00Z");
export const USER_LOCATION_FIXTURE_USER_ID = "clz7x5p8k0001qz0z8z8z8z8z";
export const USER_LOCATION_FIXTURE_OTHER_USER_ID = "clz7x5p8k0002qz0z8z8z8z8z";

/** 서울 시청(격자 60,127). 필요한 칸만 덮어쓴다. */
export function createUserLocationFixture(
  overrides: Partial<UserLocationPrimitives> = {},
): UserLocation {
  return UserLocation.reconstitute({
    userId: USER_LOCATION_FIXTURE_USER_ID,
    latitude: 37.5665,
    longitude: 126.978,
    gridX: 60,
    gridY: 127,
    timezone: "Asia/Seoul",
    updatedAt: USER_LOCATION_FIXTURE_NOW,
    ...overrides,
  });
}

const CITY_PRESETS = {
  서울: {},
  부산: { latitude: 35.1796, longitude: 129.0756, gridX: 98, gridY: 76 },
  도쿄: {
    latitude: 35.6762,
    longitude: 139.6503,
    gridX: null,
    gridY: null,
    timezone: "Asia/Tokyo",
  },
} as const satisfies Record<string, Partial<UserLocationPrimitives>>;

export function weatherLocationFixture(
  userId = "weather-user",
  city: keyof typeof CITY_PRESETS = "서울",
): UserLocation {
  return createUserLocationFixture({ userId, ...CITY_PRESETS[city] });
}
