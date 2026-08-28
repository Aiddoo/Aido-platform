/**
 * SendNotificationUseCase 단위 테스트
 *
 * - unique 위반(P2002): graceful skip → null 반환, 이후 단계 미수행
 * - 그 외 에러: 재전파
 * - 생성 성공: 푸시 전달 예약(fire-and-forget) + 미읽음 카운트 무효화
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { NotificationBuilder } from "@test/builders";
import { createNotificationCacheMock } from "@test/mocks/ports/notification-cache.mock";
import {
	createNotificationRepositoryMock,
	createPushDispatcherMock,
} from "@test/mocks/ports/notification.mock";

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
import { PUSH_DISPATCHER, type PushDispatcherPort } from "../../ports/push-dispatcher.port";
import { SendNotificationUseCase } from "./send-notification.use-case";

const data: CreateNotificationData = {
	userId: "user-1",
	type: "FOLLOW_NEW",
	title: "새 친구 요청",
	body: "누군가 친구가 되고 싶어해요",
	friendId: "friend-1",
};

describe("SendNotificationUseCase", () => {
	let useCase: SendNotificationUseCase;
	let repository: Mocked<NotificationRepositoryPort>;
	let pushDispatcher: Mocked<PushDispatcherPort>;
	let cache: Mocked<NotificationCachePort>;

	beforeEach(async () => {
		NotificationBuilder.resetIdCounter();

		const { unit, unitRef } = await TestBed.solitary(SendNotificationUseCase)
			.mock<NotificationRepositoryPort>(NOTIFICATION_REPOSITORY)
			.impl(() => createNotificationRepositoryMock())
			.mock<PushDispatcherPort>(PUSH_DISPATCHER)
			.impl(() => createPushDispatcherMock())
			.mock<NotificationCachePort>(NOTIFICATION_CACHE)
			.impl(() => createNotificationCacheMock())
			.compile();
		useCase = unit;
		repository = unitRef.get<NotificationRepositoryPort>(NOTIFICATION_REPOSITORY);
		pushDispatcher = unitRef.get<PushDispatcherPort>(PUSH_DISPATCHER);
		cache = unitRef.get<NotificationCachePort>(NOTIFICATION_CACHE);
		cache.invalidateUnreadCount.mockResolvedValue(undefined);
	});

	it("unique 제약 위반(P2002)이면 graceful skip으로 null을 반환하고 발송 단계를 건너뛴다", async () => {
		repository.createNotification.mockRejectedValue(new DuplicateNotificationError());

		const result = await useCase.execute(data);

		expect(result).toBeNull();
		expect(pushDispatcher.fireAndForgetPush).not.toHaveBeenCalled();
	});

	it("unique 위반이 아닌 에러는 재전파한다", async () => {
		repository.createNotification.mockRejectedValue(new Error("db down"));

		await expect(useCase.execute(data)).rejects.toThrow("db down");
		expect(pushDispatcher.fireAndForgetPush).not.toHaveBeenCalled();
	});

	it("자격 판단은 디스패처에 위임하고 생성 직후 디스패치를 예약한다", async () => {
		const notification = NotificationBuilder.create(data.userId).withId(1).build();
		repository.createNotification.mockResolvedValue(notification);
		const result = await useCase.execute(data);

		expect(result).toBe(notification);
		expect(pushDispatcher.fireAndForgetPush).toHaveBeenCalledWith(data, 1);
		expect(cache.invalidateUnreadCount).toHaveBeenCalledWith(data.userId);
	});
});
