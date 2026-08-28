/**
 * SendNotificationUseCase 단위 테스트
 *
 * - 알림과 durable push dispatch를 하나의 UOW에서 준비
 * - push 발행과 캐시 무효화는 커밋 후에만 시작
 * - unique 위반(P2002)은 graceful skip, 그 외 오류는 재전파
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { NotificationBuilder } from "@test/builders";
import { createNotificationCacheMock } from "@test/mocks/ports/notification-cache.mock";
import { createNotificationRepositoryMock } from "@test/mocks/ports/notification.mock";
import { createUnitOfWorkMock } from "@test/mocks/ports/unit-of-work.mock";

import {
	AFTER_COMMIT_TASK_REGISTRY,
	type AfterCommitTask,
	type AfterCommitTaskRegistryPort,
	UNIT_OF_WORK,
	type UnitOfWorkPort,
} from "@/shared/application/ports";

import {
	NOTIFICATION_CACHE,
	type NotificationCachePort,
} from "../../ports/notification-cache.port";
import type { CreateNotificationData } from "../../ports/notification-data";
import {
	DuplicateNotificationError,
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../ports/notification.repository.port";
import {
	PUSH_DISPATCH_STAGING,
	type PushDispatchStagingRepositoryPort,
} from "../../ports/push-dispatch-staging.repository.port";
import { PushDeliveryAfterCommitPublisher } from "../../services/push-delivery-after-commit.publisher";
import { SendNotificationUseCase } from "./send-notification.use-case";

const data: CreateNotificationData = {
	userId: "user-1",
	type: "FOLLOW_NEW",
	title: "새 친구 요청",
	body: "누군가 친구가 되고 싶어해요",
	friendId: "friend-1",
};

function createPushDispatchStagingMock(): PushDispatchStagingRepositoryPort {
	return {
		stage: jest.fn(),
		stageMany: jest.fn(),
	};
}

describe("SendNotificationUseCase", () => {
	let useCase: SendNotificationUseCase;
	let repository: Mocked<NotificationRepositoryPort>;
	let staging: Mocked<PushDispatchStagingRepositoryPort>;
	let cache: Mocked<NotificationCachePort>;
	let unitOfWork: Mocked<UnitOfWorkPort>;
	let afterCommitPublisher: Mocked<PushDeliveryAfterCommitPublisher>;
	let afterCommitTasks: AfterCommitTask[];

	beforeEach(async () => {
		NotificationBuilder.resetIdCounter();
		afterCommitTasks = [];
		const afterCommit: AfterCommitTaskRegistryPort = {
			register: jest.fn((task) => afterCommitTasks.push(task)),
		};

		const { unit, unitRef } = await TestBed.solitary(SendNotificationUseCase)
			.mock<NotificationRepositoryPort>(NOTIFICATION_REPOSITORY)
			.impl(() => createNotificationRepositoryMock())
			.mock<PushDispatchStagingRepositoryPort>(PUSH_DISPATCH_STAGING)
			.impl(() => createPushDispatchStagingMock())
			.mock<NotificationCachePort>(NOTIFICATION_CACHE)
			.impl(() => createNotificationCacheMock())
			.mock<UnitOfWorkPort>(UNIT_OF_WORK)
			.impl(() => createUnitOfWorkMock())
			.mock<AfterCommitTaskRegistryPort>(AFTER_COMMIT_TASK_REGISTRY)
			.impl(() => afterCommit)
			.compile();
		useCase = unit;
		repository = unitRef.get<NotificationRepositoryPort>(NOTIFICATION_REPOSITORY);
		staging = unitRef.get<PushDispatchStagingRepositoryPort>(PUSH_DISPATCH_STAGING);
		cache = unitRef.get<NotificationCachePort>(NOTIFICATION_CACHE);
		unitOfWork = unitRef.get<UnitOfWorkPort>(UNIT_OF_WORK);
		afterCommitPublisher = unitRef.get(PushDeliveryAfterCommitPublisher);
		staging.stage.mockResolvedValue({ dispatchId: 41, notificationId: 1 });
		cache.invalidateUnreadCount.mockResolvedValue(undefined);
	});

	it("unique 제약 위반이면 null을 반환하고 dispatch와 부수효과를 준비하지 않는다", async () => {
		repository.createNotification.mockRejectedValue(new DuplicateNotificationError());

		const result = await useCase.execute(data);

		expect(result).toBeNull();
		expect(staging.stage).not.toHaveBeenCalled();
		expect(afterCommitPublisher.register).not.toHaveBeenCalled();
		expect(afterCommitTasks).toHaveLength(0);
	});

	it("unique 위반이 아닌 오류는 재전파하고 dispatch를 준비하지 않는다", async () => {
		repository.createNotification.mockRejectedValue(new Error("db down"));

		await expect(useCase.execute(data)).rejects.toThrow("db down");
		expect(staging.stage).not.toHaveBeenCalled();
		expect(afterCommitPublisher.register).not.toHaveBeenCalled();
	});

	it("알림과 SINGLE dispatch를 같은 UOW에서 준비하고 캐시는 커밋 후 무효화한다", async () => {
		const notification = NotificationBuilder.create(data.userId).withId(1).build();
		repository.createNotification.mockResolvedValue(notification);

		const result = await useCase.execute(data);

		expect(result).toBe(notification);
		expect(unitOfWork.run).toHaveBeenCalledTimes(1);
		expect(staging.stage).toHaveBeenCalledWith({
			notificationId: 1,
			userId: data.userId,
			purpose: "TRANSACTIONAL",
			campaignKey: undefined,
			variantId: undefined,
			deliveryMode: "SINGLE",
			force: false,
		});
		expect(afterCommitPublisher.register).toHaveBeenCalledWith([41]);
		expect(cache.invalidateUnreadCount).not.toHaveBeenCalled();
		expect(afterCommitTasks).toHaveLength(1);

		await Promise.all(afterCommitTasks.map((task) => task()));

		expect(cache.invalidateUnreadCount).toHaveBeenCalledWith(data.userId);
	});

	it("캐시 backend가 응답하지 않아도 after-commit task를 붙잡지 않는다", async () => {
		const notification = NotificationBuilder.create(data.userId).withId(1).build();
		repository.createNotification.mockResolvedValue(notification);
		cache.invalidateUnreadCount.mockReturnValue(new Promise(() => undefined));
		await useCase.execute(data);

		const cacheTask = afterCommitTasks[0];
		expect(cacheTask).toBeDefined();
		if (!cacheTask) throw new Error("Expected unread cache after-commit task");
		await expect(cacheTask()).resolves.toBeUndefined();
		expect(cache.invalidateUnreadCount).toHaveBeenCalledWith(data.userId);
	});
});
