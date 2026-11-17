import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import {
  nullableRawTimestampSchema,
  rawTimestampSchema,
} from "#api/platform/database/raw-timestamp.schema";
import {
  linkedAccount,
  user,
  userActivityDay,
  userPreference,
} from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate } from "#api/shared/domain/time/instant";

import {
  type GrowthCohortRange,
  GrowthMetricsReaderPort,
} from "../../application/ports/growth-metrics.reader.port.js";
import type {
  GrowthActivityReadModel,
  GrowthCohortSignupReadModel,
} from "../../application/read-models/growth-cohort.read-model.js";
import { GROWTH_RETENTION_DAYS } from "../../domain/growth-metrics.constants.js";

// raw SQL 결과는 칸 디코더를 거치지 않는다. COUNT는 BIGINT 문자열, 날짜는 ::TEXT로 받는다
const bigintCountSchema = z.coerce.number().int();
const plainDateTextSchema = z.string().transform((text) => Temporal.PlainDate.from(text));

const growthActivityRowSchema = z.object({
  measurementStartedAt: nullableRawTimestampSchema.transform((value) =>
    value == null ? null : instantFromDate(value),
  ),
  totalActiveUsers: bigintCountSchema,
  dau: bigintCountSchema,
  wau: bigintCountSchema,
  mau: bigintCountSchema,
});

const growthCohortSignupRowSchema = z.object({
  userId: z.string(),
  signedUpAt: rawTimestampSchema.transform(instantFromDate),
  signupLocalDate: plainDateTextSchema,
  asOfLocalDate: plainDateTextSchema,
  activeOnD1: z.boolean(),
  activeOnD7: z.boolean(),
  activeOnD30: z.boolean(),
});

const activity = alias(userActivityDay, "activity");
const d1Activity = alias(userActivityDay, "d1_activity");
const d7Activity = alias(userActivityDay, "d7_activity");
const d30Activity = alias(userActivityDay, "d30_activity");
const appUser = alias(user, "app_user");
const activeUser = alias(user, "active_user");
const accountRow = alias(linkedAccount, "account");
const preference = alias(userPreference, "preference");

/**
 * 관리자 성장 지표용 PostgreSQL 조회. 가입 cohort 날짜는 사용자의 첫 활동 행 타임존(없으면 현재 선호,
 * 이후 UTC)으로 계산하고, 리텐션 날짜의 활동은 이미 정규화된 UserActivityDay.localDate로 본다.
 * LATERAL·FILTER·pg_timezone_names를 쓰는 집계라 raw SQL로 둔다.
 */
@Injectable()
export class DrizzleGrowthMetricsReader extends GrowthMetricsReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#transactionHost = transactionHost;
  }

  async getActivity(range: GrowthCohortRange): Promise<GrowthActivityReadModel> {
    const cohortFrom = range.cohortFrom.toString();
    const cohortTo = range.cohortTo.toString();
    const { rows } = await this.#db.execute<Record<string, unknown>>(sql`
      WITH measurement AS (
        SELECT (
          SELECT ${activity.firstSeenAt}
          FROM ${userActivityDay} AS activity
          ORDER BY ${activity.firstSeenAt} ASC, ${activity.id} ASC
          LIMIT 1
        ) AS "measurementStartedAt"
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
      )
      SELECT
        measurement."measurementStartedAt",
        active_counts."totalActiveUsers",
        active_counts."dau",
        active_counts."wau",
        active_counts."mau"
      FROM measurement
      CROSS JOIN active_counts
    `);
    return growthActivityRowSchema.parse(rows[0]);
  }

  async listCohortSignups(
    range: GrowthCohortRange & { readonly asOf: Temporal.Instant },
  ): Promise<GrowthCohortSignupReadModel[]> {
    const cohortFrom = range.cohortFrom.toString();
    const cohortTo = range.cohortTo.toString();
    const { rows } = await this.#db.execute<Record<string, unknown>>(sql`
      WITH ${localizedSignupsSql({ cohortFrom, cohortTo, asOf: range.asOf })}
      SELECT
        localized."id" AS "userId",
        localized."createdAt" AS "signedUpAt",
        localized."signupLocalDate"::TEXT AS "signupLocalDate",
        localized."asOfLocalDate"::TEXT AS "asOfLocalDate",
        ${retentionActivitySql()}
      FROM localized_users AS localized
      WHERE localized."signupLocalDate"
        BETWEEN ${cohortFrom}::DATE AND ${cohortTo}::DATE
    `);
    return rows.map((row) => {
      const signup = growthCohortSignupRowSchema.parse(row);
      return {
        userId: UserId.reconstitute(signup.userId),
        signedUpAt: signup.signedUpAt,
        signupLocalDate: signup.signupLocalDate,
        asOfLocalDate: signup.asOfLocalDate,
        activeOn: { d1: signup.activeOnD1, d7: signup.activeOnD7, d30: signup.activeOnD30 },
      };
    });
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}

// 현지 날짜가 하루 앞뒤로 갈리는 시간대(UTC-12 ~ UTC+14)를 위해 후보는 범위보다 넓게 읽고 현지 날짜로 거른다
function localizedSignupsSql(params: {
  readonly cohortFrom: string;
  readonly cohortTo: string;
  readonly asOf: Temporal.Instant;
}): SQL {
  const asOfTimestamp = sql.param(params.asOf, user.createdAt);
  return sql`
    candidate_users AS (
      SELECT
        ${appUser.id},
        ${appUser.createdAt}
      FROM ${user} AS app_user
      WHERE ${appUser.deletedAt} IS NULL
        AND EXISTS (
          SELECT 1
          FROM ${linkedAccount} AS account
          WHERE ${accountRow.userId} = ${appUser.id}
        )
        AND ${appUser.createdAt} >=
          ${params.cohortFrom}::DATE - INTERVAL '14 hours'
        AND ${appUser.createdAt} <
          ${params.cohortTo}::DATE + INTERVAL '36 hours'
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
    )
  `;
}

// 가입 현지 날짜 + 1·7·30일의 활동 행이 있는지. 대상 여부(측정 시작·기준 날짜)는 도메인이 정한다
function retentionActivitySql(): SQL {
  return sql`
    EXISTS (
      SELECT 1
      FROM ${userActivityDay} AS d1_activity
      WHERE ${d1Activity.userId} = localized."id"
        AND ${d1Activity.localDate} = localized."signupLocalDate" + ${GROWTH_RETENTION_DAYS.d1}::INTEGER
    ) AS "activeOnD1",
    EXISTS (
      SELECT 1
      FROM ${userActivityDay} AS d7_activity
      WHERE ${d7Activity.userId} = localized."id"
        AND ${d7Activity.localDate} = localized."signupLocalDate" + ${GROWTH_RETENTION_DAYS.d7}::INTEGER
    ) AS "activeOnD7",
    EXISTS (
      SELECT 1
      FROM ${userActivityDay} AS d30_activity
      WHERE ${d30Activity.userId} = localized."id"
        AND ${d30Activity.localDate} = localized."signupLocalDate" + ${GROWTH_RETENTION_DAYS.d30}::INTEGER
    ) AS "activeOnD30"
  `;
}
