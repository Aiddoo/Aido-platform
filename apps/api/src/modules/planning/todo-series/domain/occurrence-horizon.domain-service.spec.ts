import { occurrenceHorizon } from "./occurrence-horizon.domain-service.js";

describe("occurrenceHorizon — 미리 만드는 기간", () => {
  it.each([
    {
      name: "같은 순간이라도 서울은 이미 다음 날이다",
      timezone: "Asia/Seoul",
      at: "2026-11-04T16:00:00.000Z",
      expected: "2027-02-03",
    },
    {
      name: "뉴욕은 아직 그 전날이다",
      timezone: "America/New_York",
      at: "2026-11-04T16:00:00.000Z",
      expected: "2027-02-02",
    },
    {
      name: "윤일을 넘어도 달력으로 90일이다",
      timezone: "UTC",
      at: "2028-01-01T00:00:00.000Z",
      expected: "2028-03-31",
    },
  ])("$name", ({ timezone, at, expected }) => {
    // When
    const horizon = occurrenceHorizon(timezone, Temporal.Instant.from(at));
    // Then
    expect(horizon).toBe(expected);
  });
});
