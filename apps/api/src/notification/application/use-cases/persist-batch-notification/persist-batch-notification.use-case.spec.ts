import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { NotificationBuilder } from "@test/builders";
import { createNotificationRepositoryMock } from "@test/mocks/ports/notification.mock";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../ports/notification.repository.port";
import type { CreateNotificationData } from "../../ports/notification-data";
import { PersistBatchNotificationUseCase } from "./persist-batch-notification.use-case";

describe("PersistBatchNotificationUseCase", () => {
	let useCase: PersistBatchNotificationUseCase;
	let repository: Mocked<NotificationRepositoryPort>;

	beforeEach(async () => {
		NotificationBuilder.resetIdCounter();
		const { unit, unitRef } = await TestBed.solitary(
			PersistBatchNotificationUseCase,
		)
			.mock<NotificationRepositoryPort>(NOTIFICATION_REPOSITORY)
			.impl(() => createNotificationRepositoryMock())
			.compile();
		useCase = unit;
		repository = unitRef.get(NOTIFICATION_REPOSITORY);
	});

	it("DB 생성 결과를 커밋 후 사용할 dispatch 입력으로 반환한다", async () => {
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

		expect(repository.createManyNotificationsAndReturn).toHaveBeenCalledWith(
			dataList,
		);
		expect(result).toMatchObject({
			count: 2,
			sourceData: dataList,
			items: [
				{
					notificationId: 1,
					data: { userId: "u1", type: "SYSTEM_NOTICE", force: true },
				},
				{
					notificationId: 2,
					data: { userId: "u2", type: "FOLLOW_NEW", force: false },
				},
			],
		});
	});

	it("빈 입력은 DB를 호출하지 않는다", async () => {
		await expect(useCase.execute([])).resolves.toEqual({
			count: 0,
			items: [],
			sourceData: [],
		});
		expect(repository.createManyNotificationsAndReturn).not.toHaveBeenCalled();
	});
});
