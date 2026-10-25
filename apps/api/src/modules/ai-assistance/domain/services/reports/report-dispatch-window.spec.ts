import { isInReportDispatchWindow, reportDispatchPeriodId } from "./report-dispatch-window.js";

describe("isInReportDispatchWindow", () => {
  it.each([
    {
      name: "KST 월요일 00:05는 주간 디스패치 대상이다",
      at: "2026-10-25T15:05:00Z",
      timezone: "Asia/Seoul",
      expected: true,
    },
    {
      name: "같은 순간 LA는 아직 일요일이라 대상이 아니다",
      at: "2026-10-25T15:05:00Z",
      timezone: "America/Los_Angeles",
      expected: false,
    },
    {
      name: "LA 월요일 00:05(PDT)는 대상이다",
      at: "2026-10-26T07:05:00Z",
      timezone: "America/Los_Angeles",
      expected: true,
    },
    {
      name: "서머타임이 끝난 다음 월요일 LA 00:05(PST)도 대상이다",
      at: "2026-11-02T08:05:00Z",
      timezone: "America/Los_Angeles",
      expected: true,
    },
    {
      name: "45분 오프셋 시간대도 로컬 월요일 자정 직후에 대상이다",
      at: "2026-10-25T18:20:00Z",
      timezone: "Asia/Kathmandu",
      expected: true,
    },
    {
      name: "로컬 월요일 06시 이후는 창을 벗어난다",
      at: "2026-10-25T21:00:00Z",
      timezone: "Asia/Seoul",
      expected: false,
    },
  ])("$name", ({ at, timezone, expected }) => {
    // Given
    const instant = new Date(at);
    // When
    const result = isInReportDispatchWindow("WEEKLY", instant, timezone);
    // Then
    expect(result).toBe(expected);
  });

  it.each([
    {
      name: "LA 11월 1일 00:05(서머타임 종료일)는 월간 대상이다",
      at: "2026-11-01T07:05:00Z",
      timezone: "America/Los_Angeles",
      expected: true,
    },
    {
      name: "같은 순간 서울은 이미 1일 16시라 창을 벗어난다",
      at: "2026-11-01T07:05:00Z",
      timezone: "Asia/Seoul",
      expected: false,
    },
    {
      name: "윤년 2월 29일은 월간 대상이 아니다",
      at: "2028-02-28T15:30:00Z",
      timezone: "Asia/Seoul",
      expected: false,
    },
    {
      name: "윤년 다음 3월 1일 자정 직후는 월간 대상이다",
      at: "2028-02-29T15:30:00Z",
      timezone: "Asia/Seoul",
      expected: true,
    },
    {
      name: "연말을 넘긴 1월 1일 자정 직후는 월간 대상이다",
      at: "2026-12-31T15:10:00Z",
      timezone: "Asia/Seoul",
      expected: true,
    },
  ])("$name", ({ at, timezone, expected }) => {
    // Given
    const instant = new Date(at);
    // When
    const result = isInReportDispatchWindow("MONTHLY", instant, timezone);
    // Then
    expect(result).toBe(expected);
  });
});

describe("reportDispatchPeriodId", () => {
  it("사용자 로컬 주차로 멱등 키 주기를 만든다", () => {
    // Given - UTC로는 일요일, 서울로는 월요일인 순간
    const at = new Date("2026-10-25T15:05:00Z");
    // When
    const seoul = reportDispatchPeriodId("WEEKLY", at, "Asia/Seoul");
    const losAngeles = reportDispatchPeriodId("WEEKLY", at, "America/Los_Angeles");
    // Then
    expect(seoul).toBe("2026-W44");
    expect(losAngeles).toBe("2026-W43");
  });

  it("연말 주차와 새해 월을 로컬 기준으로 계산한다", () => {
    // Given
    const lastIsoWeek = new Date("2026-12-27T15:05:00Z");
    const newYear = new Date("2026-12-31T15:10:00Z");
    // When
    const week = reportDispatchPeriodId("WEEKLY", lastIsoWeek, "Asia/Seoul");
    const month = reportDispatchPeriodId("MONTHLY", newYear, "Asia/Seoul");
    // Then
    expect(week).toBe("2026-W53");
    expect(month).toBe("2027-M01");
  });
});

describe("report-dispatch-window — ISO 53주차·윤일·서머타임 경계", () => {
  it.each([
    {
      name: "서울 2027-01-04(월) 00:10은 53주차 다음인 2027-W01 주기이다",
      at: "2027-01-03T15:10:00Z",
      timezone: "Asia/Seoul",
      periodId: "2027-W01",
      inWindow: true,
    },
    {
      name: "같은 순간 LA는 일요일이라 2026-W53 주기이며 대상이 아니다",
      at: "2027-01-03T15:10:00Z",
      timezone: "America/Los_Angeles",
      periodId: "2026-W53",
      inWindow: false,
    },
    {
      name: "서울 2026-12-28(월) 00:10은 2026-W53 주기이다",
      at: "2026-12-27T15:10:00Z",
      timezone: "Asia/Seoul",
      periodId: "2026-W53",
      inWindow: true,
    },
    {
      name: "LA 봄 전환 다음 월요일 00:05 PDT는 대상이다",
      at: "2028-03-13T07:05:00Z",
      timezone: "America/Los_Angeles",
      periodId: "2028-W11",
      inWindow: true,
    },
    {
      name: "LA 가을 전환 다음 월요일 00:05 PST는 대상이다",
      at: "2028-11-06T08:05:00Z",
      timezone: "America/Los_Angeles",
      periodId: "2028-W45",
      inWindow: true,
    },
    {
      name: "서울 월요일 05:59:59는 창 안이다",
      at: "2027-01-03T20:59:59Z",
      timezone: "Asia/Seoul",
      periodId: "2027-W01",
      inWindow: true,
    },
    {
      name: "서울 월요일 06:00:00은 창 밖이다",
      at: "2027-01-03T21:00:00Z",
      timezone: "Asia/Seoul",
      periodId: "2027-W01",
      inWindow: false,
    },
    {
      name: "서울 일요일 23:59:59는 창 밖이고 직전 주기이다",
      at: "2027-01-03T14:59:59Z",
      timezone: "Asia/Seoul",
      periodId: "2026-W53",
      inWindow: false,
    },
  ])("주간: $name", ({ at, timezone, periodId, inWindow }) => {
    // Given
    const instant = new Date(at);
    // When
    const result = {
      periodId: reportDispatchPeriodId("WEEKLY", instant, timezone),
      inWindow: isInReportDispatchWindow("WEEKLY", instant, timezone),
    };
    // Then
    expect(result).toEqual({ periodId, inWindow });
  });

  it.each([
    {
      name: "서울 2028-03-01 00:00:00은 2028-M03 주기이다",
      at: "2028-02-29T15:00:00Z",
      timezone: "Asia/Seoul",
      periodId: "2028-M03",
      inWindow: true,
    },
    {
      name: "서울 2028-02-29 23:59:59는 2028-M02 주기이며 대상이 아니다",
      at: "2028-02-29T14:59:59Z",
      timezone: "Asia/Seoul",
      periodId: "2028-M02",
      inWindow: false,
    },
    {
      name: "LA 2027-01-01 00:10은 2027-M01 주기이다",
      at: "2027-01-01T08:10:00Z",
      timezone: "America/Los_Angeles",
      periodId: "2027-M01",
      inWindow: true,
    },
    {
      name: "LA 2028-04-01 00:10 PDT는 2028-M04 주기이다",
      at: "2028-04-01T07:10:00Z",
      timezone: "America/Los_Angeles",
      periodId: "2028-M04",
      inWindow: true,
    },
  ])("월간: $name", ({ at, timezone, periodId, inWindow }) => {
    // Given
    const instant = new Date(at);
    // When
    const result = {
      periodId: reportDispatchPeriodId("MONTHLY", instant, timezone),
      inWindow: isInReportDispatchWindow("MONTHLY", instant, timezone),
    };
    // Then
    expect(result).toEqual({ periodId, inWindow });
  });
});
