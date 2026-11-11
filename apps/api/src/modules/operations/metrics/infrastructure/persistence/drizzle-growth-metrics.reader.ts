import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { nullableRawTimestampSchema } from "#api/platform/database/raw-timestamp.schema";
import {
  account,
  todo,
  user,
  userActivityDay,
  userPreference,
} from "#api/platform/database/schema/index";
import { instantFromDate } from "#api/shared/domain/time/instant";

import {
  GrowthMetricsReaderPort,
  type GrowthSummaryCounts,
} from "../../application/ports/growth-metrics.reader.port.js";

const activity = alias(userActivityDay, "activity");
const d1Activity = alias(userActivityDay, "d1_activity");
const d7Activity = alias(userActivityDay, "d7_activity");
const d30Activity = alias(userActivityDay, "d30_activity");
const appUser = alias(user, "app_user");
const activeUser = alias(user, "active_user");
const accountRow = alias(account, "account");
const createdTodo = alias(todo, "created_todo");
const completedTodo = alias(todo, "completed_todo");
const preference = alias(userPreference, "preference");

function toInstantOrNull(date: Date | null): Temporal.Instant | null {
  return date == null ? null : instantFromDate(date);
}

interface GrowthSummaryRow {
  measurementStartedAt: string | null;
  totalActiveUsers: string;
  signups: string;
  dau: string;
  wau: string;
  mau: string;
  activationEligible: string;
  activationAchieved: string;
  d1Eligible: string;
  d1Achieved: string;
  d7Eligible: string;
  d7Achieved: string;
  d30Eligible: string;
  d30Achieved: string;
  d7RetainedActivatedUsers: string;
}

/**
 * 관리자 성장 지표용 PostgreSQL read-model 어댑터.
 *
 * 가입 cohort 날짜는 사용자의 첫 활동 행 타임존(없으면 현재 선호, 이후 UTC)으로
 * 계산하고, retention 달성은 이미 정규화된 UserActivityDay.localDate로 판정한다.
 * LATERAL·FILTER·pg_timezone_names를 쓰는 단일 집계라 raw SQL로 유지한다.
 */
@Injectable()
export class DrizzleGrowthMetricsReader extends GrowthMetricsReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#txHost = txHost;
  }

  async getSummaryCounts(input: {
    readonly cohortFrom: Temporal.PlainDate;
    readonly cohortTo: Temporal.PlainDate;
    readonly asOf: Temporal.Instant;
  }): Promise<GrowthSummaryCounts> {
    const cohortFrom = input.cohortFrom.toString();
    const cohortTo = input.cohortTo.toString();
    const asOfTimestamp = sql.param(input.asOf, user.createdAt);

    const { rows } = await this.#txHost.tx.execute<GrowthSummaryRow>(sql`
      WITH measurement AS (
        SELECT (
          SELECT ${activity.firstSeenAt}
          FROM ${userActivityDay} AS activity
          ORDER BY ${activity.firstSeenAt} ASC, ${activity.id} ASC
          LIMIT 1
        ) AS "measurementStartedAt"
      ),
      candidate_users AS (
        SELECT
          ${appUser.id},
          ${appUser.createdAt}
        FROM ${user} AS app_user
        WHERE ${appUser.deletedAt} IS NULL
          AND EXISTS (
            SELECT 1
            FROM ${account} AS account
            WHERE ${accountRow.userId} = ${appUser.id}
          )
          AND ${appUser.createdAt} >=
            ${cohortFrom}::DATE - INTERVAL '14 hours'
          AND ${appUser.createdAt} <
            ${cohortTo}::DATE + INTERVAL '36 hours'
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
            ${asOfTimestamp}::TIMESTAMPTZ AT TIME ZONE COALESCE(
              valid_activity_timezone.name,
              valid_preference_timezone.name,
              'UTC'
            )
          )::DATE AS "asOfLocalDate"
        FROM candidate_users AS candidate
        LEFT JOIN LATERAL (
          SELECT ${activity.timezone}
          FROM ${userActivityDay} AS activity
          WHERE ${activity.userId} = candidate."id"
          ORDER BY ${activity.firstSeenAt} ASC, ${activity.id} ASC
          LIMIT 1
        ) AS first_activity ON TRUE
        LEFT JOIN ${userPreference} AS preference
          ON ${preference.userId} = candidate."id"
        LEFT JOIN pg_timezone_names AS valid_activity_timezone
          ON valid_activity_timezone.name = first_activity."timezone"
        LEFT JOIN pg_timezone_names AS valid_preference_timezone
          ON valid_preference_timezone.name = ${preference.timezone}
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
              FROM ${todo} AS created_todo
              WHERE ${createdTodo.userId} = localized."id"
                AND ${createdTodo.createdAt} >= localized."createdAt"
                AND ${createdTodo.createdAt} <= localized."createdAt" + INTERVAL '24 hours'
            )
            AND EXISTS (
              SELECT 1
              FROM ${todo} AS completed_todo
              WHERE ${completedTodo.userId} = localized."id"
                AND ${completedTodo.completedAt} >= localized."createdAt"
                AND ${completedTodo.completedAt} <= localized."createdAt" + INTERVAL '24 hours'
            )
          ) AS "activationAchieved",
          EXISTS (
            SELECT 1
            FROM ${userActivityDay} AS d1_activity
            WHERE ${d1Activity.userId} = localized."id"
              AND ${d1Activity.localDate} = localized."signupLocalDate" + 1
          ) AS "d1Achieved",
          EXISTS (
            SELECT 1
            FROM ${userActivityDay} AS d7_activity
            WHERE ${d7Activity.userId} = localized."id"
              AND ${d7Activity.localDate} = localized."signupLocalDate" + 7
          ) AS "d7Achieved",
          EXISTS (
            SELECT 1
            FROM ${userActivityDay} AS d30_activity
            WHERE ${d30Activity.userId} = localized."id"
              AND ${d30Activity.localDate} = localized."signupLocalDate" + 30
          ) AS "d30Achieved"
        FROM localized_users AS localized
        WHERE localized."signupLocalDate"
          BETWEEN ${cohortFrom}::DATE AND ${cohortTo}::DATE
      ),
      activity_candidates AS (
        SELECT
          ${activity.userId},
          ${activity.localDate}
        FROM ${userActivityDay} AS activity
        INNER JOIN ${user} AS active_user
          ON ${activeUser.id} = ${activity.userId}
          AND ${activeUser.deletedAt} IS NULL
        WHERE ${activity.localDate} BETWEEN
          LEAST(
            ${cohortFrom}::DATE,
            ${cohortTo}::DATE - 29
          )
          AND ${cohortTo}::DATE
      ),
      active_counts AS (
        SELECT
          COUNT(DISTINCT activity."userId") FILTER (
            WHERE activity."localDate"
              BETWEEN ${cohortFrom}::DATE AND ${cohortTo}::DATE
          )::BIGINT AS "totalActiveUsers",
          COUNT(DISTINCT activity."userId") FILTER (
            WHERE activity."localDate" = ${cohortTo}::DATE
          )::BIGINT AS "dau",
          COUNT(DISTINCT activity."userId") FILTER (
            WHERE activity."localDate"
              BETWEEN ${cohortTo}::DATE - 6 AND ${cohortTo}::DATE
          )::BIGINT AS "wau",
          COUNT(DISTINCT activity."userId") FILTER (
            WHERE activity."localDate"
              BETWEEN ${cohortTo}::DATE - 29 AND ${cohortTo}::DATE
          )::BIGINT AS "mau"
        FROM activity_candidates AS activity
      ),
      cohort_counts AS (
        SELECT
          COUNT(*)::BIGINT AS "signups",
          COUNT(*) FILTER (
            WHERE cohort."createdAt" + INTERVAL '24 hours' <= ${asOfTimestamp}
          )::BIGINT AS "activationEligible",
          COUNT(*) FILTER (
            WHERE cohort."createdAt" + INTERVAL '24 hours' <= ${asOfTimestamp}
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
    `);
    const row = rows[0];
    if (row == null) {
      throw new Error("growth summary aggregate returned no row");
    }

    return {
      measurementStartedAt: toInstantOrNull(
        nullableRawTimestampSchema.parse(row.measurementStartedAt),
      ),
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
