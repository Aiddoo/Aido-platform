import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import {
  userDeliveryPreference,
  userMarketingPushConsent,
} from "#api/modules/identity/user-preferences/identity-user-preferences.public";
import { userLastActivity } from "#api/modules/identity/users/identity-users.public";
import { todoActivityRowsOf } from "#api/modules/planning/todos/planning-todos-queries.public";
import {
  nullableRawTimestamptzSchema,
  rawTimestamptzSchema,
} from "#api/platform/database/raw-timestamp.schema";
import {
  pushToken,
  retentionExperimentAssignment,
  retentionExperimentStage,
} from "#api/platform/database/schema/index";
import { instantFromDate, toIsoString } from "#api/shared/domain/time/instant";

import type { RetentionStageCursorReadModel } from "../../application/read-models/retention-stage-candidate.read-model.js";
import {
  RETENTION_EXPERIMENT_KEY,
  RETENTION_STAGE_NAMES,
  RETENTION_VARIANTS,
} from "../../domain/retention-assignments.constants.js";
import { RETENTION_STAGE_TIMING } from "../../domain/retention-stage.domain-service.js";

// raw SQL 결과는 칸 디코더를 거치지 않아 Date로 읽은 뒤 Instant로 바꾼다
const rawInstantSchema = rawTimestamptzSchema.transform(instantFromDate);
const nullableRawInstantSchema = nullableRawTimestamptzSchema.transform((value) =>
  value == null ? null : instantFromDate(value),
);

export const retentionStageCandidateRowSchema = z.object({
  assignmentId: z.string(),
  stageId: z.string(),
  stageCreatedAt: rawInstantSchema,
  userId: z.string(),
  variant: z.enum(RETENTION_VARIANTS),
  stage: z.enum(RETENTION_STAGE_NAMES),
  startedAt: rawInstantSchema,
  timezone: z.string(),
  locale: z.string().nullable(),
  pushEnabled: z.boolean(),
  nightPushEnabled: z.boolean(),
  marketingPushAgreedAt: nullableRawInstantSchema,
  activeTokenCount: z.number(),
  lastActiveAt: nullableRawInstantSchema,
  todoCount: z.number(),
  completedCount: z.number(),
  todoActionWithinWindow: z.boolean(),
});

interface DueRetentionStagesQuery {
  readonly dueAt: Temporal.Instant;
  readonly after?: RetentionStageCursorReadModel;
  readonly limit: number;
  /** AT TIME ZONE에 넘겨도 되는 저장 시간대. 목록 밖 값은 UTC로 계산한다 */
  readonly validTimezones: readonly string[];
}

// isRetentionStageDue와 같은 기준이다. 아직 기다리는 단계가 묶음 자리를 차지하지 않게 한다
function dueStages(query: DueRetentionStagesQuery): SQL {
  const dueAt = toIsoString(query.dueAt);
  const d0ReadyBefore = toIsoString(
    query.dueAt.subtract({ milliseconds: RETENTION_STAGE_TIMING.d0MinWaitMs }),
  );
  const { targetDay, sendLocalTime } = RETENTION_STAGE_TIMING;
  const stagePreference = userDeliveryPreference();
  const afterCursor =
    query.after == null
      ? sql`TRUE`
      : sql`(stage."createdAt", stage."id") > (${toIsoString(query.after.createdAt)}::timestamptz AT TIME ZONE 'UTC', ${query.after.stageId})`;
  return sql`
				SELECT
					stage."id",
					stage."assignmentId",
					stage."stage",
					stage."createdAt",
					stage_clock.timezone
				FROM ${retentionExperimentStage} AS stage
				INNER JOIN ${retentionExperimentAssignment} AS assignment
					ON assignment."id" = stage."assignmentId"
				LEFT JOIN ${stagePreference}
					ON ${stagePreference.userId} = assignment."userId"
				LEFT JOIN unnest(${sql.param(query.validTimezones)}::TEXT[]) AS valid_timezone(name)
					ON valid_timezone.name = ${stagePreference.timezone}
				CROSS JOIN LATERAL (
					SELECT COALESCE(valid_timezone.name, 'UTC') AS timezone
				) AS stage_clock
				CROSS JOIN LATERAL (
					SELECT
						(${dueAt}::timestamptz AT TIME ZONE stage_clock.timezone)::DATE
							- (assignment."startedAt" AT TIME ZONE 'UTC' AT TIME ZONE stage_clock.timezone)::DATE
							AS day_difference,
						(${dueAt}::timestamptz AT TIME ZONE stage_clock.timezone)::TIME AS local_time,
						CASE stage."stage"
							WHEN 'D1' THEN ${targetDay.D1}::INT
							WHEN 'D3' THEN ${targetDay.D3}::INT
							ELSE ${targetDay.D7}::INT
						END AS target_day
				) AS local_clock
				WHERE stage."status" = 'SCHEDULED'
					AND assignment."experimentKey" = ${RETENTION_EXPERIMENT_KEY}
					AND assignment."startedAt" IS NOT NULL
					AND ${afterCursor}
					AND CASE
						WHEN stage."stage" = 'D0' THEN
							local_clock.day_difference > 0
							OR assignment."startedAt" <= ${d0ReadyBefore}::timestamptz AT TIME ZONE 'UTC'
						ELSE
							local_clock.day_difference > local_clock.target_day
							OR (
								local_clock.day_difference = local_clock.target_day
								AND local_clock.local_time >= MAKE_TIME(${sendLocalTime.hour}::INT, ${sendLocalTime.minute}::INT, 0)
							)
					END
				ORDER BY stage."createdAt" ASC, stage."id" ASC
				LIMIT ${query.limit}
	`;
}

/** 지금 보낼 차례인 리텐션 단계와 그 사람의 알림 설정·활동 요약을 한 SQL로 읽는다 */
export function dueRetentionStageCandidates(query: DueRetentionStagesQuery): SQL {
  const preference = userDeliveryPreference();
  const consent = userMarketingPushConsent();
  const appUser = userLastActivity();
  const userTodos = todoActivityRowsOf(appUser.userId);
  return sql`
			WITH due_stages AS (${dueStages(query)})
			SELECT
				assignment."id" AS "assignmentId",
				due."id" AS "stageId",
				due."createdAt" AT TIME ZONE 'UTC' AS "stageCreatedAt",
				assignment."userId" AS "userId",
				assignment."variant",
				due."stage",
				assignment."startedAt" AT TIME ZONE 'UTC' AS "startedAt",
				due.timezone AS "timezone",
				${preference.locale} AS "locale",
				COALESCE(${preference.pushEnabled}, FALSE) AS "pushEnabled",
				COALESCE(${preference.nightPushEnabled}, FALSE) AS "nightPushEnabled",
				${consent.marketingPushAgreedAt} AT TIME ZONE 'UTC' AS "marketingPushAgreedAt",
				COALESCE(token_metrics."activeTokenCount", 0)::INT AS "activeTokenCount",
				${appUser.lastActiveAt} AT TIME ZONE 'UTC' AS "lastActiveAt",
				COALESCE(todo_metrics."todoCount", 0)::INT AS "todoCount",
				COALESCE(todo_metrics."completedCount", 0)::INT AS "completedCount",
				COALESCE(todo_metrics."todoActionWithinWindow", FALSE) AS "todoActionWithinWindow"
			FROM due_stages AS due
			INNER JOIN ${retentionExperimentAssignment} AS assignment
				ON assignment."id" = due."assignmentId"
			INNER JOIN ${appUser}
				ON ${appUser.userId} = assignment."userId"
			LEFT JOIN ${preference}
				ON ${preference.userId} = ${appUser.userId}
			LEFT JOIN ${consent}
				ON ${consent.userId} = ${appUser.userId}
			LEFT JOIN LATERAL (
				SELECT COUNT(*) AS "activeTokenCount"
				FROM ${pushToken} AS token
				WHERE token."userId" = ${appUser.userId}
					AND token."isActive" = TRUE
			) AS token_metrics ON TRUE
			LEFT JOIN LATERAL (
				SELECT
					COUNT(*) AS "todoCount",
					COUNT(*) FILTER (WHERE ${userTodos.completed} = TRUE) AS "completedCount",
					BOOL_OR(
						(
							(${userTodos.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE due.timezone)::DATE
								> (assignment."startedAt" AT TIME ZONE 'UTC' AT TIME ZONE due.timezone)::DATE
							AND ${userTodos.createdAt} < assignment."startedAt" + INTERVAL '8 days'
						) OR (
							${userTodos.completedAt} IS NOT NULL
							AND (${userTodos.completedAt} AT TIME ZONE 'UTC' AT TIME ZONE due.timezone)::DATE
								> (assignment."startedAt" AT TIME ZONE 'UTC' AT TIME ZONE due.timezone)::DATE
							AND ${userTodos.completedAt} < assignment."startedAt" + INTERVAL '8 days'
						)
					) AS "todoActionWithinWindow"
				FROM ${userTodos}
			) AS todo_metrics ON TRUE
			ORDER BY due."createdAt" ASC, due."id" ASC
	`;
}
