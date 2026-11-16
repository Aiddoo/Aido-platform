import { NIGHT_TIME_CONFIG } from "@aido/api/vocabulary";
import { range } from "es-toolkit";

import {
  isInSuggestionDispatchWindow,
  suggestionDispatchLocalDate,
} from "./suggestion-dispatch-window.domain-service.js";

describe("isInSuggestionDispatchWindow", () => {
  it.each([
    { label: "서울 08:59", at: "2026-11-09T23:59:00Z", timeZone: "Asia/Seoul", expected: false },
    { label: "서울 09:00", at: "2026-11-10T00:00:00Z", timeZone: "Asia/Seoul", expected: true },
    {
      label: "서울 11:59(놓친 실행 보정)",
      at: "2026-11-10T02:59:00Z",
      timeZone: "Asia/Seoul",
      expected: true,
    },
    { label: "서울 12:00", at: "2026-11-10T03:00:00Z", timeZone: "Asia/Seoul", expected: false },
    {
      label: "서울 09:00일 때 LA 전날 16:00",
      at: "2026-11-10T00:00:00Z",
      timeZone: "America/Los_Angeles",
      expected: false,
    },
    {
      label: "LA 09:00(PST)",
      at: "2026-11-10T17:00:00Z",
      timeZone: "America/Los_Angeles",
      expected: true,
    },
    {
      label: "LA 09:00(PDT)",
      at: "2026-07-10T16:00:00Z",
      timeZone: "America/Los_Angeles",
      expected: true,
    },
  ])("$label → $expected", ({ at, timeZone, expected }) => {
    // When
    const inWindow = isInSuggestionDispatchWindow({ at: Temporal.Instant.from(at), timeZone });

    // Then
    expect(inWindow).toBe(expected);
  });

  it("제안 창의 모든 시각은 야간 푸시 시간 밖이다", () => {
    // Given
    const midnight = Temporal.ZonedDateTime.from("2026-11-10T00:00:00[Asia/Seoul]");

    // When
    const dispatchHours = range(24).filter((hour) =>
      isInSuggestionDispatchWindow({
        at: midnight.add({ hours: hour }).toInstant(),
        timeZone: "Asia/Seoul",
      }),
    );

    // Then
    expect(dispatchHours.length).toBeGreaterThan(0);
    expect(
      dispatchHours.every(
        (hour) => NIGHT_TIME_CONFIG.END_HOUR <= hour && hour < NIGHT_TIME_CONFIG.START_HOUR,
      ),
    ).toBe(true);
  });
  it("멱등 키의 날짜는 UTC가 아니라 사용자 현지 날짜다", () => {
    // Given
    const at = Temporal.Instant.from("2026-11-09T22:00:00Z");

    // When
    const seoul = suggestionDispatchLocalDate({ at, timeZone: "Asia/Seoul" });
    const losAngeles = suggestionDispatchLocalDate({ at, timeZone: "America/Los_Angeles" });

    // Then
    expect(seoul).toBe("2026-11-10");
    expect(losAngeles).toBe("2026-11-09");
  });
});
