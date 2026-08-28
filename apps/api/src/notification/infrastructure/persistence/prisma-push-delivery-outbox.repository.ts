import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { Injectable } from "@nestjs/common";

import { Prisma } from "@/generated/prisma/client";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import type {
	ClaimPushDeliveryOutboxInput,
	DeferPushDeliveryPublicationsInput,
	PushDeliveryOutboxRepositoryPort,
} from "../../application/ports/push-delivery-outbox.repository.port";
import type { PushDeliveryPublication } from "../../application/types/push-delivery.types";

@Injectable()
export class PrismaPushDeliveryOutboxRepository implements PushDeliveryOutboxRepositoryPort {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>,
	) {}

	private get client() {
		return this.txHost.tx;
	}

	claimByDispatchIds(
		dispatchIds: readonly number[],
		lockedAt: Date,
	): Promise<readonly PushDeliveryPublication[]> {
		if (dispatchIds.length === 0) return Promise.resolve([]);
		return this.#claim({
			limit: dispatchIds.length,
			lockedAt,
			dispatchFilter: Prisma.sql`AND candidate."dispatchId" IN (${Prisma.join(dispatchIds)})`,
		});
	}

	claimAvailable(input: ClaimPushDeliveryOutboxInput): Promise<readonly PushDeliveryPublication[]> {
		if (input.limit <= 0) return Promise.resolve([]);
		return this.#claim({
			limit: input.limit,
			lockedAt: input.lockedAt,
			dispatchFilter: Prisma.empty,
		});
	}

	async markPublished(
		publications: readonly PushDeliveryPublication[],
		publishedAt: Date,
	): Promise<number> {
		if (publications.length === 0) return 0;
		await this.#lockOutboxGenerations(publications);
		const values = publications.map(
			(publication) =>
				Prisma.sql`(${publication.dispatchId}::INTEGER, ${publication.publishAttempt}::INTEGER)`,
		);
		return this.client.$executeRaw(Prisma.sql`
			UPDATE "PushDispatchOutbox" AS outbox
			SET
				"status" = 'PUBLISHED'::"PushDispatchOutboxStatus",
				"lockedAt" = NULL,
				"publishedAt" = ${publishedAt},
				"lastError" = NULL,
				"updatedAt" = CURRENT_TIMESTAMP
			FROM (VALUES ${Prisma.join(values)}) AS claimed("dispatchId", "publishAttempt")
			WHERE outbox."dispatchId" = claimed."dispatchId"
				AND outbox."status" = 'PROCESSING'::"PushDispatchOutboxStatus"
				AND outbox."publishAttempts" = claimed."publishAttempt"
		`);
	}

	async defer(input: DeferPushDeliveryPublicationsInput): Promise<number> {
		if (input.publications.length === 0) return 0;
		await this.#lockOutboxGenerations(input.publications);
		const values = input.publications.map(
			(publication) =>
				Prisma.sql`(${publication.dispatchId}::INTEGER, ${publication.publishAttempt}::INTEGER)`,
		);
		return this.client.$executeRaw(Prisma.sql`
			UPDATE "PushDispatchOutbox" AS outbox
			SET
				"status" = 'PENDING'::"PushDispatchOutboxStatus",
				"availableAt" = ${input.availableAt},
				"lockedAt" = NULL,
				"publishedAt" = NULL,
				"lastError" = ${input.error.slice(0, 500)},
				"updatedAt" = CURRENT_TIMESTAMP
			FROM (VALUES ${Prisma.join(values)}) AS claimed("dispatchId", "publishAttempt")
			WHERE outbox."dispatchId" = claimed."dispatchId"
				AND outbox."status" = 'PROCESSING'::"PushDispatchOutboxStatus"
				AND outbox."publishAttempts" = claimed."publishAttempt"
		`);
	}

	async recoverStaleProcessing(lockedBefore: Date): Promise<number> {
		return this.client.$executeRaw(Prisma.sql`
			WITH locked_outboxes AS MATERIALIZED (
				SELECT
					outbox."dispatchId",
					dispatch."status" AS "dispatchStatus"
				FROM "PushDispatchOutbox" AS outbox
				INNER JOIN "PushDispatch" AS dispatch
					ON dispatch."id" = outbox."dispatchId"
				WHERE outbox."status" = 'PROCESSING'::"PushDispatchOutboxStatus"
					AND outbox."lockedAt" < ${lockedBefore}
					AND dispatch."status" <> 'PROCESSING'::"PushDispatchStatus"
					ORDER BY outbox."availableAt" ASC, outbox."dispatchId" ASC
				FOR UPDATE OF outbox SKIP LOCKED
			)
			UPDATE "PushDispatchOutbox" AS outbox
			SET
				"status" = CASE
					WHEN locked_outboxes."dispatchStatus" IN (
						'SENT'::"PushDispatchStatus",
						'SKIPPED'::"PushDispatchStatus",
						'FAILED'::"PushDispatchStatus",
						'HOLDOUT'::"PushDispatchStatus"
					) THEN 'PUBLISHED'::"PushDispatchOutboxStatus"
					ELSE 'PENDING'::"PushDispatchOutboxStatus"
				END,
				"lockedAt" = NULL,
				"publishedAt" = CASE
					WHEN locked_outboxes."dispatchStatus" IN (
						'SENT'::"PushDispatchStatus",
						'SKIPPED'::"PushDispatchStatus",
						'FAILED'::"PushDispatchStatus",
						'HOLDOUT'::"PushDispatchStatus"
					) THEN COALESCE(outbox."publishedAt", CURRENT_TIMESTAMP)
					ELSE NULL
				END,
				"updatedAt" = CURRENT_TIMESTAMP
			FROM locked_outboxes
			WHERE outbox."dispatchId" = locked_outboxes."dispatchId"
				AND outbox."status" = 'PROCESSING'::"PushDispatchOutboxStatus"
		`);
	}

	#claim(input: {
		readonly limit: number;
		readonly lockedAt: Date;
		readonly dispatchFilter: Prisma.Sql;
	}): Promise<readonly PushDeliveryPublication[]> {
		return this.client.$queryRaw<PushDeliveryPublication[]>(Prisma.sql`
			UPDATE "PushDispatchOutbox" AS outbox
			SET
				"status" = 'PROCESSING'::"PushDispatchOutboxStatus",
				"lockedAt" = ${input.lockedAt},
				"publishedAt" = NULL,
				"publishAttempts" = outbox."publishAttempts" + 1,
				"lastError" = NULL,
				"updatedAt" = CURRENT_TIMESTAMP
			WHERE outbox."dispatchId" IN (
				SELECT candidate."dispatchId"
				FROM "PushDispatchOutbox" AS candidate
				WHERE candidate."status" = 'PENDING'::"PushDispatchOutboxStatus"
					AND candidate."availableAt" <= CURRENT_TIMESTAMP
					${input.dispatchFilter}
				ORDER BY candidate."availableAt" ASC, candidate."dispatchId" ASC
				LIMIT ${input.limit}
				FOR UPDATE SKIP LOCKED
			)
			RETURNING outbox."dispatchId", outbox."publishAttempts" AS "publishAttempt"
		`);
	}

	async #lockOutboxGenerations(publications: readonly PushDeliveryPublication[]): Promise<void> {
		const values = publications.map(
			(publication) =>
				Prisma.sql`(${publication.dispatchId}::INTEGER, ${publication.publishAttempt}::INTEGER)`,
		);
		await this.client.$queryRaw(Prisma.sql`
			SELECT outbox."dispatchId"
			FROM (VALUES ${Prisma.join(values)}) AS requested("dispatchId", "publishAttempt")
			INNER JOIN "PushDispatchOutbox" AS outbox
				ON outbox."dispatchId" = requested."dispatchId"
				AND outbox."publishAttempts" = requested."publishAttempt"
				AND outbox."status" = 'PROCESSING'::"PushDispatchOutboxStatus"
			ORDER BY outbox."availableAt" ASC, outbox."dispatchId" ASC
			FOR UPDATE OF outbox
		`);
	}
}
