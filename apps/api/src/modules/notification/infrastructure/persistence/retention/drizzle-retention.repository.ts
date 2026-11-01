import { TransactionHost } from "@nestjs-cls/transactional";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { createEntityId } from "#api/platform/database/entity-id";
import {
  notification,
  pushDeliveryAttempt,
  pushDispatch,
  pushDispatchOutbox,
  pushToken,
  retentionExperimentAssignment,
  retentionExperimentResult,
  retentionExperimentStage,
  retentionPushOutbox,
  todo,
  user,
  userConsent,
  userPreference,
} from "#api/platform/database/schema/index";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";

import type {
  ClaimedOutbox,
  CreateRetentionDeliveryInput,
  RetentionDeliveryResult,
  RetentionDispatchCandidate,
  RetentionDispatchFence,
  RetentionRepositoryPort,
  RetentionStageCandidate,
} from "../../../application/ports/retention/retention.repository.port.js";
import {
  RETENTION_CAMPAIGN_KEY,
  RETENTION_EXPERIMENT_KEY,
  RETENTION_STAGE_NAMES,
} from "../../../domain/policies/retention/retention.constants.js";
import { localDateString } from "../../../domain/services/retention/stage-policy.js";
import { pushTokenFingerprint } from "../delivery/push-token-fingerprint.js";

const stageRowSchema = z.object({
  assignmentId: z.string(),
  stageId: z.string(),
  userId: z.string(),
  variant: z.enum(["CONTROL", "TREATMENT"]),
  stage: z.enum(["D0", "D1", "D3", "D7"]),
  startedAt: z.coerce.date(),
  timezone: z.string(),
  locale: z.string(),
  pushEnabled: z.boolean(),
  nightPushEnabled: z.boolean(),
  marketingPushAgreedAt: z.coerce.date().nullable(),
  activeTokenCount: z.number(),
  lastActiveAt: z.coerce.date().nullable(),
  todoCount: z.number(),
  completedCount: z.number(),
  todoActionWithinWindow: z.boolean(),
});
const claimedOutboxRowsSchema = z.array(z.object({ id: z.string(), attempts: z.number() }));
const claimRowsSchema = z.array(
  z.object({
    dispatchId: z.number().nullable(),
    deliveryAttemptCount: z.number().nullable(),
    publishAttempt: z.number().nullable(),
    ownedOutboxCount: z.number(),
  }),
);
function excluded(column: { readonly name: string }) {
  return sql`excluded.${sql.identifier(column.name)}`;
}

const finalizedRowsSchema = z.array(z.object({ dispatchId: z.number() }));

@Injectable()
export class DrizzleRetentionRepository implements RetentionRepositoryPort {
  constructor(
    private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async enroll(input: {
    userId: string;
    variant: "CONTROL" | "TREATMENT";
    startedAt: Date | null;
  }): Promise<void> {
    await this.uow.run(async () => {
      const assignmentId = createEntityId();
      const inserted = await this.db
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
      await this.db
        .insert(retentionExperimentStage)
        .values(RETENTION_STAGE_NAMES.map((stage) => ({ assignmentId, stage })));
    });
  }

  async activate(userId: string, startedAt: Date): Promise<boolean> {
    const claimed = await this.db
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
    await this.db
      .insert(retentionExperimentStage)
      .values(RETENTION_STAGE_NAMES.map((stage) => ({ assignmentId: assignment.id, stage })))
      .onConflictDoNothing();
    return true;
  }

  async findScheduledStages(limit: number): Promise<RetentionStageCandidate[]> {
    const perStageLimit = Math.max(1, Math.ceil(limit / RETENTION_STAGE_NAMES.length));
    const rows = z.array(stageRowSchema).parse(
      (
        await this.db.execute<Record<string, unknown>>(sql`
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
    const updated = await this.db
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

  async createDelivery(input: CreateRetentionDeliveryInput): Promise<boolean> {
    const claimed = await this.db
      .update(retentionExperimentStage)
      .set({ status: "OUTBOXED", processedAt: now() })
      .where(
        and(
          eq(retentionExperimentStage.id, input.stageId),
          eq(retentionExperimentStage.status, "SCHEDULED"),
        ),
      )
      .returning({ id: retentionExperimentStage.id });
    if (claimed.length !== 1) {
      return false;
    }

    const [createdNotification] = await this.db
      .insert(notification)
      .values({
        userId: input.userId,
        type: "SYSTEM_NOTICE",
        title: input.title,
        body: input.body,
        actionType: "DEEP_LINK",
        actionUrl: input.route,
        campaignKey: RETENTION_CAMPAIGN_KEY,
        variantId: input.variantId,
        purpose: "ENGAGEMENT",
        metadata: { retentionExperiment: RETENTION_EXPERIMENT_KEY },
      })
      .returning({ id: notification.id });
    const notificationId = requireRecord(createdNotification).id;
    const localDate = new Date(`${localDateString(now(), input.timezone)}T00:00:00.000Z`);
    const [createdDispatch] = await this.db
      .insert(pushDispatch)
      .values({
        notificationId,
        userId: input.userId,
        purpose: "ENGAGEMENT",
        campaignKey: RETENTION_CAMPAIGN_KEY,
        variantId: input.variantId,
        timezone: input.timezone,
        localDate,
        status: "PENDING",
      })
      .returning({ id: pushDispatch.id });
    const dispatchId = requireRecord(createdDispatch).id;
    await this.db
      .insert(retentionPushOutbox)
      .values({ stageId: input.stageId, notificationId, dispatchId });
    const [linked] = await this.db
      .update(retentionExperimentStage)
      .set({ notificationId })
      .where(eq(retentionExperimentStage.id, input.stageId))
      .returning({ id: retentionExperimentStage.id });
    requireRecord(linked);
    return true;
  }

  async recordD7Result(input: {
    assignmentId: string;
    returnedWithinD7: boolean;
    todoActionWithinD7: boolean;
  }): Promise<void> {
    await this.db
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

  async recoverStaleOutboxes(cutoff: Date): Promise<number> {
    return (
      (
        await this.db.execute<Record<string, unknown>>(sql`
			WITH locked_outboxes AS MATERIALIZED (
				SELECT outbox."id"
				FROM ${retentionPushOutbox} AS outbox
				INNER JOIN ${pushDispatch} AS dispatch
					ON dispatch."id" = outbox."dispatchId"
				WHERE outbox."status" = 'PROCESSING'::"RetentionOutboxStatus"
					AND outbox."lockedAt" < ${sql.param(cutoff, retentionPushOutbox.lockedAt)}
					AND dispatch."status" <> 'PROCESSING'::"PushDispatchStatus"
				ORDER BY outbox."id" ASC
				FOR UPDATE OF outbox SKIP LOCKED
			)
			UPDATE ${retentionPushOutbox} AS outbox
			SET
				"status" = 'PENDING'::"RetentionOutboxStatus",
				"lockedAt" = NULL,
				"updatedAt" = CURRENT_TIMESTAMP
			FROM locked_outboxes
			WHERE outbox."id" = locked_outboxes."id"
				AND outbox."status" = 'PROCESSING'::"RetentionOutboxStatus"
		`)
      ).rowCount ?? 0
    );
  }

  async recoverStaleDispatches(cutoff: Date): Promise<number> {
    return (
      (
        await this.db.execute<Record<string, unknown>>(sql`
			WITH locked_outboxes AS MATERIALIZED (
				SELECT outbox."id", outbox."dispatchId"
				FROM ${retentionPushOutbox} AS outbox
				INNER JOIN ${pushDispatch} AS dispatch
					ON dispatch."id" = outbox."dispatchId"
				WHERE dispatch."status" = 'PROCESSING'::"PushDispatchStatus"
					AND dispatch."processingStartedAt" < ${sql.param(cutoff, pushDispatch.processingStartedAt)}
					AND NOT EXISTS (
						SELECT 1 FROM ${pushDispatchOutbox} AS general
						WHERE general."dispatchId" = dispatch."id"
					)
				ORDER BY outbox."id" ASC
				FOR UPDATE OF outbox SKIP LOCKED
			),
			recovered AS (
				UPDATE ${pushDispatch} AS dispatch
				SET
					"status" = 'PENDING'::"PushDispatchStatus",
					"processingJobId" = NULL,
					"processingJobAttempt" = NULL,
					"processingStartedAt" = NULL,
					"lastError" = 'STALE_RETENTION_PROCESSING_LEASE',
					"updatedAt" = CURRENT_TIMESTAMP
				FROM locked_outboxes
				WHERE dispatch."id" = locked_outboxes."dispatchId"
					AND dispatch."status" = 'PROCESSING'::"PushDispatchStatus"
					AND dispatch."processingStartedAt" < ${sql.param(cutoff, pushDispatch.processingStartedAt)}
					AND NOT EXISTS (
						SELECT 1 FROM ${pushDispatchOutbox} AS general
						WHERE general."dispatchId" = dispatch."id"
					)
				RETURNING dispatch."id"
			)
			UPDATE ${retentionPushOutbox} AS outbox
			SET
				"status" = 'PENDING'::"RetentionOutboxStatus",
				"availableAt" = CURRENT_TIMESTAMP,
				"lockedAt" = NULL,
				"publishedAt" = NULL,
				"lastError" = 'STALE_RETENTION_PROCESSING_LEASE',
				"updatedAt" = CURRENT_TIMESTAMP
			FROM recovered
			WHERE outbox."dispatchId" = recovered."id"
				AND outbox."status" IN (
					'PROCESSING'::"RetentionOutboxStatus",
					'PUBLISHED'::"RetentionOutboxStatus"
				)
		`)
      ).rowCount ?? 0
    );
  }

  async claimOutboxes(limit: number, claimedAt: Date): Promise<ClaimedOutbox[]> {
    return claimedOutboxRowsSchema.parse(
      (
        await this.db.execute<Record<string, unknown>>(sql`
			UPDATE ${retentionPushOutbox} AS outbox
			SET
				"status" = 'PROCESSING',
				"lockedAt" = ${sql.param(claimedAt, retentionPushOutbox.lockedAt)},
				"attempts" = outbox."attempts" + 1,
				"updatedAt" = NOW()
			WHERE outbox."id" IN (
				SELECT candidate."id"
				FROM ${retentionPushOutbox} AS candidate
				WHERE candidate."status" = 'PENDING'
					AND candidate."availableAt" <= ${sql.param(claimedAt, retentionPushOutbox.availableAt)}
				ORDER BY candidate."availableAt" ASC, candidate."id" ASC
				LIMIT ${limit}
				FOR UPDATE SKIP LOCKED
			)
			RETURNING outbox."id", outbox."attempts"
		`)
      ).rows,
    );
  }

  async markOutboxPublished(outbox: ClaimedOutbox): Promise<void> {
    await this.db
      .update(retentionPushOutbox)
      .set({ status: "PUBLISHED", publishedAt: now(), lockedAt: null })
      .where(
        and(
          eq(retentionPushOutbox.id, outbox.id),
          eq(retentionPushOutbox.attempts, outbox.attempts),
          eq(retentionPushOutbox.status, "PROCESSING"),
        ),
      );
  }

  async deferOutbox(input: {
    readonly outboxId: string;
    readonly publishAttempt?: number;
    readonly availableAt: Date;
  }): Promise<void> {
    await this.#lockOutboxGeneration(input.outboxId, input.publishAttempt);
    (await (
      await this.db.execute<Record<string, unknown>>(sql`
			UPDATE ${retentionPushOutbox} AS outbox
			SET
				"status" = 'PENDING'::"RetentionOutboxStatus",
				"availableAt" = ${sql.param(input.availableAt, retentionPushOutbox.availableAt)},
				"publishedAt" = NULL,
				"lockedAt" = NULL,
				"updatedAt" = CURRENT_TIMESTAMP
			WHERE outbox."id" = ${input.outboxId}
				AND (${input.publishAttempt ?? null}::INTEGER IS NULL OR outbox."attempts" = ${input.publishAttempt ?? null})
				AND outbox."status" IN (
					'PUBLISHED'::"RetentionOutboxStatus",
					'PROCESSING'::"RetentionOutboxStatus"
				)
				AND EXISTS (
					SELECT 1
					FROM ${pushDispatch} AS dispatch
					WHERE dispatch."id" = outbox."dispatchId"
						AND dispatch."status" = 'PENDING'::"PushDispatchStatus"
				)
		`)
    ).rowCount) ?? 0;
  }

  async markOutboxFailed(input: {
    outboxId: string;
    publishAttempt: number;
    hasExhaustedRetries: boolean;
    error: string;
    nextAttemptAt: Date;
  }): Promise<void> {
    await this.db
      .update(retentionPushOutbox)
      .set({
        status: input.hasExhaustedRetries ? "FAILED" : "PENDING",
        availableAt: input.nextAttemptAt,
        lockedAt: null,
        lastError: input.error.slice(0, 500),
      })
      .where(
        and(
          eq(retentionPushOutbox.id, input.outboxId),
          eq(retentionPushOutbox.attempts, input.publishAttempt),
          eq(retentionPushOutbox.status, "PROCESSING"),
        ),
      );
  }

  async claimDispatch(input: {
    readonly outboxId: string;
    readonly publishAttempt?: number;
    readonly processingJobId: string;
    readonly processingJobAttempt: number;
    readonly startedAt: Date;
  }): Promise<RetentionDispatchCandidate | null> {
    await this.#lockOutboxGeneration(input.outboxId, input.publishAttempt);
    const ownershipRows = claimRowsSchema.parse(
      (
        await this.db.execute<Record<string, unknown>>(sql`
			WITH locked_outbox AS MATERIALIZED (
				UPDATE ${retentionPushOutbox} AS outbox
				SET
					"status" = 'PUBLISHED'::"RetentionOutboxStatus",
					"lockedAt" = NULL,
					"publishedAt" = COALESCE(outbox."publishedAt", CURRENT_TIMESTAMP),
					"lastError" = NULL,
					"updatedAt" = CURRENT_TIMESTAMP
				WHERE outbox."id" = ${input.outboxId}
					AND outbox."status" IN (
						'PROCESSING'::"RetentionOutboxStatus",
						'PUBLISHED'::"RetentionOutboxStatus"
					)
					AND (${input.publishAttempt ?? null}::INTEGER IS NULL OR outbox."attempts" = ${input.publishAttempt ?? null})
					AND EXISTS (
						SELECT 1
						FROM ${pushDispatch} AS dispatch
						WHERE dispatch."id" = outbox."dispatchId"
							AND (
								dispatch."status" = 'PENDING'::"PushDispatchStatus"
								OR (
									dispatch."status" = 'PROCESSING'::"PushDispatchStatus"
									AND dispatch."processingJobId" = ${input.processingJobId}
									AND COALESCE(dispatch."processingJobAttempt", 0) < ${input.processingJobAttempt}
								)
							)
					)
				RETURNING outbox."id", outbox."dispatchId", outbox."attempts" AS "publishAttempt"
			),
			claimed_dispatch AS MATERIALIZED (
				UPDATE ${pushDispatch} AS dispatch
				SET
					"status" = 'PROCESSING'::"PushDispatchStatus",
					"skipReason" = NULL,
					"processingJobId" = ${input.processingJobId},
					"processingJobAttempt" = ${input.processingJobAttempt},
					"processingStartedAt" = ${sql.param(input.startedAt, pushDispatch.processingStartedAt)},
					"deliveryAttemptCount" = dispatch."deliveryAttemptCount" + 1,
					"lastError" = NULL,
					"updatedAt" = CURRENT_TIMESTAMP
				FROM locked_outbox AS outbox
				WHERE outbox."dispatchId" = dispatch."id"
					AND (
						dispatch."status" = 'PENDING'::"PushDispatchStatus"
						OR (
							dispatch."status" = 'PROCESSING'::"PushDispatchStatus"
							AND dispatch."processingJobId" = ${input.processingJobId}
							AND COALESCE(dispatch."processingJobAttempt", 0) < ${input.processingJobAttempt}
						)
					)
				RETURNING
					dispatch."id" AS "dispatchId",
					dispatch."deliveryAttemptCount",
					outbox."publishAttempt"
			),
			ownership AS (
				SELECT COUNT(*)::INTEGER AS "ownedOutboxCount"
				FROM locked_outbox
			)
			SELECT
				claimed."dispatchId",
				claimed."deliveryAttemptCount",
				claimed."publishAttempt",
				ownership."ownedOutboxCount"
			FROM claimed_dispatch AS claimed
			CROSS JOIN ownership
			UNION ALL
			SELECT NULL, NULL, NULL, ownership."ownedOutboxCount"
			FROM ownership
			WHERE ownership."ownedOutboxCount" > 0
				AND NOT EXISTS (SELECT 1 FROM claimed_dispatch)
		`)
      ).rows,
    );
    const ownedOutboxCount = ownershipRows[0]?.ownedOutboxCount ?? 0;
    const claim = ownershipRows.find(
      (row) =>
        row.dispatchId != null && row.deliveryAttemptCount != null && row.publishAttempt != null,
    );
    const claimedDispatchCount = claim ? 1 : 0;
    if (claimedDispatchCount !== ownedOutboxCount) {
      throw new Error(
        `Retention delivery claim ownership fence mismatch: owned=${ownedOutboxCount}, claimed=${claimedDispatchCount}`,
      );
    }
    if (!claim) {
      return null;
    }
    if (
      claim.dispatchId == null ||
      claim.deliveryAttemptCount == null ||
      claim.publishAttempt == null
    ) {
      throw new Error("Retention delivery claim returned an incomplete fence");
    }
    const dispatchId = claim.dispatchId;
    const dispatch = await this.db.query.pushDispatch.findFirst({
      columns: {
        id: true,
        processingJobId: true,
        deliveryAttemptCount: true,
        notificationId: true,
        userId: true,
        timezone: true,
        campaignKey: true,
        variantId: true,
        rateLimitReservedAt: true,
      },
      where: { id: dispatchId },
      with: {
        notification: { columns: { title: true, body: true, actionUrl: true } },
        user: {
          with: {
            preference: { columns: { pushEnabled: true, nightPushEnabled: true } },
            consent: { columns: { marketingPushAgreedAt: true } },
            pushTokens: { columns: { id: true, token: true }, where: { isActive: true } },
          },
        },
      },
    });
    if (
      !dispatch ||
      dispatch.processingJobId !== input.processingJobId ||
      dispatch.deliveryAttemptCount !== claim.deliveryAttemptCount
    ) {
      throw new Error("Retention delivery claim hydration fence mismatch");
    }
    return {
      fence: {
        outboxId: input.outboxId,
        dispatchId: dispatch.id,
        publishAttempt: claim.publishAttempt,
        processingJobId: input.processingJobId,
        deliveryAttemptCount: claim.deliveryAttemptCount,
      },
      outboxId: input.outboxId,
      dispatchId: dispatch.id,
      notificationId: dispatch.notificationId,
      userId: dispatch.userId,
      title: dispatch.notification.title,
      body: dispatch.notification.body,
      actionUrl: dispatch.notification.actionUrl ?? "/feed",
      campaignKey: dispatch.campaignKey ?? RETENTION_CAMPAIGN_KEY,
      variantId: dispatch.variantId ?? "unknown",
      timezone: dispatch.timezone,
      pushEnabled: dispatch.user.preference?.pushEnabled ?? false,
      nightPushEnabled: dispatch.user.preference?.nightPushEnabled ?? false,
      marketingPushAgreedAt: dispatch.user.consent?.marketingPushAgreedAt ?? null,
      rateLimitReserved: dispatch.rateLimitReservedAt != null,
      tokens: dispatch.user.pushTokens,
    };
  }

  async releaseDispatchForRetry(input: {
    readonly fence: RetentionDispatchFence;
    readonly reason: string;
    readonly availableAt: Date;
    readonly hasExhaustedRetries: boolean;
  }): Promise<boolean> {
    const released =
      (await (
        await this.db.execute<Record<string, unknown>>(sql`
			WITH locked_outbox AS MATERIALIZED (
				SELECT outbox."id", outbox."dispatchId"
				FROM ${retentionPushOutbox} AS outbox
				WHERE outbox."id" = ${input.fence.outboxId}
					AND outbox."dispatchId" = ${input.fence.dispatchId}
					AND outbox."status" IN (
						'PROCESSING'::"RetentionOutboxStatus",
						'PUBLISHED'::"RetentionOutboxStatus"
					)
					AND outbox."attempts" = ${input.fence.publishAttempt}
				FOR UPDATE OF outbox
			),
			released AS (
				UPDATE ${pushDispatch} AS dispatch
				SET
					"status" = ${input.hasExhaustedRetries ? "FAILED" : "PENDING"}::"PushDispatchStatus",
					"skipReason" = ${input.reason.slice(0, 100)},
					"processingJobId" = NULL,
					"processingJobAttempt" = NULL,
					"processingStartedAt" = NULL,
					"lastError" = ${input.reason.slice(0, 500)},
					"updatedAt" = CURRENT_TIMESTAMP
				FROM locked_outbox AS outbox
				WHERE dispatch."id" = ${input.fence.dispatchId}
					AND dispatch."status" = 'PROCESSING'::"PushDispatchStatus"
					AND dispatch."processingJobId" = ${input.fence.processingJobId}
					AND dispatch."deliveryAttemptCount" = ${input.fence.deliveryAttemptCount}
					AND outbox."dispatchId" = dispatch."id"
				RETURNING dispatch."id", outbox."id" AS "outboxId"
			)
			UPDATE ${retentionPushOutbox} AS outbox
			SET
				"status" = ${input.hasExhaustedRetries ? "FAILED" : "PENDING"}::"RetentionOutboxStatus",
				"availableAt" = ${sql.param(input.availableAt, retentionPushOutbox.availableAt)},
				"lockedAt" = NULL,
				"publishedAt" = NULL,
				"lastError" = ${input.reason.slice(0, 500)},
				"updatedAt" = CURRENT_TIMESTAMP
			FROM released
			WHERE outbox."id" = released."outboxId"
		`)
      ).rowCount) ?? 0;
    return released === 1;
  }

  async reopenUnclaimedDispatch(input: {
    readonly outboxId: string;
    readonly publishAttempt?: number;
    readonly availableAt: Date;
    readonly reason: string;
  }): Promise<boolean> {
    await this.#lockOutboxGeneration(input.outboxId, input.publishAttempt);
    const reopened =
      (await (
        await this.db.execute<Record<string, unknown>>(sql`
			UPDATE ${retentionPushOutbox} AS outbox
			SET
				"status" = 'PENDING'::"RetentionOutboxStatus",
				"availableAt" = ${sql.param(input.availableAt, retentionPushOutbox.availableAt)},
				"lockedAt" = NULL,
				"publishedAt" = NULL,
				"lastError" = ${input.reason.slice(0, 500)},
				"updatedAt" = CURRENT_TIMESTAMP
			WHERE outbox."id" = ${input.outboxId}
				AND (${input.publishAttempt ?? null}::INTEGER IS NULL OR outbox."attempts" = ${input.publishAttempt ?? null})
				AND outbox."status" IN (
					'PROCESSING'::"RetentionOutboxStatus",
					'PUBLISHED'::"RetentionOutboxStatus"
				)
				AND EXISTS (
					SELECT 1 FROM ${pushDispatch} AS dispatch
					WHERE dispatch."id" = outbox."dispatchId"
						AND dispatch."status" = 'PENDING'::"PushDispatchStatus"
				)
		`)
      ).rowCount) ?? 0;
    return reopened === 1;
  }

  async #lockOutboxGeneration(outboxId: string, publishAttempt?: number): Promise<void> {
    await this.db
      .select({ id: retentionPushOutbox.id })
      .from(retentionPushOutbox)
      .where(
        and(
          eq(retentionPushOutbox.id, outboxId),
          inArray(retentionPushOutbox.status, ["PROCESSING", "PUBLISHED"]),
          publishAttempt == null ? undefined : eq(retentionPushOutbox.attempts, publishAttempt),
        ),
      )
      .limit(1)
      .for("update");
  }

  async markRateLimitReserved(fence: RetentionDispatchFence, reservedAt: Date): Promise<boolean> {
    const reserved =
      (await (
        await this.db.execute<Record<string, unknown>>(sql`
			UPDATE ${pushDispatch} AS dispatch
			SET "rateLimitReservedAt" = ${sql.param(reservedAt, pushDispatch.rateLimitReservedAt)}, "updatedAt" = CURRENT_TIMESTAMP
			WHERE dispatch."id" = ${fence.dispatchId}
				AND dispatch."status" = 'PROCESSING'::"PushDispatchStatus"
				AND dispatch."processingJobId" = ${fence.processingJobId}
				AND dispatch."deliveryAttemptCount" = ${fence.deliveryAttemptCount}
				AND dispatch."rateLimitReservedAt" IS NULL
				AND EXISTS (
					SELECT 1 FROM ${retentionPushOutbox} AS outbox
					WHERE outbox."id" = ${fence.outboxId}
						AND outbox."dispatchId" = dispatch."id"
						AND outbox."attempts" = ${fence.publishAttempt}
						AND outbox."status" IN (
							'PROCESSING'::"RetentionOutboxStatus",
							'PUBLISHED'::"RetentionOutboxStatus"
						)
				)
		`)
      ).rowCount) ?? 0;
    return reserved === 1;
  }

  async markDispatchSkipped(fence: RetentionDispatchFence, reason: string): Promise<boolean> {
    const finalized =
      (await (
        await this.db.execute<Record<string, unknown>>(sql`
			WITH locked_outbox AS MATERIALIZED (
				SELECT outbox."id", outbox."dispatchId"
				FROM ${retentionPushOutbox} AS outbox
				WHERE outbox."id" = ${fence.outboxId}
					AND outbox."dispatchId" = ${fence.dispatchId}
					AND outbox."attempts" = ${fence.publishAttempt}
					AND outbox."status" IN (
						'PROCESSING'::"RetentionOutboxStatus",
						'PUBLISHED'::"RetentionOutboxStatus"
					)
				FOR UPDATE OF outbox
			),
			finalized AS (
				UPDATE ${pushDispatch} AS dispatch
				SET
					"status" = 'SKIPPED'::"PushDispatchStatus",
					"skipReason" = ${reason.slice(0, 100)},
					"processingJobId" = NULL,
					"processingJobAttempt" = NULL,
					"processingStartedAt" = NULL,
					"lastError" = NULL,
					"updatedAt" = CURRENT_TIMESTAMP
				FROM locked_outbox AS outbox
				WHERE dispatch."id" = ${fence.dispatchId}
					AND dispatch."status" = 'PROCESSING'::"PushDispatchStatus"
					AND dispatch."processingJobId" = ${fence.processingJobId}
					AND dispatch."deliveryAttemptCount" = ${fence.deliveryAttemptCount}
					AND outbox."dispatchId" = dispatch."id"
				RETURNING dispatch."id"
			)
			UPDATE ${retentionPushOutbox} AS outbox
			SET "status" = 'PUBLISHED'::"RetentionOutboxStatus", "lockedAt" = NULL
			FROM finalized
			WHERE outbox."id" = ${fence.outboxId}
				AND outbox."dispatchId" = finalized."id"
				AND outbox."attempts" = ${fence.publishAttempt}
		`)
      ).rowCount) ?? 0;
    return finalized === 1;
  }

  async recordDeliveryResults(
    fence: RetentionDispatchFence,
    results: RetentionDeliveryResult[],
  ): Promise<boolean> {
    const tokens =
      results.length === 0
        ? []
        : await this.db
            .select({ id: pushToken.id, token: pushToken.token })
            .from(pushToken)
            .where(
              inArray(
                pushToken.token,
                results.map((result) => result.token),
              ),
            );
    const ids = new Map(tokens.map((token) => [token.token, token.id]));
    const sent = results.some((result) => result.success);
    const finalized = finalizedRowsSchema.parse(
      (
        await this.db.execute<Record<string, unknown>>(sql`
			WITH locked_outbox AS MATERIALIZED (
				SELECT outbox."id", outbox."dispatchId"
				FROM ${retentionPushOutbox} AS outbox
				WHERE outbox."id" = ${fence.outboxId}
					AND outbox."dispatchId" = ${fence.dispatchId}
					AND outbox."attempts" = ${fence.publishAttempt}
					AND outbox."status" IN (
						'PROCESSING'::"RetentionOutboxStatus",
						'PUBLISHED'::"RetentionOutboxStatus"
					)
				FOR UPDATE OF outbox
			)
			UPDATE ${pushDispatch} AS dispatch
			SET
				"status" = ${sent ? "SENT" : "FAILED"}::"PushDispatchStatus",
				"sentAt" = ${sql.param(sent ? now() : null, pushDispatch.sentAt)},
				"processingJobId" = NULL,
				"processingJobAttempt" = NULL,
				"processingStartedAt" = NULL,
				"lastError" = NULL,
				"updatedAt" = CURRENT_TIMESTAMP
			FROM locked_outbox AS outbox
			WHERE dispatch."id" = ${fence.dispatchId}
				AND dispatch."status" = 'PROCESSING'::"PushDispatchStatus"
				AND dispatch."processingJobId" = ${fence.processingJobId}
				AND dispatch."deliveryAttemptCount" = ${fence.deliveryAttemptCount}
				AND outbox."dispatchId" = dispatch."id"
			RETURNING dispatch."id" AS "dispatchId"
		`)
      ).rows,
    );
    if (finalized.length !== 1) {
      return false;
    }
    const attempts = results.flatMap((result) => {
      const pushTokenId = ids.get(result.token);
      if (!pushTokenId) {
        return [];
      }
      return [
        {
          dispatchId: fence.dispatchId,
          pushTokenId,
          status: result.success ? ("TICKET_ACCEPTED" as const) : ("FAILED" as const),
          expoTicketId: result.ticketId ?? null,
          tokenFingerprint: pushTokenFingerprint(result.token),
          errorCode: result.errorCode ?? null,
          errorMessage: result.error?.slice(0, 500) ?? null,
        },
      ];
    });
    if (attempts.length > 0) {
      await this.db
        .insert(pushDeliveryAttempt)
        .values(attempts)
        .onConflictDoUpdate({
          target: [pushDeliveryAttempt.dispatchId, pushDeliveryAttempt.pushTokenId],
          set: {
            status: excluded(pushDeliveryAttempt.status),
            expoTicketId: excluded(pushDeliveryAttempt.expoTicketId),
            tokenFingerprint: excluded(pushDeliveryAttempt.tokenFingerprint),
            errorCode: excluded(pushDeliveryAttempt.errorCode),
            errorMessage: excluded(pushDeliveryAttempt.errorMessage),
            receiptCheckedAt: null,
          },
        });
    }
    const terminalOutbox = await this.db
      .update(retentionPushOutbox)
      .set({ status: "PUBLISHED", lockedAt: null })
      .where(
        and(
          eq(retentionPushOutbox.id, fence.outboxId),
          eq(retentionPushOutbox.dispatchId, fence.dispatchId),
          eq(retentionPushOutbox.attempts, fence.publishAttempt),
          inArray(retentionPushOutbox.status, ["PROCESSING", "PUBLISHED"]),
        ),
      )
      .returning({ id: retentionPushOutbox.id });
    if (terminalOutbox.length !== 1) {
      throw new Error(`Retention outbox terminal fence lost: outboxId=${fence.outboxId}`);
    }
    const invalidTokens = results
      .filter((result) => result.errorCode === "DeviceNotRegistered")
      .map((result) => result.token);
    if (invalidTokens.length > 0) {
      await this.db
        .update(pushToken)
        .set({ isActive: false })
        .where(inArray(pushToken.token, invalidTokens));
    }
    return true;
  }
}
