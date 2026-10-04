import { Inject, Injectable } from "@nestjs/common";

import {
	AFTER_COMMIT_TASK_REGISTRY,
	type AfterCommitTaskRegistryPort,
	UNIT_OF_WORK,
	type UnitOfWorkPort,
} from "#api/shared/application/ports/index";

import type { CreateNotificationData } from "../../ports/notification-data.js";
import { FinalizeBatchNotificationUseCase } from "../finalize-batch-notification/finalize-batch-notification.use-case.js";
import { PersistBatchNotificationUseCase } from "../persist-batch-notification/persist-batch-notification.use-case.js";

@Injectable()
export class SendBatchNotificationUseCase {
	constructor(
		private readonly persistBatchNotificationUseCase: PersistBatchNotificationUseCase,
		private readonly finalizeBatchNotificationUseCase: FinalizeBatchNotificationUseCase,
		@Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWorkPort,
		@Inject(AFTER_COMMIT_TASK_REGISTRY)
		private readonly afterCommitTasks: AfterCommitTaskRegistryPort,
	) {}

	async execute(dataList: CreateNotificationData[]): Promise<{ count: number }> {
		return this.unitOfWork.run(async () => {
			const persisted = await this.persistBatchNotificationUseCase.execute(dataList);
			if (persisted.count > 0) {
				this.afterCommitTasks.register(async () => {
					await this.finalizeBatchNotificationUseCase.execute(persisted);
				});
			}
			return { count: persisted.count };
		});
	}
}
