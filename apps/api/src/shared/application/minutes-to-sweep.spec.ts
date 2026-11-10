import { minutesToSweep } from "./minutes-to-sweep.js";

const NOW = Temporal.Instant.from("2026-11-10T07:30:42.123Z");

function minutesAgo(minutes: number): Temporal.Instant {
  return Temporal.Instant.from("2026-11-10T07:30:00Z").subtract({ minutes });
}

function labels(instants: readonly Temporal.Instant[]): string[] {
  return instants.map((instant) => instant.toString());
}

describe("minutesToSweep — 놓친 분 따라잡기", () => {
  it.each([
    { case: "처음 실행이면 지금 분만", lastCompletedAt: null, expected: ["2026-11-10T07:30:00Z"] },
    {
      case: "1분 지났으면 지금 분만",
      lastCompletedAt: minutesAgo(1),
      expected: ["2026-11-10T07:30:00Z"],
    },
    {
      case: "7분 지났으면 마지막 다음 분부터 지금까지 7개",
      lastCompletedAt: minutesAgo(7),
      expected: [
        "2026-11-10T07:24:00Z",
        "2026-11-10T07:25:00Z",
        "2026-11-10T07:26:00Z",
        "2026-11-10T07:27:00Z",
        "2026-11-10T07:28:00Z",
        "2026-11-10T07:29:00Z",
        "2026-11-10T07:30:00Z",
      ],
    },
    {
      case: "시계가 거꾸로 갔으면 지금 분만",
      lastCompletedAt: Temporal.Instant.from("2026-11-10T08:00:00Z"),
      expected: ["2026-11-10T07:30:00Z"],
    },
    { case: "이미 지금 분을 끝냈으면 없음", lastCompletedAt: minutesAgo(0), expected: [] },
  ])("$case", ({ lastCompletedAt, expected }) => {
    // When
    const minutes = minutesToSweep({ lastCompletedAt, now: NOW, maxCatchUpMinutes: 15 });

    // Then
    expect(labels(minutes)).toEqual(expected);
  });

  it("30분 지났으면 가장 최근 15분으로 제한한다", () => {
    // When
    const minutes = minutesToSweep({
      lastCompletedAt: minutesAgo(30),
      now: NOW,
      maxCatchUpMinutes: 15,
    });

    // Then
    expect(minutes).toHaveLength(15);
    expect(minutes[0]?.toString()).toBe("2026-11-10T07:16:00Z");
    expect(minutes.at(-1)?.toString()).toBe("2026-11-10T07:30:00Z");
  });
});
