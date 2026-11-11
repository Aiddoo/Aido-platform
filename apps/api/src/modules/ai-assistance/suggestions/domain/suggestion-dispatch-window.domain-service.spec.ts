import {
  isInSuggestionDispatchWindow,
  suggestionDispatchLocalDate,
} from "./suggestion-dispatch-window.domain-service.js";

describe("반복 제안 디스패치 창(사용자 현지 07시대)", () => {
  it.each([
    { label: "서울 06:59", at: "2026-11-09T21:59:00Z", timeZone: "Asia/Seoul", expected: false },
    { label: "서울 07:00", at: "2026-11-09T22:00:00Z", timeZone: "Asia/Seoul", expected: true },
    {
      label: "서울 09:59(놓친 실행 보정)",
      at: "2026-11-10T00:59:00Z",
      timeZone: "Asia/Seoul",
      expected: true,
    },
    { label: "서울 10:00", at: "2026-11-10T01:00:00Z", timeZone: "Asia/Seoul", expected: false },
    // 같은 순간 LA는 전날 오후다
    {
      label: "서울 07:00일 때 LA 14:00",
      at: "2026-11-09T22:00:00Z",
      timeZone: "America/Los_Angeles",
      expected: false,
    },
    {
      label: "LA 07:00(PST)",
      at: "2026-11-10T15:00:00Z",
      timeZone: "America/Los_Angeles",
      expected: true,
    },
    {
      label: "LA 07:00(PDT)",
      at: "2026-07-10T14:00:00Z",
      timeZone: "America/Los_Angeles",
      expected: true,
    },
  ])("$label → $expected", ({ at, timeZone, expected }) => {
    // When
    const inWindow = isInSuggestionDispatchWindow({ at: Temporal.Instant.from(at), timeZone });

    // Then
    expect(inWindow).toBe(expected);
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
