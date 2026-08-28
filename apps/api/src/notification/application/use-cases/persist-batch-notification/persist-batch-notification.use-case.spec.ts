import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { NotificationBuilder } from "@test/builders";
import { createNotificationRepositoryMock } from "@test/mocks/ports/notification.mock";
import { createUnitOfWorkMock } from "@test/mocks/ports/unit-of-work.mock";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";

import type { CreateNotificationData } from "../../ports/notification-data";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../ports/notification.repository.port";
import {
	PUSH_DISPATCH_STAGING,
	type PushDispatchStagingRepositoryPort,
} from "../../ports/push-dispatch-staging.repository.port";
import { PushDeliveryAfterCommitPublisher } from "../../services/push-delivery-after-commit.publisher";
import { PersistBatchNotificationUseCase } from "./persist-batch-notification.use-case";

function createPushDispatchStagingMock(): PushDispatchStagingRepositoryPort {
	return {
		stage: jest.fn(),
		stageMany: jest.fn(),
	};
}

describe("PersistBatchNotificationUseCase", () => {
	let useCase: PersistBatchNotificationUseCase;
	let repository: Mocked<NotificationRepositoryPort>;
	let staging: Mocked<PushDispatchStagingRepositoryPort>;
	let unitOfWork: Mocked<UnitOfWorkPort>;
	let afterCommitPublisher: Mocked<PushDeliveryAfterCommitPublisher>;

	beforeEach(async () => {
		NotificationBuilder.resetIdCounter();
		const { unit, unitRef } = await TestBed.solitary(PersistBatchNotificationUseCase)
			.mock<NotificationRepositoryPort>(NOTIFICATION_REPOSITORY)
			.impl(() => createNotificationRepositoryMock())
			.mock<PushDispatchStagingRepositoryPort>(PUSH_DISPATCH_STAGING)
			.impl(() => createPushDispatchStagingMock())
			.mock<UnitOfWorkPort>(UNIT_OF_WORK)
			.impl(() => createUnitOfWorkMock())
			.compile();
		useCase = unit;
		repository = unitRef.get<NotificationRepositoryPort>(NOTIFICATION_REPOSITORY);
		staging = unitRef.get<PushDispatchStagingRepositoryPort>(PUSH_DISPATCH_STAGING);
		unitOfWork = unitRef.get<UnitOfWorkPort>(UNIT_OF_WORK);
		afterCommitPublisher = unitRef.get(PushDeliveryAfterCommitPublisher);
		staging.stageMany.mockResolvedValue([
			{ dispatchId: 101, notificationId: 1 },
			{ dispatchId: 102, notificationId: 2 },
		]);
	});

	it("알림과 BATCH dispatch를 같은 UOW에 저장하고 커밋 후 발행 ID를 등록한다", async () => {
		const dataList: CreateNotificationData[] = [
			{
				userId: "u1",
				type: "SYSTEM_NOTICE",
				title: "공지",
				body: "본문",
				force: true,
			},
			{ userId: "u2", type: "FOLLOW_NEW", title: "t", body: "b" },
		];
		repository.createManyNotificationsAndReturn.mockResolvedValue([
			NotificationBuilder.create("u1").withId(1).asSystemNotice().build(),
			NotificationBuilder.create("u2").withId(2).asFollowNew("f1").build(),
		]);

		const result = await useCase.execute(dataList);

		expect(unitOfWork.run).toHaveBeenCalledTimes(1);
		expect(repository.createManyNotificationsAndReturn).toHaveBeenCalledWith(dataList);
		expect(staging.stageMany).toHaveBeenCalledWith([
			expect.objectContaining({
				notificationId: 1,
				userId: "u1",
				deliveryMode: "BATCH",
				force: true,
			}),
			expect.objectContaining({
				notificationId: 2,
				userId: "u2",
				deliveryMode: "BATCH",
				force: false,
			}),
		]);
		expect(afterCommitPublisher.register).toHaveBeenCalledWith([101, 102]);
		expect(result).toEqual({ count: 2, sourceData: dataList });
	});

	it("빈 입력은 UOW, DB, staging, 발행 등록을 모두 건너뛴다", async () => {
		await expect(useCase.execute([])).resolves.toEqual({
			count: 0,
			sourceData: [],
		});
		expect(unitOfWork.run).not.toHaveBeenCalled();
		expect(repository.createManyNotificationsAndReturn).not.toHaveBeenCalled();
		expect(staging.stageMany).not.toHaveBeenCalled();
		expect(afterCommitPublisher.register).not.toHaveBeenCalled();
	});
});
