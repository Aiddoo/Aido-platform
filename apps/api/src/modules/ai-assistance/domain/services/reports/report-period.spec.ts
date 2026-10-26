import type { ReportType } from "../../types/reports/ai-report.types.js";
import { computeDateRange } from "./report-period.js";

describe("computeDateRange", () => {
  it("WEEKLY 타입일 때 월요일 ~ 일요일 범위를 반환해야 한다", () => {
    const result = computeDateRange("WEEKLY", 2026, 10);

    expect(result.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.startDate < result.endDate).toBe(true);
  });

  it("MONTHLY 타입일 때 해당 월 1일 ~ 마지막 날 범위를 반환해야 한다", () => {
    const result = computeDateRange("MONTHLY", 2026, 3);

    expect(result.startDate).toBe("2026-03-01");
    expect(result.endDate).toBe("2026-03-31");
  });

  it("MONTHLY 타입으로 2월 범위를 올바르게 계산해야 한다 (28일/29일)", () => {
    const result = computeDateRange("MONTHLY", 2026, 2);

    expect(result.startDate).toBe("2026-02-01");
    expect(result.endDate).toBe("2026-02-28");
  });
});

describe("computeDateRange — 달력 경계는 호출 시각과 무관하다", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const NOWS = [
    "2026-01-01T00:00:00Z",
    "2026-12-31T23:59:59Z",
    "2027-01-01T00:00:00Z",
    "2028-01-31T12:00:00Z",
    "2028-02-29T12:00:00Z",
    "2028-10-31T12:00:00Z",
  ];

  it.each([
    { type: "WEEKLY", year: 2026, period: 53, start: "2026-12-28", end: "2027-01-03" },
    { type: "WEEKLY", year: 2027, period: 1, start: "2027-01-04", end: "2027-01-10" },
    { type: "WEEKLY", year: 2026, period: 1, start: "2025-12-29", end: "2026-01-04" },
    { type: "WEEKLY", year: 2026, period: 52, start: "2026-12-21", end: "2026-12-27" },
    { type: "MONTHLY", year: 2028, period: 2, start: "2028-02-01", end: "2028-02-29" },
    { type: "MONTHLY", year: 2027, period: 2, start: "2027-02-01", end: "2027-02-28" },
    { type: "MONTHLY", year: 2026, period: 12, start: "2026-12-01", end: "2026-12-31" },
  ] satisfies { type: ReportType; year: number; period: number; start: string; end: string }[])(
    "Given $year $type $period When 어느 시각에 계산해도 Then $start ~ $end 이다",
    ({ type, year, period, start, end }) => {
      for (const now of NOWS) {
        // Given
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(now));
        // When
        const result = computeDateRange(type, year, period);
        // Then
        expect({ now, ...result }).toEqual({ now, startDate: start, endDate: end });
      }
    },
  );
});
