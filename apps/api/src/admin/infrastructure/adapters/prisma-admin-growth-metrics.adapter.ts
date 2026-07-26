import { Injectable } from "@nestjs/common";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";
import type {
	AdminGrowthMetricsPort,
	AdminGrowthSummaryCounts,
} from "../../application/ports/admin-growth-metrics.port";

interface GrowthSummaryRow {
	readonly measurementStartedAt: Date | null;
	readonly totalActiveUsers: bigint;
	readonly signups: bigint;
	readonly dau: bigint;
	readonly wau: bigint;
	readonly mau: bigint;
	readonly activationEligible: bigint;
	readonly activationAchieved: bigint;
	readonly d1Eligible: bigint;
	readonly d1Achieved: bigint;
	readonly d7Eligible: bigint;
	readonly d7Achieved: bigint;
	readonly d30Eligible: bigint;
	readonly d30Achieved: bigint;
	readonly d7RetainedActivatedUsers: bigint;
}

/**
 * 관리자 성장 지표용 PostgreSQL read-model 어댑터.
 *
 * 가입 cohort 날짜는 사용자의 첫 활동 행 타임존(없으면 현재 선호, 이후 UTC)으로
 * 계산하고, retention 달성은 이미 정규화된 UserActivityDay.localDate로 판정한다.
 */
@Injectable()
export class PrismaAdminGrowthMetricsAdapter implements AdminGrowthMetricsPort {
	constructor(private readonly database: DatabaseService) {}

	async getSummary(input: {
		readonly cohortFrom: string;
		readonly cohortTo: string;
		readonly asOf: Date;
	}): Promise<AdminGrowthSummaryCounts> {
		const rows = await this.database.$queryRaw<GrowthSummaryRow[]>`
			WITH measurement AS (
				SELECT (
					SELECT activity."firstSeenAt"
					FROM "UserActivityDay" AS activity
					ORDER BY activity."firstSeenAt" ASC, activity."id" ASC
					LIMIT 1
				) AS "measurementStartedAt"
			),
			candidate_users AS (
				SELECT
					app_user."id",
					app_user."createdAt"
				FROM "User" AS app_user
				WHERE app_user."deletedAt" IS NULL
					AND app_user."createdAt" >=
						${input.cohortFrom}::DATE - INTERVAL '14 hours'
					AND app_user."createdAt" <
						${input.cohortTo}::DATE + INTERVAL '36 hours'
			),
			localized_users AS (
				SELECT
					candidate."id",
					candidate."createdAt",
					(
						candidate."createdAt" AT TIME ZONE 'UTC'
							AT TIME ZONE COALESCE(
								valid_activity_timezone.name,
								valid_preference_timezone.name,
								'UTC'
							)
					)::DATE AS "signupLocalDate",
					(
						${input.asOf}::TIMESTAMPTZ AT TIME ZONE COALESCE(
							valid_activity_timezone.name,
							valid_preference_timezone.name,
							'UTC'
						)
					)::DATE AS "asOfLocalDate"
				FROM candidate_users AS candidate
				LEFT JOIN LATERAL (
					SELECT activity."timezone"
					FROM "UserActivityDay" AS activity
					WHERE activity."userId" = candidate."id"
					ORDER BY activity."firstSeenAt" ASC, activity."id" ASC
					LIMIT 1
				) AS first_activity ON TRUE
				LEFT JOIN "UserPreference" AS preference
					ON preference."userId" = candidate."id"
				LEFT JOIN pg_timezone_names AS valid_activity_timezone
					ON valid_activity_timezone.name = first_activity."timezone"
				LEFT JOIN pg_timezone_names AS valid_preference_timezone
					ON valid_preference_timezone.name = preference."timezone"
			),
			cohort_users AS (
				SELECT
					localized."id",
					localized."createdAt",
					localized."signupLocalDate",
					localized."asOfLocalDate",
					(
						EXISTS (
							SELECT 1
							FROM "Todo" AS created_todo
							WHERE created_todo."userId" = localized."id"
								AND created_todo."createdAt" >= localized."createdAt"
								AND created_todo."createdAt" <= localized."createdAt" + INTERVAL '24 hours'
						)
						AND EXISTS (
							SELECT 1
							FROM "Todo" AS completed_todo
							WHERE completed_todo."userId" = localized."id"
								AND completed_todo."completedAt" >= localized."createdAt"
								AND completed_todo."completedAt" <= localized."createdAt" + INTERVAL '24 hours'
						)
					) AS "activationAchieved",
					EXISTS (
						SELECT 1
						FROM "UserActivityDay" AS d1_activity
						WHERE d1_activity."userId" = localized."id"
							AND d1_activity."localDate" = localized."signupLocalDate" + 1
					) AS "d1Achieved",
					EXISTS (
						SELECT 1
						FROM "UserActivityDay" AS d7_activity
						WHERE d7_activity."userId" = localized."id"
							AND d7_activity."localDate" = localized."signupLocalDate" + 7
					) AS "d7Achieved",
					EXISTS (
						SELECT 1
						FROM "UserActivityDay" AS d30_activity
						WHERE d30_activity."userId" = localized."id"
							AND d30_activity."localDate" = localized."signupLocalDate" + 30
					) AS "d30Achieved"
				FROM localized_users AS localized
				WHERE localized."signupLocalDate"
					BETWEEN ${input.cohortFrom}::DATE AND ${input.cohortTo}::DATE
			),
			activity_candidates AS (
				SELECT
					activity."userId",
					activity."localDate"
				FROM "UserActivityDay" AS activity
				INNER JOIN "User" AS active_user
					ON active_user."id" = activity."userId"
					AND active_user."deletedAt" IS NULL
				WHERE activity."localDate" BETWEEN
					LEAST(
						${input.cohortFrom}::DATE,
						${input.cohortTo}::DATE - 29
					)
					AND ${input.cohortTo}::DATE
			),
			active_counts AS (
				SELECT
					COUNT(DISTINCT activity."userId") FILTER (
						WHERE activity."localDate"
							BETWEEN ${input.cohortFrom}::DATE AND ${input.cohortTo}::DATE
					)::BIGINT AS "totalActiveUsers",
					COUNT(DISTINCT activity."userId") FILTER (
						WHERE activity."localDate" = ${input.cohortTo}::DATE
					)::BIGINT AS "dau",
					COUNT(DISTINCT activity."userId") FILTER (
						WHERE activity."localDate"
							BETWEEN ${input.cohortTo}::DATE - 6 AND ${input.cohortTo}::DATE
					)::BIGINT AS "wau",
					COUNT(DISTINCT activity."userId") FILTER (
						WHERE activity."localDate"
							BETWEEN ${input.cohortTo}::DATE - 29 AND ${input.cohortTo}::DATE
					)::BIGINT AS "mau"
				FROM activity_candidates AS activity
			),
			cohort_counts AS (
				SELECT
					COUNT(*)::BIGINT AS "signups",
					COUNT(*) FILTER (
						WHERE cohort."createdAt" + INTERVAL '24 hours' <= ${input.asOf}
					)::BIGINT AS "activationEligible",
					COUNT(*) FILTER (
						WHERE cohort."createdAt" + INTERVAL '24 hours' <= ${input.asOf}
							AND cohort."activationAchieved"
					)::BIGINT AS "activationAchieved",
					COUNT(*) FILTER (
						WHERE measurement."measurementStartedAt" IS NOT NULL
							AND cohort."createdAt" >= measurement."measurementStartedAt"
							AND cohort."signupLocalDate" + 1 < cohort."asOfLocalDate"
					)::BIGINT AS "d1Eligible",
					COUNT(*) FILTER (
						WHERE measurement."measurementStartedAt" IS NOT NULL
							AND cohort."createdAt" >= measurement."measurementStartedAt"
							AND cohort."signupLocalDate" + 1 < cohort."asOfLocalDate"
							AND cohort."d1Achieved"
					)::BIGINT AS "d1Achieved",
					COUNT(*) FILTER (
						WHERE measurement."measurementStartedAt" IS NOT NULL
							AND cohort."createdAt" >= measurement."measurementStartedAt"
							AND cohort."signupLocalDate" + 7 < cohort."asOfLocalDate"
					)::BIGINT AS "d7Eligible",
					COUNT(*) FILTER (
						WHERE measurement."measurementStartedAt" IS NOT NULL
							AND cohort."createdAt" >= measurement."measurementStartedAt"
							AND cohort."signupLocalDate" + 7 < cohort."asOfLocalDate"
							AND cohort."d7Achieved"
					)::BIGINT AS "d7Achieved",
					COUNT(*) FILTER (
						WHERE measurement."measurementStartedAt" IS NOT NULL
							AND cohort."createdAt" >= measurement."measurementStartedAt"
							AND cohort."signupLocalDate" + 30 < cohort."asOfLocalDate"
					)::BIGINT AS "d30Eligible",
					COUNT(*) FILTER (
						WHERE measurement."measurementStartedAt" IS NOT NULL
							AND cohort."createdAt" >= measurement."measurementStartedAt"
							AND cohort."signupLocalDate" + 30 < cohort."asOfLocalDate"
							AND cohort."d30Achieved"
					)::BIGINT AS "d30Achieved",
					COUNT(*) FILTER (
						WHERE measurement."measurementStartedAt" IS NOT NULL
							AND cohort."createdAt" >= measurement."measurementStartedAt"
							AND cohort."signupLocalDate" + 7 < cohort."asOfLocalDate"
							AND cohort."activationAchieved"
							AND cohort."d7Achieved"
					)::BIGINT AS "d7RetainedActivatedUsers"
				FROM cohort_users AS cohort
				CROSS JOIN measurement
			)
			SELECT
				measurement."measurementStartedAt",
				active_counts."totalActiveUsers",
				cohort_counts."signups",
				active_counts."dau",
				active_counts."wau",
				active_counts."mau",
				cohort_counts."activationEligible",
				cohort_counts."activationAchieved",
				cohort_counts."d1Eligible",
				cohort_counts."d1Achieved",
				cohort_counts."d7Eligible",
				cohort_counts."d7Achieved",
				cohort_counts."d30Eligible",
				cohort_counts."d30Achieved",
				cohort_counts."d7RetainedActivatedUsers"
			FROM measurement
			CROSS JOIN active_counts
			CROSS JOIN cohort_counts
		`;
		const row = rows[0];
		if (!row) {
			throw new Error("growth summary aggregate returned no row");
		}

		return {
			measurementStartedAt: row.measurementStartedAt,
			totalActiveUsers: Number(row.totalActiveUsers),
			signups: Number(row.signups),
			dau: Number(row.dau),
			wau: Number(row.wau),
			mau: Number(row.mau),
			activationEligible: Number(row.activationEligible),
			activationAchieved: Number(row.activationAchieved),
			d1Eligible: Number(row.d1Eligible),
			d1Achieved: Number(row.d1Achieved),
			d7Eligible: Number(row.d7Eligible),
			d7Achieved: Number(row.d7Achieved),
			d30Eligible: Number(row.d30Eligible),
			d30Achieved: Number(row.d30Achieved),
			d7RetainedActivatedUsers: Number(row.d7RetainedActivatedUsers),
		};
	}
}
