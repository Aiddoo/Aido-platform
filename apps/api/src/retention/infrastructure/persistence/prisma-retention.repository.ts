import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import type {
	ClaimedOutbox,
	CreateRetentionDeliveryInput,
	RetentionDeliveryResult,
	RetentionDispatchCandidate,
	RetentionRepositoryPort,
	RetentionStageCandidate,
} from "../../application/ports/retention.repository.port";
import {
	RETENTION_CAMPAIGN_KEY,
	RETENTION_EXPERIMENT_KEY,
	RETENTION_STAGE_NAMES,
} from "../../domain/retention.constants";
import { localDateString } from "../../domain/services/stage-policy";

interface RetentionStageRow {
	readonly assignmentId: string;
	readonly stageId: string;
	readonly userId: string;
	readonly variant: "CONTROL" | "TREATMENT";
	readonly stage: "D0" | "D1" | "D3" | "D7";
	readonly startedAt: Date;
	readonly timezone: string;
	readonly locale: string;
	readonly pushEnabled: boolean;
	readonly nightPushEnabled: boolean;
	readonly marketingPushAgreedAt: Date | null;
	readonly activeTokenCount: number;
	readonly lastActiveAt: Date | null;
	readonly todoCount: number;
	readonly completedCount: number;
	readonly todoActionWithinWindow: boolean;
}

@Injectable()
export class PrismaRetentionRepository implements RetentionRepositoryPort {
	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
	) {}

	private get client() {
		return this.txHost.tx;
	}

	async enroll(input: {
		userId: string;
		variant: "CONTROL" | "TREATMENT";
		startedAt: Date | null;
	}): Promise<void> {
		await this.client.retentionExperimentAssignment.upsert({
			where: {
				userId_experimentKey: {
					userId: input.userId,
					experimentKey: RETENTION_EXPERIMENT_KEY,
				},
			},
			update: {},
			create: {
				userId: input.userId,
				experimentKey: RETENTION_EXPERIMENT_KEY,
				variant: input.variant,
				startedAt: input.startedAt,
				...(input.startedAt && {
					stages: { create: RETENTION_STAGE_NAMES.map((stage) => ({ stage })) },
				}),
			},
		});
	}

	async activate(userId: string, startedAt: Date): Promise<boolean> {
		const claimed = await this.client.retentionExperimentAssignment.updateMany({
			where: {
				userId,
				experimentKey: RETENTION_EXPERIMENT_KEY,
				startedAt: null,
			},
			data: { startedAt },
		});
		if (claimed.count !== 1) return false;
		const assignment =
			await this.client.retentionExperimentAssignment.findUniqueOrThrow({
				where: {
					userId_experimentKey: {
						userId,
						experimentKey: RETENTION_EXPERIMENT_KEY,
					},
				},
				select: { id: true },
			});
		await this.client.retentionExperimentStage.createMany({
			data: RETENTION_STAGE_NAMES.map((stage) => ({
				assignmentId: assignment.id,
				stage,
			})),
			skipDuplicates: true,
		});
		return true;
	}

	async findScheduledStages(limit: number): Promise<RetentionStageCandidate[]> {
		const perStageLimit = Math.max(
			1,
			Math.ceil(limit / RETENTION_STAGE_NAMES.length),
		);
		const rows = await this.client.$queryRaw<RetentionStageRow[]>`
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
		`;

		return rows.map((row) => ({
			...row,
			locale: row.locale === "en" ? "en" : "ko",
			incompleteCount: row.todoCount - row.completedCount,
		}));
	}

	async markStageSkipped(stageId: string, reason: string): Promise<boolean> {
		const result = await this.client.retentionExperimentStage.updateMany({
			where: { id: stageId, status: "SCHEDULED" },
			data: { status: "SKIPPED", skipReason: reason, processedAt: new Date() },
		});
		return result.count === 1;
	}

	async createDelivery(input: CreateRetentionDeliveryInput): Promise<boolean> {
		const claimed = await this.client.retentionExperimentStage.updateMany({
			where: { id: input.stageId, status: "SCHEDULED" },
			data: { status: "OUTBOXED", processedAt: new Date() },
		});
		if (claimed.count !== 1) return false;

		const notification = await this.client.notification.create({
			data: {
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
			},
			select: { id: true },
		});
		const localDate = new Date(
			`${localDateString(new Date(), input.timezone)}T00:00:00.000Z`,
		);
		const dispatch = await this.client.pushDispatch.create({
			data: {
				notificationId: notification.id,
				userId: input.userId,
				purpose: "ENGAGEMENT",
				campaignKey: RETENTION_CAMPAIGN_KEY,
				variantId: input.variantId,
				timezone: input.timezone,
				localDate,
				status: "PENDING",
			},
			select: { id: true },
		});
		await this.client.retentionPushOutbox.create({
			data: {
				stageId: input.stageId,
				notificationId: notification.id,
				dispatchId: dispatch.id,
			},
		});
		await this.client.retentionExperimentStage.update({
			where: { id: input.stageId },
			data: { notificationId: notification.id },
		});
		return true;
	}

	async recordD7Result(input: {
		assignmentId: string;
		returnedWithinD7: boolean;
		todoActionWithinD7: boolean;
	}): Promise<void> {
		await this.client.retentionExperimentResult.upsert({
			where: { assignmentId: input.assignmentId },
			create: input,
			update: {
				returnedWithinD7: input.returnedWithinD7,
				todoActionWithinD7: input.todoActionWithinD7,
				measuredAt: new Date(),
			},
		});
	}

	async recoverStaleOutboxes(cutoff: Date): Promise<number> {
		const result = await this.client.retentionPushOutbox.updateMany({
			where: { status: "PROCESSING", lockedAt: { lt: cutoff } },
			data: { status: "PENDING", lockedAt: null },
		});
		return result.count;
	}

	async claimOutboxes(limit: number, now: Date): Promise<ClaimedOutbox[]> {
		return this.client.$queryRaw<ClaimedOutbox[]>`
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
				ORDER BY candidate."createdAt" ASC
				LIMIT ${limit}
				FOR UPDATE SKIP LOCKED
			)
			RETURNING outbox."id", outbox."attempts"
		`;
	}

	async markOutboxPublished(outboxId: string): Promise<void> {
		await this.client.retentionPushOutbox.updateMany({
			where: { id: outboxId, status: "PROCESSING" },
			data: { status: "PUBLISHED", publishedAt: new Date(), lockedAt: null },
		});
	}

	async deferOutbox(outboxId: string, availableAt: Date): Promise<void> {
		await this.client.retentionPushOutbox.updateMany({
			where: { id: outboxId, status: { in: ["PUBLISHED", "PROCESSING"] } },
			data: {
				status: "PENDING",
				availableAt,
				publishedAt: null,
				lockedAt: null,
			},
		});
	}

	async markOutboxFailed(input: {
		outboxId: string;
		attempts: number;
		error: string;
		nextAttemptAt: Date;
	}): Promise<void> {
		await this.client.retentionPushOutbox.updateMany({
			where: { id: input.outboxId, status: "PROCESSING" },
			data: {
				status: input.attempts >= 20 ? "FAILED" : "PENDING",
				availableAt: input.nextAttemptAt,
				lockedAt: null,
				lastError: input.error.slice(0, 500),
			},
		});
	}

	async claimDispatch(
		outboxId: string,
	): Promise<RetentionDispatchCandidate | null> {
		const outbox = await this.client.retentionPushOutbox.findUnique({
			where: { id: outboxId },
			select: { dispatchId: true },
		});
		if (!outbox) return null;
		const claimed = await this.client.pushDispatch.updateMany({
			where: { id: outbox.dispatchId, status: "PENDING" },
			data: { status: "PROCESSING", skipReason: null },
		});
		if (claimed.count !== 1) return null;
		const dispatch = await this.client.pushDispatch.findUnique({
			where: { id: outbox.dispatchId },
			select: {
				id: true,
				notificationId: true,
				userId: true,
				timezone: true,
				campaignKey: true,
				variantId: true,
				notification: {
					select: { title: true, body: true, actionUrl: true },
				},
				user: {
					select: {
						preference: {
							select: { pushEnabled: true, nightPushEnabled: true },
						},
						consent: { select: { marketingPushAgreedAt: true } },
						pushTokens: {
							where: { isActive: true },
							select: { id: true, token: true },
						},
					},
				},
			},
		});
		if (!dispatch) return null;
		return {
			outboxId,
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
			marketingPushAgreedAt:
				dispatch.user.consent?.marketingPushAgreedAt ?? null,
			tokens: dispatch.user.pushTokens,
		};
	}

	async releaseDispatch(dispatchId: number, reason: string): Promise<void> {
		await this.client.pushDispatch.updateMany({
			where: { id: dispatchId, status: "PROCESSING" },
			data: { status: "PENDING", skipReason: reason.slice(0, 100) },
		});
	}

	async markDispatchSkipped(dispatchId: number, reason: string): Promise<void> {
		await this.client.pushDispatch.updateMany({
			where: { id: dispatchId, status: "PROCESSING" },
			data: { status: "SKIPPED", skipReason: reason.slice(0, 100) },
		});
	}

	async recordDeliveryResults(
		dispatchId: number,
		results: RetentionDeliveryResult[],
	): Promise<void> {
		const tokens = await this.client.pushToken.findMany({
			where: { token: { in: results.map((result) => result.token) } },
			select: { id: true, token: true },
		});
		const ids = new Map(tokens.map((token) => [token.token, token.id]));
		const attempts = results.flatMap((result) => {
			const pushTokenId = ids.get(result.token);
			if (!pushTokenId) return [];
			return [
				{
					dispatchId,
					pushTokenId,
					status: result.success
						? ("TICKET_ACCEPTED" as const)
						: ("FAILED" as const),
					expoTicketId: result.ticketId,
					errorCode: result.errorCode,
					errorMessage: result.error?.slice(0, 500),
				},
			];
		});
		if (attempts.length > 0) {
			await this.client.pushDeliveryAttempt.createMany({
				data: attempts,
				skipDuplicates: true,
			});
		}
		const sent = results.some((result) => result.success);
		await this.client.pushDispatch.update({
			where: { id: dispatchId },
			data: {
				status: sent ? "SENT" : "FAILED",
				sentAt: sent ? new Date() : null,
			},
		});
		const invalidTokens = results
			.filter((result) => result.errorCode === "DeviceNotRegistered")
			.map((result) => result.token);
		if (invalidTokens.length > 0) {
			await this.client.pushToken.updateMany({
				where: { token: { in: invalidTokens } },
				data: { isActive: false },
			});
		}
	}
}
