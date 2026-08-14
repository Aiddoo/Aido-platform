import { Injectable } from "@nestjs/common";

import type { CreateNotificationData } from "../../ports/notification-data";
import { DispatchBatchNotificationUseCase } from "../dispatch-batch-notification/dispatch-batch-notification.use-case";
import { PersistBatchNotificationUseCase } from "../persist-batch-notification/persist-batch-notification.use-case";

/**
 * 여러 사용자에게 알림 생성 및 발송 유스케이스.
 *
 * DB 성공 후 Redis에 기록 (순서 보장):
 * DB 실패 시 addMembers에 도달하지 않으므로 불일치 방지
 */
@Injectable()
export class SendBatchNotificationUseCase {
	constructor(
		private readonly persistBatch: PersistBatchNotificationUseCase,
		private readonly dispatchBatch: DispatchBatchNotificationUseCase,
	) {}

	async execute(dataList: CreateNotificationData[]): Promise<{ count: number }> {
		const persisted = await this.persistBatch.execute(dataList);
		return this.dispatchBatch.execute(persisted);
	}
}
