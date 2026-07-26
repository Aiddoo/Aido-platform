import type { AdminGrowthMetricsPort } from "../../ports/admin-growth-metrics.port";
import { GetGrowthSummaryQuery } from "./get-growth-summary.query";

describe("GetGrowthSummaryQuery — 관리자 성장 지표", () => {
	it("범위가 없으면 마지막 30개 완료 UTC 날짜를 사용하고 측정 전 리텐션을 null로 반환한다", async () => {
		// Given - 2026-07-26 현재, 아직 활동 측정 행이 없는 저장소
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2026-07-26T12:34:56.000Z"));
		const metrics: AdminGrowthMetricsPort = {
			getSummary: jest.fn().mockResolvedValue({
				measurementStartedAt: null,
				totalActiveUsers: 0,
				signups: 2,
				dau: 0,
				wau: 0,
				mau: 0,
				activationEligible: 2,
				activationAchieved: 1,
				d1Eligible: 0,
				d1Achieved: 0,
				d7Eligible: 0,
				d7Achieved: 0,
				d30Eligible: 0,
				d30Achieved: 0,
				d7RetainedActivatedUsers: 0,
			}),
		};
		const query = new GetGrowthSummaryQuery(metrics);

		try {
			// When - 날짜 입력 없이 성장 요약을 조회하면
			const result = await query.execute({});

			// Then - 어제까지 30일을 조회하고 측정 전 리텐션을 만들지 않는다
			expect(metrics.getSummary).toHaveBeenCalledWith({
				cohortFrom: "2026-06-26",
				cohortTo: "2026-07-25",
				asOf: new Date("2026-07-26T12:34:56.000Z"),
			});
			expect(result).toEqual({
				cohortFrom: "2026-06-26",
				cohortTo: "2026-07-25",
				measurementStartedAt: null,
				totalActiveUsers: 0,
				signups: 2,
				dau: 0,
				wau: 0,
				mau: 0,
				activation24h: { eligible: 2, achieved: 1, rate: 50 },
				d1: null,
				d7: null,
				d30: null,
				d7RetainedActivatedUsers: null,
			});
		} finally {
			jest.useRealTimers();
		}
	});

	it("명시한 cohort 현지 날짜 범위를 그대로 조회한다", async () => {
		// Given - 집계 저장소와 명시적 cohort 범위
		const metrics: AdminGrowthMetricsPort = {
			getSummary: jest.fn().mockResolvedValue({
				measurementStartedAt: null,
				totalActiveUsers: 4,
				signups: 3,
				dau: 1,
				wau: 2,
				mau: 4,
				activationEligible: 3,
				activationAchieved: 0,
				d1Eligible: 0,
				d1Achieved: 0,
				d7Eligible: 0,
				d7Achieved: 0,
				d30Eligible: 0,
				d30Achieved: 0,
				d7RetainedActivatedUsers: 0,
			}),
		};
		const query = new GetGrowthSummaryQuery(metrics);

		// When - 명시 범위로 조회하면
		const result = await query.execute({
			cohortFrom: "2026-05-01",
			cohortTo: "2026-05-31",
		});

		// Then - 같은 범위를 저장소와 응답에 보존한다
		expect(metrics.getSummary).toHaveBeenCalledWith(
			expect.objectContaining({
				cohortFrom: "2026-05-01",
				cohortTo: "2026-05-31",
			}),
		);
		expect(result.cohortFrom).toBe("2026-05-01");
		expect(result.cohortTo).toBe("2026-05-31");
	});

	it("성숙한 retention cohort만 백분율로 반환한다", async () => {
		// Given - D1/D7은 자격 cohort가 있고 D30은 아직 없는 집계
		const measurementStartedAt = new Date("2026-04-01T03:04:05.000Z");
		const metrics: AdminGrowthMetricsPort = {
			getSummary: jest.fn().mockResolvedValue({
				measurementStartedAt,
				totalActiveUsers: 10,
				signups: 6,
				dau: 3,
				wau: 7,
				mau: 10,
				activationEligible: 6,
				activationAchieved: 4,
				d1Eligible: 6,
				d1Achieved: 2,
				d7Eligible: 3,
				d7Achieved: 2,
				d30Eligible: 0,
				d30Achieved: 0,
				d7RetainedActivatedUsers: 1,
			}),
		};
		const query = new GetGrowthSummaryQuery(metrics);

		// When - 성장 지표를 조회하면
		const result = await query.execute({
			cohortFrom: "2026-04-01",
			cohortTo: "2026-04-30",
		});

		// Then - 자격 cohort만 0-100 백분율로 반올림해 노출한다
		expect(result).toMatchObject({
			measurementStartedAt: "2026-04-01T03:04:05.000Z",
			activation24h: { eligible: 6, achieved: 4, rate: 66.67 },
			d1: { eligible: 6, achieved: 2, rate: 33.33 },
			d7: { eligible: 3, achieved: 2, rate: 66.67 },
			d30: null,
			d7RetainedActivatedUsers: 1,
		});
	});
});
