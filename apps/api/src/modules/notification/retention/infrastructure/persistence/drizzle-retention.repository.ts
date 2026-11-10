import { TransactionHost } from "@nestjs-cls/transactional";
import { Inject, Injectable } from "@nestjs/common";
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
import { UNIT_OF_WORK, type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";

import type {
  RetentionRepositoryPort,
  RetentionStageCandidate,
} from "../../application/ports/retention.repository.port.js";
import {
  RETENTION_EXPERIMENT_KEY,
  RETENTION_STAGE_NAMES,
} from "../../domain/retention.constants.js";

const stageRowSchema = z.object({
  assignmentId: z.string(),
  stageId: z.string(),
  userId: z.string(),
  variant: z.enum(["CONTROL", "TREATMENT"]),
  stage: z.enum(["D0", "D1", "D3", "D7"]),
  startedAt: rawTimestamptzSchema,
  timezone: z.string(),
  locale: z.string(),
  pushEnabled: z.boolean(),
  nightPushEnabled: z.boolean(),
  marketingPushAgreedAt: nullableRawTimestamptzSchema,
  activeTokenCount: z.number(),
  lastActiveAt: nullableRawTimestamptzSchema,
  todoCount: z.number(),
  completedCount: z.number(),
  todoActionWithinWindow: z.boolean(),
});

@Injectable()
export class DrizzleRetentionRepository implements RetentionRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #uow: UnitOfWorkPort;

  constructor(
    txHost: TransactionHost<DrizzleTransactionalAdapter>,
    @Inject(UNIT_OF_WORK) uow: UnitOfWorkPort,
  ) {
    this.#txHost = txHost;
    this.#uow = uow;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async enroll(input: {
    userId: string;
    variant: "CONTROL" | "TREATMENT";
    startedAt: Date | null;
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
      if (input.startedAt == null || inserted.length === 0) {
        return;
      }
      await this.#db
        .insert(retentionExperimentStage)
        .values(RETENTION_STAGE_NAMES.map((stage) => ({ assignmentId, stage })));
    });
  }

  async activate(userId: string, startedAt: Date): Promise<boolean> {
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
      .values(RETENTION_STAGE_NAMES.map((stage) => ({ assignmentId: assignment.id, stage })))
      .onConflictDoNothing();
    return true;
  }

  async findScheduledStages(limit: number): Promise<RetentionStageCandidate[]> {
    const perStageLimit = Math.max(1, Math.ceil(limit / RETENTION_STAGE_NAMES.length));
    const rows = z.array(stageRowSchema).parse(
      (
        await this.#db.execute<Record<string, unknown>>(sql`
			WITH valid_timezones AS MATERIALIZED (
				SELECT timezone.name
				FROM pg_timezone_names AS timezone
			),
			ranked_stages AS (
				SELECT
					stage."id",
					stage."assignmentId",
					stage."stage",
					stage."createdAt",
					ROW_NUMBER() OVER (
						PARTITION BY stage."stage"
						ORDER BY stage."createdAt" ASC
					) AS stage_rank
				FROM ${retentionExperimentStage} AS stage
				INNER JOIN ${retentionExperimentAssignment} AS assignment
					ON assignment."id" = stage."assignmentId"
				WHERE stage."status" = 'SCHEDULED'
					AND assignment."experimentKey" = ${RETENTION_EXPERIMENT_KEY}
					AND assignment."startedAt" IS NOT NULL
			)
			SELECT
				assignment."id" AS "assignmentId",
				ranked."id" AS "stageId",
				assignment."userId" AS "userId",
				assignment."variant",
				ranked."stage",
				assignment."startedAt" AT TIME ZONE 'UTC' AS "startedAt",
				COALESCE(valid_timezone.name, 'UTC') AS "timezone",
				COALESCE(preference."locale", 'ko') AS "locale",
				COALESCE(preference."pushEnabled", FALSE) AS "pushEnabled",
				COALESCE(preference."nightPushEnabled", FALSE) AS "nightPushEnabled",
				consent."marketingPushAgreedAt" AT TIME ZONE 'UTC' AS "marketingPushAgreedAt",
				COALESCE(token_metrics."activeTokenCount", 0)::INT AS "activeTokenCount",
				app_user."lastActiveAt" AT TIME ZONE 'UTC' AS "lastActiveAt",
				COALESCE(todo_metrics."todoCount", 0)::INT AS "todoCount",
				COALESCE(todo_metrics."completedCount", 0)::INT AS "completedCount",
				COALESCE(todo_metrics."todoActionWithinWindow", FALSE) AS "todoActionWithinWindow"
			FROM ranked_stages AS ranked
			INNER JOIN ${retentionExperimentAssignment} AS assignment
				ON assignment."id" = ranked."assignmentId"
			INNER JOIN ${user} AS app_user
				ON app_user."id" = assignment."userId"
			LEFT JOIN ${userPreference} AS preference
				ON preference."userId" = app_user."id"
			LEFT JOIN valid_timezones AS valid_timezone
				ON valid_timezone.name = preference."timezone"
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
							(todo."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE COALESCE(valid_timezone.name, 'UTC'))::DATE
								> (assignment."startedAt" AT TIME ZONE 'UTC' AT TIME ZONE COALESCE(valid_timezone.name, 'UTC'))::DATE
							AND todo."createdAt" < assignment."startedAt" + INTERVAL '8 days'
						) OR (
							todo."completedAt" IS NOT NULL
							AND (todo."completedAt" AT TIME ZONE 'UTC' AT TIME ZONE COALESCE(valid_timezone.name, 'UTC'))::DATE
								> (assignment."startedAt" AT TIME ZONE 'UTC' AT TIME ZONE COALESCE(valid_timezone.name, 'UTC'))::DATE
							AND todo."completedAt" < assignment."startedAt" + INTERVAL '8 days'
						)
					) AS "todoActionWithinWindow"
				FROM ${todo} AS todo
				WHERE todo."userId" = app_user."id"
			) AS todo_metrics ON TRUE
			WHERE ranked.stage_rank <= ${perStageLimit}
			ORDER BY ranked."createdAt" ASC
		`)
      ).rows,
    );

    return rows.map((row) => ({
      ...row,
      locale: row.locale === "en" ? "en" : "ko",
      incompleteCount: row.todoCount - row.completedCount,
    }));
  }

  async markStageSkipped(stageId: string, reason: string): Promise<boolean> {
    const updated = await this.#db
      .update(retentionExperimentStage)
      .set({ status: "SKIPPED", skipReason: reason, processedAt: now() })
      .where(
        and(
          eq(retentionExperimentStage.id, stageId),
          eq(retentionExperimentStage.status, "SCHEDULED"),
        ),
      )
      .returning({ id: retentionExperimentStage.id });
    return updated.length === 1;
  }

  async markStageOutboxed(stageId: string): Promise<boolean> {
    const claimed = await this.#db
      .update(retentionExperimentStage)
      .set({ status: "OUTBOXED", processedAt: now() })
      .where(
        and(
          eq(retentionExperimentStage.id, stageId),
          eq(retentionExperimentStage.status, "SCHEDULED"),
        ),
      )
      .returning({ id: retentionExperimentStage.id });
    return claimed.length === 1;
  }

  async linkStageNotification(stageId: string, notificationId: number): Promise<void> {
    const [linked] = await this.#db
      .update(retentionExperimentStage)
      .set({ notificationId })
      .where(eq(retentionExperimentStage.id, stageId))
      .returning({ id: retentionExperimentStage.id });
    requireRecord(linked);
  }

  async recordD7Result(input: {
    assignmentId: string;
    returnedWithinD7: boolean;
    todoActionWithinD7: boolean;
  }): Promise<void> {
    await this.#db
      .insert(retentionExperimentResult)
      .values(input)
      .onConflictDoUpdate({
        target: retentionExperimentResult.assignmentId,
        set: {
          returnedWithinD7: input.returnedWithinD7,
          todoActionWithinD7: input.todoActionWithinD7,
          measuredAt: now(),
        },
      });
  }
}
