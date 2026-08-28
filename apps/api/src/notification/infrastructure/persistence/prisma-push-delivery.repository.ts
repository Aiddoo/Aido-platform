import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { Injectable } from "@nestjs/common";

import { Prisma } from "@/generated/prisma/client";
import { now } from "@/shared/domain/date/utils/core";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import type {
	CreatePushDispatchInput,
	PushDeliveryResultsInput,
	PushDispatchFailureReason,
	PushDispatchRecord,
	PushDispatchRepositoryPort,
	PushDispatchSkipReason,
	PushDispatchSkipUpdate,
} from "../../application/ports/push-dispatch.repository.port";
import type { PushReceiptResult, PushResult } from "../../application/ports/push-provider.port";
import type {
	PendingPushReceipt,
	PushReceiptRepositoryPort,
} from "../../application/ports/push-receipt.repository.port";

@Injectable()
export class PrismaPushDeliveryRepository
	implements PushDispatchRepositoryPort, PushReceiptRepositoryPort
{
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>,
	) {}

	private get client() {
		return this.txHost.tx;
	}

	async createPushDispatch(input: CreatePushDispatchInput): Promise<{ id: number }> {
		return this.client.pushDispatch.upsert({
			where: { notificationId: input.notificationId },
			create: { ...input, status: "PROCESSING" },
			update: { status: "PROCESSING", skipReason: null },
			select: { id: true },
		});
	}

	async createPushDispatches(inputs: CreatePushDispatchInput[]): Promise<PushDispatchRecord[]> {
		if (inputs.length === 0) return [];

		const values = inputs.map(
			(input) =>
				Prisma.sql`(
					${input.notificationId},
					${input.userId},
					${input.purpose}::"NotificationPurpose",
					${input.campaignKey ?? null},
					${input.variantId ?? null},
					${input.timezone},
					${input.localDate}::DATE,
					'PROCESSING'::"PushDispatchStatus",
					CURRENT_TIMESTAMP
				)`,
		);

		return this.client.$queryRaw<PushDispatchRecord[]>(Prisma.sql`
			INSERT INTO "PushDispatch" (
				"notificationId",
				"userId",
				"purpose",
				"campaignKey",
				"variantId",
				"timezone",
				"localDate",
				"status",
				"updatedAt"
			)
			VALUES ${Prisma.join(values)}
			ON CONFLICT ("notificationId")
			DO UPDATE SET
				"status" = 'PROCESSING'::"PushDispatchStatus",
				"skipReason" = NULL,
				"updatedAt" = CURRENT_TIMESTAMP
			RETURNING "id", "notificationId"
		`);
	}

	async markPushDispatchSkipped(dispatchId: number, reason: PushDispatchSkipReason): Promise<void> {
		await this.client.pushDispatch.update({
			where: { id: dispatchId },
			data: { status: "SKIPPED", skipReason: reason },
		});
	}

	async markPushDispatchesSkipped(updates: PushDispatchSkipUpdate[]): Promise<void> {
		const dispatchIdsByReason = new Map<PushDispatchSkipReason, number[]>();
		for (const update of updates) {
			const dispatchIds = dispatchIdsByReason.get(update.reason) ?? [];
			dispatchIds.push(update.dispatchId);
			dispatchIdsByReason.set(update.reason, dispatchIds);
		}

		await Promise.all(
			[...dispatchIdsByReason].map(([reason, dispatchIds]) =>
				this.client.pushDispatch.updateMany({
					where: { id: { in: dispatchIds } },
					data: { status: "SKIPPED", skipReason: reason },
				}),
			),
		);
	}

	async markPushDispatchFailed(
		dispatchIds: number[],
		reason: PushDispatchFailureReason,
	): Promise<void> {
		if (dispatchIds.length === 0) return;
		await this.client.pushDispatch.updateMany({
			where: { id: { in: dispatchIds }, status: "PROCESSING" },
			data: { status: "FAILED", skipReason: reason },
		});
	}

	async recordPushDeliveryResults(dispatchId: number, results: PushResult[]): Promise<void> {
		await this.recordPushDeliveryResultsBatch([{ dispatchId, results }]);
	}

	async recordPushDeliveryResultsBatch(inputs: PushDeliveryResultsInput[]): Promise<void> {
		if (inputs.length === 0) return;

		const results = inputs.flatMap((input) => input.results);
		const tokens =
			results.length > 0
				? await this.client.pushToken.findMany({
						where: { token: { in: results.map((result) => result.token) } },
						select: { id: true, token: true },
					})
				: [];
		const tokenIdByValue = new Map(tokens.map((token) => [token.token, token.id]));
		const attempts = inputs.flatMap((input) =>
			input.results.flatMap((result) => {
				const pushTokenId = tokenIdByValue.get(result.token);
				if (!pushTokenId) return [];
				return [
					{
						dispatchId: input.dispatchId,
						pushTokenId,
						status: result.success ? ("TICKET_ACCEPTED" as const) : ("FAILED" as const),
						expoTicketId: result.ticketId,
						errorCode: result.errorCode,
						errorMessage: result.error?.slice(0, 500),
					},
				];
			}),
		);
		if (attempts.length > 0) {
			await this.client.pushDeliveryAttempt.createMany({ data: attempts, skipDuplicates: true });
		}

		const sentDispatchIds = inputs.flatMap((input) =>
			input.results.some((result) => result.success) ? [input.dispatchId] : [],
		);
		const failedDispatchIds = inputs.flatMap((input) =>
			input.results.some((result) => result.success) ? [] : [input.dispatchId],
		);
		if (sentDispatchIds.length > 0) {
			await this.client.pushDispatch.updateMany({
				where: { id: { in: sentDispatchIds } },
				data: { status: "SENT", sentAt: now() },
			});
		}
		if (failedDispatchIds.length > 0) {
			await this.client.pushDispatch.updateMany({
				where: { id: { in: failedDispatchIds } },
				data: { status: "FAILED" },
			});
		}
	}

	async findPendingPushReceipts(limit: number): Promise<PendingPushReceipt[]> {
		const rows = await this.client.pushDeliveryAttempt.findMany({
			where: { status: "TICKET_ACCEPTED", expoTicketId: { not: null } },
			take: limit,
			orderBy: { createdAt: "asc" },
			select: { expoTicketId: true, pushToken: { select: { token: true } } },
		});
		return rows.flatMap((row) =>
			row.expoTicketId ? [{ ticketId: row.expoTicketId, token: row.pushToken.token }] : [],
		);
	}

	async recordPushReceipts(results: PushReceiptResult[]): Promise<string[]> {
		if (results.length === 0) return [];

		const receiptCheckedAt = now();
		const values = results.map(
			(result) =>
				Prisma.sql`(
					${result.ticketId}::VARCHAR(100),
					${result.delivered ? "DELIVERED" : "FAILED"}::"PushDeliveryStatus",
					${result.errorCode ?? null}::VARCHAR(100),
					${result.error?.slice(0, 500) ?? null}::VARCHAR(500)
				)`,
		);
		await this.client.$executeRaw(Prisma.sql`
			UPDATE "PushDeliveryAttempt" AS attempt
			SET
				"status" = receipt."status",
				"errorCode" = receipt."errorCode",
				"errorMessage" = receipt."errorMessage",
				"receiptCheckedAt" = ${receiptCheckedAt},
				"updatedAt" = ${receiptCheckedAt}
			FROM (
				VALUES ${Prisma.join(values)}
			) AS receipt("ticketId", "status", "errorCode", "errorMessage")
			WHERE attempt."expoTicketId" = receipt."ticketId"
		`);

		const invalidTicketIds = results.flatMap((result) =>
			result.errorCode === "DeviceNotRegistered" ? [result.ticketId] : [],
		);
		if (invalidTicketIds.length === 0) return [];
		const attempts = await this.client.pushDeliveryAttempt.findMany({
			where: { expoTicketId: { in: invalidTicketIds } },
			select: { pushToken: { select: { token: true } } },
		});
		return attempts.map((attempt) => attempt.pushToken.token);
	}
}
