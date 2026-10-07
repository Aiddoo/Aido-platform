import { TransactionHost } from "@nestjs-cls/transactional";
import { Inject, Injectable } from "@nestjs/common";
import { and } from "@prisma/orm-postgres/orm-client";
import sql, { join } from "sql-template-tag";
import { z } from "zod";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "#api/shared/application/ports/index";
import {
	decodeRecord,
	encodeCreate,
	encodePatch,
} from "#api/shared/infrastructure/database/database-records";
import {
	decodeSqlRows,
	sqlRowSpec,
	sqlStatement,
} from "#api/shared/infrastructure/database/database-sql";
import { createEntityId, varchar } from "#api/shared/infrastructure/database/database-values";
import { requireRecord } from "#api/shared/infrastructure/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/shared/infrastructure/database/prisma8-transactional.adapter";

import type {
	ClaimedOutbox,
	CreateRetentionDeliveryInput,
	RetentionDeliveryResult,
	RetentionDispatchCandidate,
	RetentionDispatchFence,
	RetentionRepositoryPort,
	RetentionStageCandidate,
} from "../../application/ports/retention.repository.port.js";
import {
	RETENTION_CAMPAIGN_KEY,
	RETENTION_EXPERIMENT_KEY,
	RETENTION_STAGE_NAMES,
} from "../../domain/retention.constants.js";
import { localDateString } from "../../domain/services/stage-policy.js";

@Injectable()
export class PrismaRetentionRepository implements RetentionRepositoryPort {
	constructor(
		private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>,
		@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
	) {}

	private get client() {
		return this.txHost.tx;
	}

	async enroll(input: {
		userId: string;
		variant: "CONTROL" | "TREATMENT";
		startedAt: Date | null;
	}): Promise<void> {
		await this.uow.run(async () => {
			const assignmentId = createEntityId();
			const assignment = await this.client.orm.public.RetentionExperimentAssignment.select(
				"id",
			).upsert({
				conflictOn: encodePatch("RetentionExperimentAssignment", {
					userId: input.userId,
					experimentKey: RETENTION_EXPERIMENT_KEY,
				}),
				create: encodeCreate("RetentionExperimentAssignment", {
					id: assignmentId,
					userId: input.userId,
					experimentKey: RETENTION_EXPERIMENT_KEY,
					variant: input.variant,
					startedAt: input.startedAt,
				}),
				update: {},
			});
			if (input.startedAt === null || assignment.id !== assignmentId) return;
			await this.client.orm.public.RetentionExperimentStage.createAndCount(
				RETENTION_STAGE_NAMES.map((stage) =>
					encodeCreate("RetentionExperimentStage", { assignmentId, stage }),
				),
			);
		});
	}

	async activate(userId: string, startedAt: Date): Promise<boolean> {
		const claimed = {
			count: await this.client.orm.public.RetentionExperimentAssignment.where((row) =>
				and(
					row.userId.eq(userId),
					row.experimentKey.eq(varchar(RETENTION_EXPERIMENT_KEY, 100)),
					row.startedAt.isNull(),
				),
			).updateAndCount(encodePatch("RetentionExperimentAssignment", { startedAt })),
		};
		if (claimed.count !== 1) return false;
		const assignment = decodeRecord(
			"RetentionExperimentAssignment",
			requireRecord(
				await this.client.orm.public.RetentionExperimentAssignment.where((row) =>
					and(row.userId.eq(userId), row.experimentKey.eq(varchar(RETENTION_EXPERIMENT_KEY, 100))),
				)
					.select("id")
					.first(),
			),
		);
		await this.client.orm.public.RetentionExperimentStage.createAndCount(
			RETENTION_STAGE_NAMES.map((stage) => ({
				assignmentId: assignment.id,
				stage,
			})).map((value) => encodeCreate("RetentionExperimentStage", value)),
			{ onConflict: "skip" },
		);
		return true;
	}

	async findScheduledStages(limit: number): Promise<RetentionStageCandidate[]> {
		const sqlRows1 = sqlRowSpec({
			assignmentId: "pg/text@1",
			stageId: "pg/text@1",
			userId: "pg/text@1",
			variant: "pg/text@1",
			stage: "pg/text@1",
			startedAt: "pg/timestamp-string@1",
			timezone: "pg/text@1",
			locale: "pg/text@1",
			pushEnabled: "pg/bool@1",
			nightPushEnabled: "pg/bool@1",
			marketingPushAgreedAt: { codecId: "pg/timestamp-string@1", nullable: true },
			activeTokenCount: "pg/int4@1",
			lastActiveAt: { codecId: "pg/timestamp-string@1", nullable: true },
			todoCount: "pg/int4@1",
			completedCount: "pg/int4@1",
			todoActionWithinWindow: "pg/bool@1",
		});

		const perStageLimit = Math.max(1, Math.ceil(limit / RETENTION_STAGE_NAMES.length));
		const rows = decodeSqlRows(
			sqlRows1,
			await this.client.query(
				sqlStatement(
					this.client,
					sql`
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
				FROM "RetentionExperimentStage" AS stage
				INNER JOIN "RetentionExperimentAssignment" AS assignment
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
				assignment."startedAt" AS "startedAt",
				COALESCE(valid_timezone.name, 'UTC') AS "timezone",
				COALESCE(preference."locale", 'ko') AS "locale",
				COALESCE(preference."pushEnabled", FALSE) AS "pushEnabled",
				COALESCE(preference."nightPushEnabled", FALSE) AS "nightPushEnabled",
				consent."marketingPushAgreedAt" AS "marketingPushAgreedAt",
				COALESCE(token_metrics."activeTokenCount", 0)::INT AS "activeTokenCount",
				app_user."lastActiveAt" AS "lastActiveAt",
				COALESCE(todo_metrics."todoCount", 0)::INT AS "todoCount",
				COALESCE(todo_metrics."completedCount", 0)::INT AS "completedCount",
				COALESCE(todo_metrics."todoActionWithinWindow", FALSE) AS "todoActionWithinWindow"
			FROM ranked_stages AS ranked
			INNER JOIN "RetentionExperimentAssignment" AS assignment
				ON assignment."id" = ranked."assignmentId"
			INNER JOIN "User" AS app_user
				ON app_user."id" = assignment."userId"
			LEFT JOIN "UserPreference" AS preference
				ON preference."userId" = app_user."id"
			LEFT JOIN valid_timezones AS valid_timezone
				ON valid_timezone.name = preference."timezone"
			LEFT JOIN "UserConsent" AS consent
				ON consent."userId" = app_user."id"
			LEFT JOIN LATERAL (
				SELECT COUNT(*) AS "activeTokenCount"
				FROM "PushToken" AS token
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
				FROM "Todo" AS todo
				WHERE todo."userId" = app_user."id"
			) AS todo_metrics ON TRUE
			WHERE ranked.stage_rank <= ${perStageLimit}
			ORDER BY ranked."createdAt" ASC
		`,
				)
					.returnsRow(sqlRows1)
					.build(),
			),
		).map((row) => ({
			...row,
			variant: z.enum(["CONTROL", "TREATMENT"]).parse(row["variant"]),
			stage: z.enum(["D0", "D1", "D3", "D7"]).parse(row["stage"]),
		}));

		return rows.map((row) => ({
			...row,
			locale: row.locale === "en" ? "en" : "ko",
			incompleteCount: row.todoCount - row.completedCount,
		}));
	}

	async markStageSkipped(stageId: string, reason: string): Promise<boolean> {
		const result = {
			count: await this.client.orm.public.RetentionExperimentStage.where((row) =>
				and(row.id.eq(stageId), row.status.eq("SCHEDULED")),
			).updateAndCount(
				encodePatch("RetentionExperimentStage", {
					status: "SKIPPED",
					skipReason: reason,
					processedAt: new Date(),
				}),
			),
		};
		return result.count === 1;
	}

	async createDelivery(input: CreateRetentionDeliveryInput): Promise<boolean> {
		const claimed = {
			count: await this.client.orm.public.RetentionExperimentStage.where((row) =>
				and(row.id.eq(input.stageId), row.status.eq("SCHEDULED")),
			).updateAndCount(
				encodePatch("RetentionExperimentStage", { status: "OUTBOXED", processedAt: new Date() }),
			),
		};
		if (claimed.count !== 1) return false;

		const notification = decodeRecord(
			"Notification",
			await this.client.orm.public.Notification.select("id").create(
				encodeCreate("Notification", {
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
				}),
			),
		);
		const localDate = new Date(`${localDateString(new Date(), input.timezone)}T00:00:00.000Z`);
		const dispatch = decodeRecord(
			"PushDispatch",
			await this.client.orm.public.PushDispatch.select("id").create(
				encodeCreate("PushDispatch", {
					notificationId: notification.id,
					userId: input.userId,
					purpose: "ENGAGEMENT",
					campaignKey: RETENTION_CAMPAIGN_KEY,
					variantId: input.variantId,
					timezone: input.timezone,
					localDate,
					status: "PENDING",
				}),
			),
		);
		decodeRecord(
			"RetentionPushOutbox",
			await this.client.orm.public.RetentionPushOutbox.create(
				encodeCreate("RetentionPushOutbox", {
					stageId: input.stageId,
					notificationId: notification.id,
					dispatchId: dispatch.id,
				}),
			),
		);
		decodeRecord(
			"RetentionExperimentStage",
			requireRecord(
				await this.client.orm.public.RetentionExperimentStage.where((row) =>
					row.id.eq(input.stageId),
				).update(encodePatch("RetentionExperimentStage", { notificationId: notification.id })),
			),
		);
		return true;
	}

	async recordD7Result(input: {
		assignmentId: string;
		returnedWithinD7: boolean;
		todoActionWithinD7: boolean;
	}): Promise<void> {
		decodeRecord(
			"RetentionExperimentResult",
			await this.client.orm.public.RetentionExperimentResult.where((row) =>
				row.assignmentId.eq(input.assignmentId),
			).upsert({
				conflictOn: encodePatch("RetentionExperimentResult", { assignmentId: input.assignmentId }),
				create: encodeCreate("RetentionExperimentResult", input),
				update: encodePatch("RetentionExperimentResult", {
					returnedWithinD7: input.returnedWithinD7,
					todoActionWithinD7: input.todoActionWithinD7,
					measuredAt: new Date(),
				}),
			}),
		);
	}

	async recoverStaleOutboxes(cutoff: Date): Promise<number> {
		return this.client
			.execute(
				sqlStatement(
					this.client,
					sql`
			WITH locked_outboxes AS MATERIALIZED (
				SELECT outbox."id"
				FROM "RetentionPushOutbox" AS outbox
				INNER JOIN "PushDispatch" AS dispatch
					ON dispatch."id" = outbox."dispatchId"
				WHERE outbox."status" = 'PROCESSING'::"RetentionOutboxStatus"
					AND outbox."lockedAt" < ${cutoff}
					AND dispatch."status" <> 'PROCESSING'::"PushDispatchStatus"
				ORDER BY outbox."id" ASC
				FOR UPDATE OF outbox SKIP LOCKED
			)
			UPDATE "RetentionPushOutbox" AS outbox
			SET
				"status" = 'PENDING'::"RetentionOutboxStatus",
				"lockedAt" = NULL,
				"updatedAt" = CURRENT_TIMESTAMP
			FROM locked_outboxes
			WHERE outbox."id" = locked_outboxes."id"
				AND outbox."status" = 'PROCESSING'::"RetentionOutboxStatus"
		`,
				)
					.affectedCount()
					.build(),
			)
			.then((result) => result.affectedRows);
	}

	recoverStaleDispatches(cutoff: Date): Promise<number> {
		return this.client
			.execute(
				sqlStatement(
					this.client,
					sql`
			WITH locked_outboxes AS MATERIALIZED (
				SELECT outbox."id", outbox."dispatchId"
				FROM "RetentionPushOutbox" AS outbox
				INNER JOIN "PushDispatch" AS dispatch
					ON dispatch."id" = outbox."dispatchId"
				WHERE dispatch."status" = 'PROCESSING'::"PushDispatchStatus"
					AND dispatch."processingStartedAt" < ${cutoff}
					AND NOT EXISTS (
						SELECT 1 FROM "PushDispatchOutbox" AS general
						WHERE general."dispatchId" = dispatch."id"
					)
				ORDER BY outbox."id" ASC
				FOR UPDATE OF outbox SKIP LOCKED
			),
			recovered AS (
				UPDATE "PushDispatch" AS dispatch
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
					AND dispatch."processingStartedAt" < ${cutoff}
					AND NOT EXISTS (
						SELECT 1 FROM "PushDispatchOutbox" AS general
						WHERE general."dispatchId" = dispatch."id"
					)
				RETURNING dispatch."id"
			)
			UPDATE "RetentionPushOutbox" AS outbox
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
		`,
				)
					.affectedCount()
					.build(),
			)
			.then((result) => result.affectedRows);
	}

	async claimOutboxes(limit: number, now: Date): Promise<ClaimedOutbox[]> {
		const sqlRows2 = sqlRowSpec({ id: "pg/text@1", attempts: "pg/int4@1" });

		return this.client
			.query(
				sqlStatement(
					this.client,
					sql`
			UPDATE "RetentionPushOutbox" AS outbox
			SET
				"status" = 'PROCESSING',
				"lockedAt" = ${now},
				"attempts" = outbox."attempts" + 1,
				"updatedAt" = NOW()
			WHERE outbox."id" IN (
				SELECT candidate."id"
				FROM "RetentionPushOutbox" AS candidate
				WHERE candidate."status" = 'PENDING'
					AND candidate."availableAt" <= ${now}
				ORDER BY candidate."availableAt" ASC, candidate."id" ASC
				LIMIT ${limit}
				FOR UPDATE SKIP LOCKED
			)
			RETURNING outbox."id", outbox."attempts"
		`,
				)
					.returnsRow(sqlRows2)
					.build(),
			)
			.then((rows) => decodeSqlRows(sqlRows2, rows));
	}

	async markOutboxPublished(outbox: ClaimedOutbox): Promise<void> {
		await this.client.orm.public.RetentionPushOutbox.where((row) =>
			and(row.id.eq(outbox.id), row.attempts.eq(outbox.attempts), row.status.eq("PROCESSING")),
		).updateAndCount(
			encodePatch("RetentionPushOutbox", {
				status: "PUBLISHED",
				publishedAt: new Date(),
				lockedAt: null,
			}),
		);
	}

	async deferOutbox(input: {
		readonly outboxId: string;
		readonly publishAttempt?: number;
		readonly availableAt: Date;
	}): Promise<void> {
		await this.#lockOutboxGeneration(input.outboxId, input.publishAttempt);
		await this.client
			.execute(
				sqlStatement(
					this.client,
					sql`
			UPDATE "RetentionPushOutbox" AS outbox
			SET
				"status" = 'PENDING'::"RetentionOutboxStatus",
				"availableAt" = ${input.availableAt},
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
					FROM "PushDispatch" AS dispatch
					WHERE dispatch."id" = outbox."dispatchId"
						AND dispatch."status" = 'PENDING'::"PushDispatchStatus"
				)
		`,
				)
					.affectedCount()
					.build(),
			)
			.then((result) => result.affectedRows);
	}

	async markOutboxFailed(input: {
		outboxId: string;
		publishAttempt: number;
		hasExhaustedRetries: boolean;
		error: string;
		nextAttemptAt: Date;
	}): Promise<void> {
		await this.client.orm.public.RetentionPushOutbox.where((row) =>
			and(
				row.id.eq(input.outboxId),
				row.attempts.eq(input.publishAttempt),
				row.status.eq("PROCESSING"),
			),
		).updateAndCount(
			encodePatch("RetentionPushOutbox", {
				status: input.hasExhaustedRetries ? "FAILED" : "PENDING",
				availableAt: input.nextAttemptAt,
				lockedAt: null,
				lastError: input.error.slice(0, 500),
			}),
		);
	}

	async claimDispatch(input: {
		readonly outboxId: string;
		readonly publishAttempt?: number;
		readonly processingJobId: string;
		readonly processingJobAttempt: number;
		readonly startedAt: Date;
	}): Promise<RetentionDispatchCandidate | null> {
		const sqlRows3 = sqlRowSpec({
			dispatchId: { codecId: "pg/int4@1", nullable: true },
			deliveryAttemptCount: { codecId: "pg/int4@1", nullable: true },
			publishAttempt: { codecId: "pg/int4@1", nullable: true },
			ownedOutboxCount: "pg/int4@1",
		});

		await this.#lockOutboxGeneration(input.outboxId, input.publishAttempt);
		const ownershipRows = decodeSqlRows(
			sqlRows3,
			await this.client.query(
				sqlStatement(
					this.client,
					sql`
			WITH locked_outbox AS MATERIALIZED (
				UPDATE "RetentionPushOutbox" AS outbox
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
						FROM "PushDispatch" AS dispatch
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
				UPDATE "PushDispatch" AS dispatch
				SET
					"status" = 'PROCESSING'::"PushDispatchStatus",
					"skipReason" = NULL,
					"processingJobId" = ${input.processingJobId},
					"processingJobAttempt" = ${input.processingJobAttempt},
					"processingStartedAt" = ${input.startedAt},
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
		`,
				)
					.returnsRow(sqlRows3)
					.build(),
			),
		);
		const ownedOutboxCount = ownershipRows[0]?.ownedOutboxCount ?? 0;
		const claim = ownershipRows.find(
			(row) =>
				row.dispatchId !== null && row.deliveryAttemptCount !== null && row.publishAttempt !== null,
		);
		const claimedDispatchCount = claim ? 1 : 0;
		if (claimedDispatchCount !== ownedOutboxCount) {
			throw new Error(
				`Retention delivery claim ownership fence mismatch: owned=${ownedOutboxCount}, claimed=${claimedDispatchCount}`,
			);
		}
		if (!claim) return null;
		if (
			claim.dispatchId === null ||
			claim.deliveryAttemptCount === null ||
			claim.publishAttempt === null
		) {
			throw new Error("Retention delivery claim returned an incomplete fence");
		}
		const dispatchId = claim.dispatchId;
		const dispatch = decodeRecord(
			"PushDispatch",
			await this.client.orm.public.PushDispatch.where((row) => row.id.eq(dispatchId))
				.select(
					"id",
					"processingJobId",
					"deliveryAttemptCount",
					"notificationId",
					"userId",
					"timezone",
					"campaignKey",
					"variantId",
					"rateLimitReservedAt",
				)
				.include("notification", (related) => related.select("title", "body", "actionUrl"))
				.include("user", (related) =>
					related
						.include("preference", (related) => related.select("pushEnabled", "nightPushEnabled"))
						.include("consent", (related) => related.select("marketingPushAgreedAt"))
						.include("pushTokens", (related) =>
							related.where((row) => row.isActive.eq(true)).select("id", "token"),
						),
				)
				.first(),
		);
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
			title: requireRecord(dispatch.notification).title,
			body: requireRecord(dispatch.notification).body,
			actionUrl: requireRecord(dispatch.notification).actionUrl ?? "/feed",
			campaignKey: dispatch.campaignKey ?? RETENTION_CAMPAIGN_KEY,
			variantId: dispatch.variantId ?? "unknown",
			timezone: dispatch.timezone,
			pushEnabled: requireRecord(dispatch.user).preference?.pushEnabled ?? false,
			nightPushEnabled: requireRecord(dispatch.user).preference?.nightPushEnabled ?? false,
			marketingPushAgreedAt: requireRecord(dispatch.user).consent?.marketingPushAgreedAt ?? null,
			rateLimitReserved: dispatch.rateLimitReservedAt !== null,
			tokens: requireRecord(dispatch.user).pushTokens,
		};
	}

	async releaseDispatchForRetry(input: {
		readonly fence: RetentionDispatchFence;
		readonly reason: string;
		readonly availableAt: Date;
		readonly hasExhaustedRetries: boolean;
	}): Promise<boolean> {
		const released = await this.client
			.execute(
				sqlStatement(
					this.client,
					sql`
			WITH locked_outbox AS MATERIALIZED (
				SELECT outbox."id", outbox."dispatchId"
				FROM "RetentionPushOutbox" AS outbox
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
				UPDATE "PushDispatch" AS dispatch
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
			UPDATE "RetentionPushOutbox" AS outbox
			SET
				"status" = ${input.hasExhaustedRetries ? "FAILED" : "PENDING"}::"RetentionOutboxStatus",
				"availableAt" = ${input.availableAt},
				"lockedAt" = NULL,
				"publishedAt" = NULL,
				"lastError" = ${input.reason.slice(0, 500)},
				"updatedAt" = CURRENT_TIMESTAMP
			FROM released
			WHERE outbox."id" = released."outboxId"
		`,
				)
					.affectedCount()
					.build(),
			)
			.then((result) => result.affectedRows);
		return released === 1;
	}

	async reopenUnclaimedDispatch(input: {
		readonly outboxId: string;
		readonly publishAttempt?: number;
		readonly availableAt: Date;
		readonly reason: string;
	}): Promise<boolean> {
		await this.#lockOutboxGeneration(input.outboxId, input.publishAttempt);
		const reopened = await this.client
			.execute(
				sqlStatement(
					this.client,
					sql`
			UPDATE "RetentionPushOutbox" AS outbox
			SET
				"status" = 'PENDING'::"RetentionOutboxStatus",
				"availableAt" = ${input.availableAt},
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
					SELECT 1 FROM "PushDispatch" AS dispatch
					WHERE dispatch."id" = outbox."dispatchId"
						AND dispatch."status" = 'PENDING'::"PushDispatchStatus"
				)
		`,
				)
					.affectedCount()
					.build(),
			)
			.then((result) => result.affectedRows);
		return reopened === 1;
	}

	async #lockOutboxGeneration(outboxId: string, publishAttempt?: number): Promise<void> {
		await this.client
			.execute(
				sqlStatement(
					this.client,
					sql`
			SELECT outbox."id"
			FROM "RetentionPushOutbox" AS outbox
			WHERE outbox."id" = ${outboxId}
				AND (${publishAttempt ?? null}::INTEGER IS NULL OR outbox."attempts" = ${publishAttempt ?? null})
				AND outbox."status" IN (
					'PROCESSING'::"RetentionOutboxStatus",
					'PUBLISHED'::"RetentionOutboxStatus"
				)
			FOR UPDATE OF outbox
		`,
				)
					.affectedCount()
					.build(),
			)
			.then((result) => result.affectedRows);
	}

	async markRateLimitReserved(fence: RetentionDispatchFence, reservedAt: Date): Promise<boolean> {
		const reserved = await this.client
			.execute(
				sqlStatement(
					this.client,
					sql`
			UPDATE "PushDispatch" AS dispatch
			SET "rateLimitReservedAt" = ${reservedAt}, "updatedAt" = CURRENT_TIMESTAMP
			WHERE dispatch."id" = ${fence.dispatchId}
				AND dispatch."status" = 'PROCESSING'::"PushDispatchStatus"
				AND dispatch."processingJobId" = ${fence.processingJobId}
				AND dispatch."deliveryAttemptCount" = ${fence.deliveryAttemptCount}
				AND dispatch."rateLimitReservedAt" IS NULL
				AND EXISTS (
					SELECT 1 FROM "RetentionPushOutbox" AS outbox
					WHERE outbox."id" = ${fence.outboxId}
						AND outbox."dispatchId" = dispatch."id"
						AND outbox."attempts" = ${fence.publishAttempt}
						AND outbox."status" IN (
							'PROCESSING'::"RetentionOutboxStatus",
							'PUBLISHED'::"RetentionOutboxStatus"
						)
				)
		`,
				)
					.affectedCount()
					.build(),
			)
			.then((result) => result.affectedRows);
		return reserved === 1;
	}

	async markDispatchSkipped(fence: RetentionDispatchFence, reason: string): Promise<boolean> {
		const finalized = await this.client
			.execute(
				sqlStatement(
					this.client,
					sql`
			WITH locked_outbox AS MATERIALIZED (
				SELECT outbox."id", outbox."dispatchId"
				FROM "RetentionPushOutbox" AS outbox
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
				UPDATE "PushDispatch" AS dispatch
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
			UPDATE "RetentionPushOutbox" AS outbox
			SET "status" = 'PUBLISHED'::"RetentionOutboxStatus", "lockedAt" = NULL
			FROM finalized
			WHERE outbox."id" = ${fence.outboxId}
				AND outbox."dispatchId" = finalized."id"
				AND outbox."attempts" = ${fence.publishAttempt}
		`,
				)
					.affectedCount()
					.build(),
			)
			.then((result) => result.affectedRows);
		return finalized === 1;
	}

	async recordDeliveryResults(
		fence: RetentionDispatchFence,
		results: RetentionDeliveryResult[],
	): Promise<boolean> {
		const sqlRows4 = sqlRowSpec({ dispatchId: "pg/int4@1" });

		const tokens = decodeRecord(
			"PushToken",
			await this.client.orm.public.PushToken.where((row) =>
				row.token.in(results.map((result) => result.token).map((value) => varchar(value, 255))),
			)
				.select("id", "token")
				.all(),
		);
		const ids = new Map(tokens.map((token) => [token.token, token.id]));
		const sent = results.some((result) => result.success);
		const finalized = decodeSqlRows(
			sqlRows4,
			await this.client.query(
				sqlStatement(
					this.client,
					sql`
			WITH locked_outbox AS MATERIALIZED (
				SELECT outbox."id", outbox."dispatchId"
				FROM "RetentionPushOutbox" AS outbox
				WHERE outbox."id" = ${fence.outboxId}
					AND outbox."dispatchId" = ${fence.dispatchId}
					AND outbox."attempts" = ${fence.publishAttempt}
					AND outbox."status" IN (
						'PROCESSING'::"RetentionOutboxStatus",
						'PUBLISHED'::"RetentionOutboxStatus"
					)
				FOR UPDATE OF outbox
			)
			UPDATE "PushDispatch" AS dispatch
			SET
				"status" = ${sent ? "SENT" : "FAILED"}::"PushDispatchStatus",
				"sentAt" = ${sent ? new Date() : null},
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
		`,
				)
					.returnsRow(sqlRows4)
					.build(),
			),
		);
		if (finalized.length !== 1) return false;
		const attempts = results.flatMap((result) => {
			const pushTokenId = ids.get(result.token);
			if (!pushTokenId) return [];
			return [
				sql`(
						${fence.dispatchId}::INTEGER,
						${pushTokenId}::INTEGER,
						${result.success ? "TICKET_ACCEPTED" : "FAILED"}::"PushDeliveryStatus",
						${result.ticketId ?? null},
						${result.errorCode ?? null},
						${result.error?.slice(0, 500) ?? null},
						CURRENT_TIMESTAMP
					)`,
			];
		});
		if (attempts.length > 0) {
			await this.client
				.execute(
					sqlStatement(
						this.client,
						sql`
				INSERT INTO "PushDeliveryAttempt" (
					"dispatchId", "pushTokenId", "status", "expoTicketId",
					"errorCode", "errorMessage", "updatedAt"
				)
				VALUES ${join(attempts)}
				ON CONFLICT ("dispatchId", "pushTokenId") DO UPDATE SET
					"status" = EXCLUDED."status",
					"expoTicketId" = EXCLUDED."expoTicketId",
					"errorCode" = EXCLUDED."errorCode",
					"errorMessage" = EXCLUDED."errorMessage",
					"receiptCheckedAt" = NULL,
					"updatedAt" = CURRENT_TIMESTAMP
			`,
					)
						.affectedCount()
						.build(),
				)
				.then((result) => result.affectedRows);
		}
		const terminalOutbox = {
			count: await this.client.orm.public.RetentionPushOutbox.where((row) =>
				and(
					row.id.eq(fence.outboxId),
					row.dispatchId.eq(fence.dispatchId),
					row.attempts.eq(fence.publishAttempt),
					row.status.in(["PROCESSING", "PUBLISHED"]),
				),
			).updateAndCount(encodePatch("RetentionPushOutbox", { status: "PUBLISHED", lockedAt: null })),
		};
		if (terminalOutbox.count !== 1) {
			throw new Error(`Retention outbox terminal fence lost: outboxId=${fence.outboxId}`);
		}
		const invalidTokens = results
			.filter((result) => result.errorCode === "DeviceNotRegistered")
			.map((result) => result.token);
		if (invalidTokens.length > 0) {
			await this.client.orm.public.PushToken.where((row) =>
				row.token.in(invalidTokens.map((value) => varchar(value, 255))),
			).updateAndCount(encodePatch("PushToken", { isActive: false }));
		}
		return true;
	}
}
