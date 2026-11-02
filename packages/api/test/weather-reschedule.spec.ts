import { describe, expect, it } from "vitest";

import {
  buildWeatherRescheduleDeepLink,
  WEATHER_RESCHEDULE_MAX_TODO_IDS,
} from "../src/vocabulary/index.js";

describe("buildWeatherRescheduleDeepLink", () => {
  it("할 일 id를 쉼표로 잇고 이유를 붙인다", () => {
    expect(buildWeatherRescheduleDeepLink([12, 15], "rain")).toBe(
      "/weather/reschedule?todoIds=12,15&reason=rain",
    );
    expect(buildWeatherRescheduleDeepLink([7], "heat")).toBe(
      "/weather/reschedule?todoIds=7&reason=heat",
    );
  });

  it("할 일이 상한보다 많으면 앞에서부터 상한 개수만 싣는다", () => {
    // Given 상한보다 많은 할 일 id
    const todoIds = Array.from({ length: WEATHER_RESCHEDULE_MAX_TODO_IDS + 20 }, (_, i) => i + 1);

    // When
    const url = buildWeatherRescheduleDeepLink(todoIds, "rain");

    // Then
    const ids = new URL(url, "aido://app").searchParams.get("todoIds")?.split(",");
    expect(ids).toEqual(todoIds.slice(0, WEATHER_RESCHEDULE_MAX_TODO_IDS).map(String));
  });
});
