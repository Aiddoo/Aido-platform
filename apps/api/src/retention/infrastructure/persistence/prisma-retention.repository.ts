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
		const batches = await Promise.all(
			RETENTION_STAGE_NAMES.map((stage) =>
				this.client.retentionExperimentStage.findMany({
					where: {
						status: "SCHEDULED",
						stage,
						assignment: {
							experimentKey: RETENTION_EXPERIMENT_KEY,
							startedAt: { not: null },
						},
					},
					take: limit,
					orderBy: { createdAt: "asc" },
					select: {
						id: true,
						stage: true,
						assignment: {
							select: {
								id: true,
								userId: true,
								variant: true,
								startedAt: true,
								user: {
									select: {
										lastActiveAt: true,
										preference: {
											select: {
												pushEnabled: true,
												nightPushEnabled: true,
												timezone: true,
												locale: true,
											},
										},
										consent: { select: { marketingPushAgreedAt: true } },
										pushTokens: {
											where: { isActive: true },
											select: { id: true },
										},
										todos: {
											select: {
												completed: true,
												createdAt: true,
												completedAt: true,
											},
										},
									},
								},
							},
						},
					},
				}),
			),
		);
		const rows = batches.flat();

		return rows.flatMap((row) => {
			const assignment = row.assignment;
			const startedAt = assignment.startedAt;
			if (!startedAt) return [];
			const user = assignment.user;
			const preference = user.preference;
			const timezone = preference?.timezone ?? "UTC";
			const startLocalDate = this.#localDate(startedAt, timezone);
			const windowEnd = new Date(startedAt.getTime() + 8 * 86_400_000);
			const todoActionWithinWindow = user.todos.some(
				(todo) =>
					(this.#localDate(todo.createdAt, timezone) > startLocalDate &&
						todo.createdAt < windowEnd) ||
					Boolean(
						todo.completedAt &&
							this.#localDate(todo.completedAt, timezone) > startLocalDate &&
							todo.completedAt < windowEnd,
					),
			);
			return {
				assignmentId: assignment.id,
				stageId: row.id,
				userId: assignment.userId,
				variant: assignment.variant,
				stage: row.stage,
				startedAt,
				timezone,
				locale: preference?.locale === "en" ? "en" : "ko",
				pushEnabled: preference?.pushEnabled ?? false,
				nightPushEnabled: preference?.nightPushEnabled ?? false,
				marketingPushAgreedAt: user.consent?.marketingPushAgreedAt ?? null,
				activeTokenCount: user.pushTokens.length,
				lastActiveAt: user.lastActiveAt,
				todoCount: user.todos.length,
				completedCount: user.todos.filter((todo) => todo.completed).length,
				incompleteCount: user.todos.filter((todo) => !todo.completed).length,
				todoActionWithinWindow,
			};
		});
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
			`${this.#localDate(new Date(), input.timezone)}T00:00:00.000Z`,
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
		const rows = await this.client.retentionPushOutbox.findMany({
			where: { status: "PENDING", availableAt: { lte: now } },
			take: limit,
			orderBy: { createdAt: "asc" },
			select: { id: true, attempts: true },
		});
		const claimed: ClaimedOutbox[] = [];
		for (const row of rows) {
			const result = await this.client.retentionPushOutbox.updateMany({
				where: { id: row.id, status: "PENDING" },
				data: {
					status: "PROCESSING",
					lockedAt: now,
					attempts: { increment: 1 },
				},
			});
			if (result.count === 1)
				claimed.push({ id: row.id, attempts: row.attempts + 1 });
		}
		return claimed;
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

	#localDate(date: Date, timezone: string): string {
		return new Intl.DateTimeFormat("en-CA", {
			timeZone: timezone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).format(date);
	}
}
