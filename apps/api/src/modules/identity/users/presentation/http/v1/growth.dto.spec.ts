import {
  growthSummaryQuerySchema,
  growthSummaryResponseSchema,
} from "@aido/api/contracts/admin/v1";

describe("관리자 성장 지표 스키마", () => {
  it("cohort 조회 범위를 최대 90개 현지 날짜로 제한한다", () => {
    // When
    const ninetyDays = growthSummaryQuerySchema.safeParse({
      cohortFrom: "2026-01-01",
      cohortTo: "2026-03-31",
    });
    const ninetyOneDays = growthSummaryQuerySchema.safeParse({
      cohortFrom: "2026-01-01",
      cohortTo: "2026-04-01",
    });

    // Then
    expect(ninetyDays.success).toBe(true);
    expect(ninetyOneDays.success).toBe(false);
  });

  it("cohort 시작일과 종료일은 함께 전달하도록 강제한다", () => {
    // When
    const omitted = growthSummaryQuerySchema.safeParse({});
    const onlyFrom = growthSummaryQuerySchema.safeParse({
      cohortFrom: "2026-01-01",
    });
    const onlyTo = growthSummaryQuerySchema.safeParse({
      cohortTo: "2026-01-30",
    });

    // Then
    // 전체 생략은 기본 범위를 위해 허용하고 부분 범위는 거부한다
    expect(omitted.success).toBe(true);
    expect(onlyFrom.success).toBe(false);
    expect(onlyTo.success).toBe(false);
  });

  it("cohort 시작일이 종료일보다 늦으면 거부한다", () => {
    // When
    const result = growthSummaryQuerySchema.safeParse({
      cohortFrom: "2026-02-01",
      cohortTo: "2026-01-31",
    });

    // Then
    expect(result.success).toBe(false);
  });

  it("측정 전 상태와 집계율을 식별자 없이 표현한다", () => {
    // When
    const result = growthSummaryResponseSchema.safeParse({
      cohortFrom: "2026-06-26",
      cohortTo: "2026-07-25",
      measurementStartedAt: null,
      totalActiveUsers: 0,
      signups: 2,
      dau: 0,
      wau: 0,
      mau: 0,
      stickiness: 0,
      activation24h: { eligible: 2, achieved: 1, rate: 50 },
      d1: null,
      d7: null,
      d30: null,
      d7RetainedActivatedUsers: null,
    });

    // Then

    expect(result.success).toBe(true);
  });
});
