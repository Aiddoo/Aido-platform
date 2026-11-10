import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { createEntityId } from "#api/platform/database/entity-id";
import {
  nullableRawTimestamptzSchema,
  rawTimestamptzSchema,
} from "#api/platform/database/raw-timestamp.schema";
import {
  pushToken,
  retentionExperimentAssignment,
  retentionExperimentResult,
  retentionExperimentStage,
  todo,
  user,
  userConsent,
  userPreference,
} from "#api/platform/database/schema/index";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { toSupportedLocale } from "#api/shared/domain/locale";
import { instantFromDate, toIsoString } from "#api/shared/domain/time/instant";

import type { RetentionRepositoryPort } from "../../application/ports/retention.repository.port.js";
import type {
  RetentionStageCandidate,
  RetentionStageCursor,
} from "../../application/read-models/retention-stage-candidate.read-model.js";
import { RETENTION_STAGE_TIMING } from "../../domain/retention-stage.domain-service.js";
import {
  RETENTION_EXPERIMENT_KEY,
  RETENTION_STAGE_NAMES,
  RETENTION_VARIANTS,
  type RetentionVariant,
} from "../../domain/retention.constants.js";

// raw SQL 결과는 칸 디코더를 거치지 않아 Date로 읽은 뒤 Instant로 바꾼다
const rawInstantSchema = rawTimestamptzSchema.transform(instantFromDate);
const nullableRawInstantSchema = nullableRawTimestamptzSchema.transform((value) =>
  value == null ? null : instantFromDate(value),
);

const stageRowSchema = z.object({
  assignmentId: z.string(),
  stageId: z.string(),
  stageCreatedAt: rawInstantSchema,
  userId: z.string(),
  variant: z.enum(RETENTION_VARIANTS),
  stage: z.enum(RETENTION_STAGE_NAMES),
  startedAt: rawInstantSchema,
  timezone: z.string(),
  locale: z.string(),
  pushEnabled: z.boolean(),
  nightPushEnabled: z.boolean(),
  marketingPushAgreedAt: nullableRawInstantSchema,
  activeTokenCount: z.number(),
  lastActiveAt: nullableRawInstantSchema,
  todoCount: z.number(),
  completedCount: z.number(),
  todoActionWithinWindow: z.boolean(),
});

@Injectable()
export class DrizzleRetentionRepository implements RetentionRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #uow: UnitOfWorkPort;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>, uow: UnitOfWorkPort) {
    this.#txHost = txHost;
    this.#uow = uow;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async enroll(input: {
    userId: string;
    variant: RetentionVariant;
    startedAt: Temporal.Instant | null;
  }): Promise<void> {
    await this.#uow.run(async () => {
      const assignmentId = createEntityId();
      const inserted = await this.#db
        .insert(retentionExperimentAssignment)
        .values({
          id: assignmentId,
          userId: input.userId,
          experimentKey: RETENTION_EXPERIMENT_KEY,
          variant: input.variant,
          startedAt: input.startedAt,
        })
        .onConflictDoNothing({
          target: [
            retentionExperimentAssignment.userId,
            retentionExperimentAssignment.experimentKey,
          ],
        })
        .returning({ id: retentionExperimentAssignment.id });
      const { startedAt } = input;
      if (startedAt == null || inserted.length === 0) {
        return;
      }
      await this.#db
        .insert(retentionExperimentStage)
        .values(
          RETENTION_STAGE_NAMES.map((stage) => ({ assignmentId, stage, updatedAt: startedAt })),
        );
    });
  }

  async activate(userId: string, startedAt: Temporal.Instant): Promise<boolean> {
    const claimed = await this.#db
      .update(retentionExperimentAssignment)
      .set({ startedAt })
      .where(
        and(
          eq(retentionExperimentAssignment.userId, userId),
          eq(retentionExperimentAssignment.experimentKey, RETENTION_EXPERIMENT_KEY),
          isNull(retentionExperimentAssignment.startedAt),
        ),
      )
      .returning({ id: retentionExperimentAssignment.id });
    const [assignment] = claimed;
    if (claimed.length !== 1 || assignment == null) {
      return false;
    }
    await this.#db
      .insert(retentionExperimentStage)
      .values(
        RETENTION_STAGE_NAMES.map((stage) => ({
          assignmentId: assignment.id,
          stage,
          updatedAt: startedAt,
        })),
      )
      .onConflictDoNothing();
    return true;
  }

  async findDueStages(params: {
    readonly dueAt: Temporal.Instant;
    readonly after?: RetentionStageCursor;
    readonly limit: number;
  }): Promise<RetentionStageCandidate[]> {
    const dueAt = toIsoString(params.dueAt);
    const d0ReadyBefore = toIsoString(
      params.dueAt.subtract({ milliseconds: RETENTION_STAGE_TIMING.d0MinWaitMs }),
    );
    const { targetDay, sendLocalTime } = RETENTION_STAGE_TIMING;
    const afterCursor =
      params.after == null
        ? sql`TRUE`
        : sql`(stage."createdAt", stage."id") > (${toIsoString(params.after.createdAt)}::timestamptz AT TIME ZONE 'UTC', ${params.after.stageId})`;
    const rows = z.array(stageRowSchema).parse(
      (
        await this.#db.execute<Record<string, unknown>>(sql`
			WITH valid_timezones AS MATERIALIZED (
				SELECT timezone.name
				FROM pg_timezone_names AS timezone
			),
			due_stages AS (
				-- isRetentionStageDue와 같은 기준이다. 아직 기다리는 단계가 묶음 자리를 차지하지 않게 한다
				SELECT
					stage."id",
					stage."assignmentId",
					stage."stage",
					stage."createdAt",
					stage_clock.timezone
				FROM ${retentionExperimentStage} AS stage
				INNER JOIN ${retentionExperimentAssignment} AS assignment
					ON assignment."id" = stage."assignmentId"
				LEFT JOIN ${userPreference} AS preference
					ON preference."userId" = assignment."userId"
				LEFT JOIN valid_timezones AS valid_timezone
					ON valid_timezone.name = preference."timezone"
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
				LIMIT ${params.limit}
			)
			SELECT
				assignment."id" AS "assignmentId",
				due."id" AS "stageId",
				due."createdAt" AT TIME ZONE 'UTC' AS "stageCreatedAt",
				assignment."userId" AS "userId",
				assignment."variant",
				due."stage",
				assignment."startedAt" AT TIME ZONE 'UTC' AS "startedAt",
				due.timezone AS "timezone",
				COALESCE(preference."locale", 'ko') AS "locale",
				COALESCE(preference."pushEnabled", FALSE) AS "pushEnabled",
				COALESCE(preference."nightPushEnabled", FALSE) AS "nightPushEnabled",
				consent."marketingPushAgreedAt" AT TIME ZONE 'UTC' AS "marketingPushAgreedAt",
				COALESCE(token_metrics."activeTokenCount", 0)::INT AS "activeTokenCount",
				app_user."lastActiveAt" AT TIME ZONE 'UTC' AS "lastActiveAt",
				COALESCE(todo_metrics."todoCount", 0)::INT AS "todoCount",
				COALESCE(todo_metrics."completedCount", 0)::INT AS "completedCount",
				COALESCE(todo_metrics."todoActionWithinWindow", FALSE) AS "todoActionWithinWindow"
			FROM due_stages AS due
			INNER JOIN ${retentionExperimentAssignment} AS assignment
				ON assignment."id" = due."assignmentId"
			INNER JOIN ${user} AS app_user
				ON app_user."id" = assignment."userId"
			LEFT JOIN ${userPreference} AS preference
				ON preference."userId" = app_user."id"
			LEFT JOIN ${userConsent} AS consent
				ON consent."userId" = app_user."id"
			LEFT JOIN LATERAL (
				SELECT COUNT(*) AS "activeTokenCount"
				FROM ${pushToken} AS token
				WHERE token."userId" = app_user."id"
					AND token."isActive" = TRUE
			) AS token_metrics ON TRUE
			LEFT JOIN LATERAL (
				SELECT
					COUNT(*) AS "todoCount",
					COUNT(*) FILTER (WHERE todo."completed" = TRUE) AS "completedCount",
					BOOL_OR(
						(
							(todo."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE due.timezone)::DATE
								> (assignment."startedAt" AT TIME ZONE 'UTC' AT TIME ZONE due.timezone)::DATE
							AND todo."createdAt" < assignment."startedAt" + INTERVAL '8 days'
						) OR (
							todo."completedAt" IS NOT NULL
							AND (todo."completedAt" AT TIME ZONE 'UTC' AT TIME ZONE due.timezone)::DATE
								> (assignment."startedAt" AT TIME ZONE 'UTC' AT TIME ZONE due.timezone)::DATE
							AND todo."completedAt" < assignment."startedAt" + INTERVAL '8 days'
						)
					) AS "todoActionWithinWindow"
				FROM ${todo} AS todo
				WHERE todo."userId" = app_user."id"
			) AS todo_metrics ON TRUE
			ORDER BY due."createdAt" ASC, due."id" ASC
		`)
      ).rows,
    );

    return rows.map((row) => ({
      ...row,
      locale: toSupportedLocale(row.locale),
      incompleteCount: row.todoCount - row.completedCount,
    }));
  }

  async markStageSkipped(
    stageId: string,
    reason: string,
    processedAt: Temporal.Instant,
  ): Promise<boolean> {
    const updated = await this.#db
      .update(retentionExperimentStage)
      .set({ status: "SKIPPED", skipReason: reason, processedAt, updatedAt: processedAt })
      .where(
        and(
          eq(retentionExperimentStage.id, stageId),
          eq(retentionExperimentStage.status, "SCHEDULED"),
        ),
      )
      .returning({ id: retentionExperimentStage.id });
    return updated.length === 1;
  }

  async markStageOutboxed(stageId: string, processedAt: Temporal.Instant): Promise<boolean> {
    const claimed = await this.#db
      .update(retentionExperimentStage)
      .set({ status: "OUTBOXED", processedAt, updatedAt: processedAt })
      .where(
        and(
          eq(retentionExperimentStage.id, stageId),
          eq(retentionExperimentStage.status, "SCHEDULED"),
        ),
      )
      .returning({ id: retentionExperimentStage.id });
    return claimed.length === 1;
  }

  async linkStageNotification(
    stageId: string,
    notificationId: number,
    linkedAt: Temporal.Instant,
  ): Promise<void> {
    const [linked] = await this.#db
      .update(retentionExperimentStage)
      .set({ notificationId, updatedAt: linkedAt })
      .where(eq(retentionExperimentStage.id, stageId))
      .returning({ id: retentionExperimentStage.id });
    requireRecord(linked);
  }

  async recordD7Result(input: {
    readonly assignmentId: string;
    readonly returnedWithinD7: boolean;
    readonly todoActionWithinD7: boolean;
    readonly measuredAt: Temporal.Instant;
  }): Promise<void> {
    await this.#db
      .insert(retentionExperimentResult)
      .values(input)
      .onConflictDoUpdate({
        target: retentionExperimentResult.assignmentId,
        set: {
          returnedWithinD7: input.returnedWithinD7,
          todoActionWithinD7: input.todoActionWithinD7,
          measuredAt: input.measuredAt,
        },
      });
  }
}
