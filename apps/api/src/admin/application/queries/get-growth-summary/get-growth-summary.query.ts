import type { GrowthSummaryQuery, GrowthSummaryResponse } from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";

import { subtractDays } from "@/shared/domain/date/utils/arithmetic";
import { now } from "@/shared/domain/date/utils/core";
import { toDateString, toISOStringOrNull } from "@/shared/domain/date/utils/format";

import {
	ADMIN_GROWTH_METRICS,
	type AdminGrowthMetricsPort,
} from "../../ports/admin-growth-metrics.port";

const DEFAULT_COHORT_DAYS = 30;

function metric(eligible: number, achieved: number) {
	return {
		eligible,
		achieved,
		rate: eligible === 0 ? 0 : Math.round((achieved / eligible) * 10_000) / 100,
	};
}

@Injectable()
export class GetGrowthSummaryQuery {
	constructor(
		@Inject(ADMIN_GROWTH_METRICS)
		private readonly metrics: AdminGrowthMetricsPort,
	) {}

	async execute(input: GrowthSummaryQuery): Promise<GrowthSummaryResponse> {
		const asOf = now();
		const defaultTo = subtractDays(1, asOf);
		const cohortTo = input.cohortTo ?? toDateString(defaultTo);
		const cohortFrom =
			input.cohortFrom ?? toDateString(subtractDays(DEFAULT_COHORT_DAYS - 1, defaultTo));
		const summary = await this.metrics.getSummary({
			cohortFrom,
			cohortTo,
			asOf,
		});
		const hasMeasurement = summary.measurementStartedAt !== null;

		return {
			cohortFrom,
			cohortTo,
			measurementStartedAt: toISOStringOrNull(summary.measurementStartedAt),
			totalActiveUsers: summary.totalActiveUsers,
			signups: summary.signups,
			dau: summary.dau,
			wau: summary.wau,
			mau: summary.mau,
			activation24h: metric(summary.activationEligible, summary.activationAchieved),
			d1:
				hasMeasurement && summary.d1Eligible > 0
					? metric(summary.d1Eligible, summary.d1Achieved)
					: null,
			d7:
				hasMeasurement && summary.d7Eligible > 0
					? metric(summary.d7Eligible, summary.d7Achieved)
					: null,
			d30:
				hasMeasurement && summary.d30Eligible > 0
					? metric(summary.d30Eligible, summary.d30Achieved)
					: null,
			d7RetainedActivatedUsers:
				hasMeasurement && summary.d7Eligible > 0 ? summary.d7RetainedActivatedUsers : null,
		};
	}
}
