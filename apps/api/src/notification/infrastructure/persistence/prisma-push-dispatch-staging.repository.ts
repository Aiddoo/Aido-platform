import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { Injectable } from "@nestjs/common";

import { Prisma } from "@/generated/prisma/client";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import type {
	PushDispatchStagingRepositoryPort,
	StagePushDispatchInput,
	StagedPushDispatch,
} from "../../application/ports/push-dispatch-staging.repository.port";

@Injectable()
export class PrismaPushDispatchStagingRepository implements PushDispatchStagingRepositoryPort {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>,
	) {}

	private get client() {
		return this.txHost.tx;
	}

	async stage(input: StagePushDispatchInput): Promise<StagedPushDispatch> {
		const [staged] = await this.stageMany([input]);
		if (!staged) {
			throw new Error(
				`Push dispatch staging returned no row: notificationId=${input.notificationId}`,
			);
		}
		return staged;
	}

	async stageMany(
		inputs: readonly StagePushDispatchInput[],
	): Promise<readonly StagedPushDispatch[]> {
		if (inputs.length === 0) return [];

		const dispatchValues = inputs.map(
			(input) => Prisma.sql`(
				${input.notificationId},
				${input.userId},
				${input.purpose}::"NotificationPurpose",
				${input.campaignKey ?? null},
				${input.variantId ?? null},
				'PENDING'::"PushDispatchStatus",
				CURRENT_TIMESTAMP
			)`,
		);
		const staged = await this.client.$queryRaw<StagedPushDispatch[]>(Prisma.sql`
			INSERT INTO "PushDispatch" (
				"notificationId",
				"userId",
				"purpose",
				"campaignKey",
				"variantId",
				"status",
				"updatedAt"
			)
			VALUES ${Prisma.join(dispatchValues)}
			RETURNING "id" AS "dispatchId", "notificationId"
		`);
		if (staged.length !== inputs.length) {
			throw new Error(
				`Push dispatch staging returned partial rows: expected=${inputs.length}, actual=${staged.length}`,
			);
		}

		const inputByNotificationId = new Map(inputs.map((input) => [input.notificationId, input]));
		const outboxValues = staged.map((dispatch) => {
			const input = inputByNotificationId.get(dispatch.notificationId);
			if (!input) {
				throw new Error(
					`Push dispatch staging input missing: notificationId=${dispatch.notificationId}`,
				);
			}
			return Prisma.sql`(
				${dispatch.dispatchId},
				${input.deliveryMode}::"PushDeliveryMode",
				${input.force},
				CURRENT_TIMESTAMP
			)`;
		});
		await this.client.$executeRaw(Prisma.sql`
			INSERT INTO "PushDispatchOutbox" (
				"dispatchId",
				"deliveryMode",
				"force",
				"updatedAt"
			)
			VALUES ${Prisma.join(outboxValues)}
		`);

		return staged;
	}
}
