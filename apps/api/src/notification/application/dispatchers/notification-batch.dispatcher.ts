import type { CreateNotificationData } from "../ports/notification-data";
import type { PersistedBatchNotificationDispatch } from "../ports/push-dispatcher.port";
import type { DispatchBatchNotificationUseCase } from "../use-cases/dispatch-batch-notification/dispatch-batch-notification.use-case";
import type { PersistBatchNotificationUseCase } from "../use-cases/persist-batch-notification/persist-batch-notification.use-case";

/** 트랜잭션 내부 영속화와 커밋 후 dispatch를 명시적으로 분리하는 내부 capability. */
export class NotificationBatchDispatcher {
	constructor(
		private readonly persistBatchNotificationUseCase: PersistBatchNotificationUseCase,
		private readonly dispatchBatchNotificationUseCase: DispatchBatchNotificationUseCase,
	) {}

	persistBatch(
		dataList: CreateNotificationData[],
	): Promise<PersistedBatchNotificationDispatch> {
		return this.persistBatchNotificationUseCase.execute(dataList);
	}

	dispatchPersistedBatch(input: PersistedBatchNotificationDispatch): {
		count: number;
	} {
		return this.dispatchBatchNotificationUseCase.execute(input);
	}
}
