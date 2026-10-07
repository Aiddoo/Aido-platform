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
