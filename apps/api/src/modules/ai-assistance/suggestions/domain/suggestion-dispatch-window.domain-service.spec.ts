import { NIGHT_TIME_CONFIG } from "@aido/api/vocabulary";
import { range } from "es-toolkit";

import { createSuggestionAnalysisRunFixture } from "#test/fixtures/ai-assistance/suggestion-analysis-run.fixture";

import {
  isInSuggestionDispatchWindow,
  nextSuggestionDispatchAt,
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
    expect(seoul.toString()).toBe("2026-11-10");
    expect(losAngeles.toString()).toBe("2026-11-09");
  });
});

describe("nextSuggestionDispatchAt", () => {
  it.each([
    {
      label: "서울 08:59 → 오늘 09:00",
      at: "2026-11-09T23:59:00Z",
      timeZone: "Asia/Seoul",
      expected: "2026-11-10T00:00:00Z",
    },
    {
      label: "서울 09:00 → 내일 09:00",
      at: "2026-11-10T00:00:00Z",
      timeZone: "Asia/Seoul",
      expected: "2026-11-11T00:00:00Z",
    },
    {
      label: "서울 14:00 → 내일 09:00",
      at: "2026-11-10T05:00:00Z",
      timeZone: "Asia/Seoul",
      expected: "2026-11-11T00:00:00Z",
    },
    {
      label: "LA 08:59(PST) → 오늘 09:00",
      at: "2026-11-10T16:59:00Z",
      timeZone: "America/Los_Angeles",
      expected: "2026-11-10T17:00:00Z",
    },
    {
      label: "LA 10:00(PST) → 내일 09:00",
      at: "2026-11-10T18:00:00Z",
      timeZone: "America/Los_Angeles",
      expected: "2026-11-11T17:00:00Z",
    },
    {
      label: "LA 서머타임 시작 전날 10:00(PST) → 2027-03-14 09:00(PDT)",
      at: "2027-03-13T18:00:00Z",
      timeZone: "America/Los_Angeles",
      expected: "2027-03-14T16:00:00Z",
    },
    {
      label: "LA 서머타임 끝 전날 10:00(PDT) → 2026-11-01 09:00(PST)",
      at: "2026-10-31T17:00:00Z",
      timeZone: "America/Los_Angeles",
      expected: "2026-11-01T17:00:00Z",
    },
    {
      label: "서울 평년 2월 28일 10:00 → 3월 1일",
      at: "2027-02-28T01:00:00Z",
      timeZone: "Asia/Seoul",
      expected: "2027-03-01T00:00:00Z",
    },
    {
      label: "서울 윤년 2월 28일 10:00 → 2월 29일",
      at: "2028-02-28T01:00:00Z",
      timeZone: "Asia/Seoul",
      expected: "2028-02-29T00:00:00Z",
    },
    {
      label: "서울 12월 31일 10:00 → 다음 해 1월 1일",
      at: "2026-12-31T01:00:00Z",
      timeZone: "Asia/Seoul",
      expected: "2027-01-01T00:00:00Z",
    },
    {
      label: "콜카타(+5:30) 09:10 → 오늘 UTC 정각 회차 09:30",
      at: "2026-11-10T03:40:00Z",
      timeZone: "Asia/Kolkata",
      expected: "2026-11-10T04:00:00Z",
    },
    {
      label: "콜카타(+5:30) 09:30 → 내일 09:30",
      at: "2026-11-10T04:00:00Z",
      timeZone: "Asia/Kolkata",
      expected: "2026-11-11T04:00:00Z",
    },
    {
      label: "카트만두(+5:45) 08:50 → 오늘 UTC 정각 회차 09:45",
      at: "2026-11-10T03:05:00Z",
      timeZone: "Asia/Kathmandu",
      expected: "2026-11-10T04:00:00Z",
    },
  ])("$label", ({ at, timeZone, expected }) => {
    // When
    const next = nextSuggestionDispatchAt({
      at: Temporal.Instant.from(at),
      timeZone,
      run: null,
    });

    // Then
    expect(next.toString()).toBe(expected);
  });
});

describe("nextSuggestionDispatchAt 오늘 요청 기록이 있을 때", () => {
  it.each([
    {
      label: "서울 08:59에 끝난 기록 → 내일 09:00",
      status: "FINISHED" as const,
      at: "2026-11-09T23:59:00Z",
      timeZone: "Asia/Seoul",
      localDate: "2026-11-10",
      expected: "2026-11-11T00:00:00Z",
    },
    {
      label: "서울 14:00 도는 중 → 내일 09:00",
      status: "RUNNING" as const,
      at: "2026-11-10T05:00:00Z",
      timeZone: "Asia/Seoul",
      localDate: "2026-11-10",
      expected: "2026-11-11T00:00:00Z",
    },
    {
      label: "서울 10:00 멈춘 대기 → 내일 09:00",
      status: "QUEUED" as const,
      at: "2026-11-10T01:00:00Z",
      timeZone: "Asia/Seoul",
      localDate: "2026-11-10",
      expected: "2026-11-11T00:00:00Z",
    },
    {
      label: "LA 14:00(PST) 끝난 기록 → 내일 09:00",
      status: "FINISHED" as const,
      at: "2026-11-10T22:00:00Z",
      timeZone: "America/Los_Angeles",
      localDate: "2026-11-10",
      expected: "2026-11-11T17:00:00Z",
    },
    {
      label: "LA 서머타임 시작 전날 10:00 끝난 기록 → 2027-03-14 09:00(PDT)",
      status: "FINISHED" as const,
      at: "2027-03-13T18:00:00Z",
      timeZone: "America/Los_Angeles",
      localDate: "2027-03-13",
      expected: "2027-03-14T16:00:00Z",
    },
    {
      label: "서울 12월 31일 끝난 기록 → 다음 해 1월 1일 09:00",
      status: "FINISHED" as const,
      at: "2026-12-31T05:00:00Z",
      timeZone: "Asia/Seoul",
      localDate: "2026-12-31",
      expected: "2027-01-01T00:00:00Z",
    },
  ])("$label", ({ status, at, timeZone, localDate, expected }) => {
    // Given
    const run = createSuggestionAnalysisRunFixture({
      status,
      localDate: Temporal.PlainDate.from(localDate),
    });

    // When
    const next = nextSuggestionDispatchAt({ at: Temporal.Instant.from(at), timeZone, run });

    // Then
    expect(next.toString()).toBe(expected);
  });

  it("어제 기록만 있으면 오늘 09시 전에는 오늘 09:00이다", () => {
    // Given
    const run = createSuggestionAnalysisRunFixture({
      status: "FINISHED",
      localDate: Temporal.PlainDate.from("2026-11-09"),
    });

    // When
    const next = nextSuggestionDispatchAt({
      at: Temporal.Instant.from("2026-11-09T23:59:00Z"),
      timeZone: "Asia/Seoul",
      run,
    });

    // Then
    expect(next.toString()).toBe("2026-11-10T00:00:00Z");
  });
});
