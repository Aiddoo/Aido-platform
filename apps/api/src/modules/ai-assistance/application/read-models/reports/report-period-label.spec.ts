import { computePeriodLabel } from "./report-period-label.js";

describe("computePeriodLabel — en 로케일", () => {
  it("en 주간 라벨은 'Week N, YYYY' 형식이다", () => {
    expect(computePeriodLabel("WEEKLY", 2026, 10, "en")).toBe("Week 10, 2026");
  });

  it("en 월간 라벨은 영어 월 이름을 사용한다", () => {
    expect(computePeriodLabel("MONTHLY", 2026, 3, "en")).toBe("March 2026");
  });

  it("locale 생략 시 한국어 라벨을 유지한다 (하위 호환)", () => {
    expect(computePeriodLabel("WEEKLY", 2026, 10)).toBe("2026년 10주차");
    expect(computePeriodLabel("MONTHLY", 2026, 3)).toBe("2026년 3월");
  });
});

describe("computePeriodLabel", () => {
  it("WEEKLY 타입일 때 '년 주차' 형식으로 반환해야 한다", () => {
    expect(computePeriodLabel("WEEKLY", 2026, 10)).toBe("2026년 10주차");
  });

  it("MONTHLY 타입일 때 '년 월' 형식으로 반환해야 한다", () => {
    expect(computePeriodLabel("MONTHLY", 2026, 3)).toBe("2026년 3월");
  });

  it("1주차를 올바르게 표현해야 한다", () => {
    expect(computePeriodLabel("WEEKLY", 2026, 1)).toBe("2026년 1주차");
  });
});
