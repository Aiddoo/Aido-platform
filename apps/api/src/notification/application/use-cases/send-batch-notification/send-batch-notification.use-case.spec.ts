import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CreateNotificationData } from "../../ports/notification-data";
import { FinalizeBatchNotificationUseCase } from "../finalize-batch-notification/finalize-batch-notification.use-case";
import { PersistBatchNotificationUseCase } from "../persist-batch-notification/persist-batch-notification.use-case";
import { SendBatchNotificationUseCase } from "./send-batch-notification.use-case";

describe("SendBatchNotificationUseCase", () => {
	let useCase: SendBatchNotificationUseCase;
	let persistBatch: Mocked<PersistBatchNotificationUseCase>;
	let finalizeBatch: Mocked<FinalizeBatchNotificationUseCase>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(SendBatchNotificationUseCase).compile();
		useCase = unit;
		persistBatch = unitRef.get(PersistBatchNotificationUseCase);
		finalizeBatch = unitRef.get(FinalizeBatchNotificationUseCase);
	});

	it("기존 facade 호출을 원자 persistence와 post-commit 정리 조합으로 유지한다", async () => {
		const dataList: CreateNotificationData[] = [
			{ userId: "u1", type: "FOLLOW_NEW", title: "t", body: "b" },
		];
		const persisted = { count: 1, sourceData: dataList };
		persistBatch.execute.mockResolvedValue(persisted);
		finalizeBatch.execute.mockResolvedValue({ count: 1 });

		const result = await useCase.execute(dataList);

		expect(persistBatch.execute).toHaveBeenCalledWith(dataList);
		expect(finalizeBatch.execute).toHaveBeenCalledWith(persisted);
		expect(result).toEqual({ count: 1 });
	});
});
