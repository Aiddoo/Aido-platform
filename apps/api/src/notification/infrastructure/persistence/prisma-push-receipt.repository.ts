import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { Injectable } from "@nestjs/common";

import { Prisma } from "@/generated/prisma/client";
import { now } from "@/shared/domain/date/utils/core";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import type { PushReceiptResult } from "../../application/ports/push-provider.port";
import type {
	PendingPushReceipt,
	PushReceiptRepositoryPort,
} from "../../application/ports/push-receipt.repository.port";

@Injectable()
export class PrismaPushReceiptRepository implements PushReceiptRepositoryPort {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>,
	) {}

	private get client() {
		return this.txHost.tx;
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
