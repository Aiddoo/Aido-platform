import { dailySendWindowAt } from "./daily-send-window.domain-service.js";

function windowOf(now: string, timeZone: string) {
  const window = dailySendWindowAt({ now: Temporal.Instant.from(now), timeZone });
  return {
    localDate: window.localDate.toString(),
    startsAt: window.startsAt.toString(),
    endsAt: window.endsAt.toString(),
  };
}

describe("dailySendWindowAt — 보낸 사람 현지 하루", () => {
  it.each([
    {
      name: "서울 자정 직전",
      now: "2026-07-26T14:59:59.999Z",
      timeZone: "Asia/Seoul",
      expected: {
        localDate: "2026-07-26",
        startsAt: "2026-07-25T15:00:00Z",
        endsAt: "2026-07-26T15:00:00Z",
      },
    },
    {
      name: "서울 자정",
      now: "2026-07-26T15:00:00Z",
      timeZone: "Asia/Seoul",
      expected: {
        localDate: "2026-07-27",
        startsAt: "2026-07-26T15:00:00Z",
        endsAt: "2026-07-27T15:00:00Z",
      },
    },
    {
      name: "LA 자정 직전(서머타임)",
      now: "2026-07-27T06:59:59.999Z",
      timeZone: "America/Los_Angeles",
      expected: {
        localDate: "2026-07-26",
        startsAt: "2026-07-26T07:00:00Z",
        endsAt: "2026-07-27T07:00:00Z",
      },
    },
    {
      name: "LA 자정(서머타임)",
      now: "2026-07-27T07:00:00Z",
      timeZone: "America/Los_Angeles",
      expected: {
        localDate: "2026-07-27",
        startsAt: "2026-07-27T07:00:00Z",
        endsAt: "2026-07-28T07:00:00Z",
      },
    },
  ])("$name에는 그 현지 날짜의 자정부터 다음 자정 전까지다", ({ now, timeZone, expected }) => {
    // When
    const window = windowOf(now, timeZone);

    // Then
    expect(window).toEqual(expected);
  });

  it("LA 서머타임이 끝나는 날은 25시간이다", () => {
    // When
    const window = windowOf("2026-11-01T12:00:00Z", "America/Los_Angeles");

    // Then
    expect(window).toEqual({
      localDate: "2026-11-01",
      startsAt: "2026-11-01T07:00:00Z",
      endsAt: "2026-11-02T08:00:00Z",
    });
  });

  it.each(["", "Mars/Olympus", "UTC"])("시간대가 %j이면 UTC 하루로 센다", (timeZone) => {
    // When
    const window = windowOf("2026-07-26T23:59:59.999Z", timeZone);

    // Then
    expect(window).toEqual({
      localDate: "2026-07-26",
      startsAt: "2026-07-26T00:00:00Z",
      endsAt: "2026-07-27T00:00:00Z",
    });
  });
});
