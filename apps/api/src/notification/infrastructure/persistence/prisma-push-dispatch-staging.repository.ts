import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import sql, { join } from "sql-template-tag";

import {
	decodeSqlRows,
	sqlRowSpec,
	sqlStatement,
} from "#api/shared/infrastructure/database/database-sql";
import type { Prisma8TransactionalAdapter } from "#api/shared/infrastructure/database/prisma8-transactional.adapter";

import type {
	PushDispatchStagingRepositoryPort,
	StagePushDispatchInput,
	StagedPushDispatch,
} from "../../application/ports/push-dispatch-staging.repository.port.js";

@Injectable()
export class PrismaPushDispatchStagingRepository implements PushDispatchStagingRepositoryPort {
	constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

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
		const sqlRows1 = sqlRowSpec({ dispatchId: "pg/int4@1", notificationId: "pg/int4@1" });

		if (inputs.length === 0) return [];

		const dispatchValues = inputs.map(
			(input) => sql`(
				${input.notificationId},
				${input.userId},
				${input.purpose}::"NotificationPurpose",
				${input.campaignKey ?? null},
				${input.variantId ?? null},
				'PENDING'::"PushDispatchStatus",
				CURRENT_TIMESTAMP
			)`,
		);
		const staged = decodeSqlRows(
			sqlRows1,
			await this.client.query(
				sqlStatement(
					this.client,
					sql`
			INSERT INTO "PushDispatch" (
				"notificationId",
				"userId",
				"purpose",
				"campaignKey",
				"variantId",
				"status",
				"updatedAt"
			)
			VALUES ${join(dispatchValues)}
			RETURNING "id" AS "dispatchId", "notificationId"
		`,
				)
					.returnsRow(sqlRows1)
					.build(),
			),
		);
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
			return sql`(
				${dispatch.dispatchId},
				${input.deliveryMode}::"PushDeliveryMode",
				${input.force},
				CURRENT_TIMESTAMP
			)`;
		});
		await this.client
			.execute(
				sqlStatement(
					this.client,
					sql`
			INSERT INTO "PushDispatchOutbox" (
				"dispatchId",
				"deliveryMode",
				"force",
				"updatedAt"
			)
			VALUES ${join(outboxValues)}
		`,
				)
					.affectedCount()
					.build(),
			)
			.then((result) => result.affectedRows);

		return staged;
	}
}
