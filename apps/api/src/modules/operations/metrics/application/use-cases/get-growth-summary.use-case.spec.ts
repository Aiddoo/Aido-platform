import { FixedClock } from "#test/doubles/platform/fixed-clock";

import type {
  GrowthMetricsReaderPort,
  GrowthSummaryCounts,
} from "../ports/growth-metrics.reader.port.js";
import { GetGrowthSummaryUseCase } from "./get-growth-summary.use-case.js";

const AS_OF = Temporal.Instant.from("2026-07-26T12:34:56Z");

function createCounts(overrides: Partial<GrowthSummaryCounts> = {}): GrowthSummaryCounts {
  return {
    measurementStartedAt: null,
    totalActiveUsers: 0,
    signups: 0,
    dau: 0,
    wau: 0,
    mau: 0,
    activationEligible: 0,
    activationAchieved: 0,
    d1Eligible: 0,
    d1Achieved: 0,
    d7Eligible: 0,
    d7Achieved: 0,
    d30Eligible: 0,
    d30Achieved: 0,
    d7RetainedActivatedUsers: 0,
    ...overrides,
  };
}

// 요청받은 범위를 기록하고 정해 둔 집계를 돌려주는 리더
class StubGrowthMetricsReader implements Pick<GrowthMetricsReaderPort, "getSummaryCounts"> {
  readonly requests: Parameters<GrowthMetricsReaderPort["getSummaryCounts"]>[0][] = [];
  readonly #counts: GrowthSummaryCounts;

  constructor(counts: GrowthSummaryCounts) {
    this.#counts = counts;
  }

  async getSummaryCounts(params: Parameters<GrowthMetricsReaderPort["getSummaryCounts"]>[0]) {
    this.requests.push(params);
    return this.#counts;
  }
}

function createUseCase(counts: GrowthSummaryCounts) {
  const metricsReader = new StubGrowthMetricsReader(counts);
  return {
    metricsReader,
    useCase: new GetGrowthSummaryUseCase({ metricsReader, clock: new FixedClock(AS_OF) }),
  };
}

describe("GetGrowthSummaryUseCase — 관리자 성장 지표", () => {
  it("범위가 없으면 어제까지 마지막 30개 UTC 날짜를 쓰고 측정 전 리텐션을 null로 둔다", async () => {
    // Given
    const { useCase, metricsReader } = createUseCase(
      createCounts({ signups: 2, activationEligible: 2, activationAchieved: 1 }),
    );

    // When
    const summary = await useCase.execute({});

    // Then
    expect(metricsReader.requests).toEqual([
      {
        cohortFrom: Temporal.PlainDate.from("2026-06-26"),
        cohortTo: Temporal.PlainDate.from("2026-07-25"),
        asOf: AS_OF,
      },
    ]);
    expect(summary).toMatchObject({
      signups: 2,
      activation24h: { eligible: 2, achieved: 1, rate: 50 },
      d1: null,
      d7: null,
      d30: null,
      d7RetainedActivatedUsers: null,
      stickiness: 0,
    });
  });

  it("명시한 cohort 현지 날짜 범위를 그대로 조회하고 응답에 보존한다", async () => {
    // Given
    const { useCase, metricsReader } = createUseCase(createCounts());
    const cohortFrom = Temporal.PlainDate.from("2026-05-01");
    const cohortTo = Temporal.PlainDate.from("2026-05-31");

    // When
    const summary = await useCase.execute({ cohortFrom, cohortTo });

    // Then
    expect(metricsReader.requests[0]).toMatchObject({ cohortFrom, cohortTo });
    expect(summary.cohortFrom.equals(cohortFrom)).toBe(true);
    expect(summary.cohortTo.equals(cohortTo)).toBe(true);
  });

  it("측정이 시작된 뒤 대상이 있는 리텐션만 달성률로 계산하고 stickiness를 더한다", async () => {
    // Given
    const { useCase } = createUseCase(
      createCounts({
        measurementStartedAt: Temporal.Instant.from("2026-06-15T00:12:34Z"),
        dau: 35,
        mau: 120,
        d1Eligible: 40,
        d1Achieved: 18,
        d7Eligible: 30,
        d7Achieved: 9,
        d7RetainedActivatedUsers: 7,
        d30Eligible: 0,
      }),
    );

    // When
    const summary = await useCase.execute({});

    // Then
    expect(summary).toMatchObject({
      stickiness: 29.17,
      d1: { eligible: 40, achieved: 18, rate: 45 },
      d7: { eligible: 30, achieved: 9, rate: 30 },
      d30: null,
      d7RetainedActivatedUsers: 7,
    });
  });
});
