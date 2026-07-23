/**
 * SendNotificationUseCase 단위 테스트
 *
 * - unique 위반(P2002): graceful skip → null 반환, 이후 단계 미수행
 * - 그 외 에러: 재전파
 * - shouldSendPush 게이트: false면 발송/무효화 없이 알림 반환
 * - shouldSendPush=true: 푸시 발송(fire-and-forget) + 미읽음 카운트 무효화
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { NotificationBuilder } from "@test/builders";
import {
	createNotificationRepositoryMock,
	createPushDispatcherMock,
} from "@test/mocks/ports/notification.mock";
import { createNotificationCacheMock } from "@test/mocks/ports/notification-cache.mock";
import { Prisma } from "@/generated/prisma/client";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../ports/notification.repository.port";
import {
	NOTIFICATION_CACHE,
	type NotificationCachePort,
} from "../../ports/notification-cache.port";
import type { CreateNotificationData } from "../../ports/notification-data";
import {
	PUSH_DISPATCHER,
	type PushDispatcherPort,
} from "../../ports/push-dispatcher.port";
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
		repository = unitRef.get<NotificationRepositoryPort>(
			NOTIFICATION_REPOSITORY,
		);
		pushDispatcher = unitRef.get<PushDispatcherPort>(PUSH_DISPATCHER);
		cache = unitRef.get<NotificationCachePort>(NOTIFICATION_CACHE);
	});

	it("unique 제약 위반(P2002)이면 graceful skip으로 null을 반환하고 발송 단계를 건너뛴다", async () => {
		repository.createNotification.mockRejectedValue(
			new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
				code: "P2002",
				clientVersion: "7.0.0",
			}),
		);

		const result = await useCase.execute(data);

		expect(result).toBeNull();
		expect(pushDispatcher.shouldSendPush).not.toHaveBeenCalled();
		expect(pushDispatcher.fireAndForgetPush).not.toHaveBeenCalled();
	});

	it("unique 위반이 아닌 에러는 재전파한다", async () => {
		repository.createNotification.mockRejectedValue(new Error("db down"));

		await expect(useCase.execute(data)).rejects.toThrow("db down");
		expect(pushDispatcher.shouldSendPush).not.toHaveBeenCalled();
	});

	it("shouldSendPush가 false면 발송·무효화 없이 생성된 알림을 반환한다", async () => {
		const notification = NotificationBuilder.create(data.userId)
			.withId(1)
			.build();
		repository.createNotification.mockResolvedValue(notification);
		pushDispatcher.shouldSendPush.mockResolvedValue(false);

		const result = await useCase.execute(data);

		expect(result).toBe(notification);
		expect(pushDispatcher.shouldSendPush).toHaveBeenCalledWith(
			data.userId,
			data.type,
			data.purpose,
		);
		expect(pushDispatcher.fireAndForgetPush).not.toHaveBeenCalled();
		expect(cache.invalidateUnreadCount).not.toHaveBeenCalled();
	});

	it("shouldSendPush가 true면 푸시를 발송하고 미읽음 카운트를 무효화한다", async () => {
		const notification = NotificationBuilder.create(data.userId)
			.withId(7)
			.build();
		repository.createNotification.mockResolvedValue(notification);
		pushDispatcher.shouldSendPush.mockResolvedValue(true);

		const result = await useCase.execute(data);

		expect(result).toBe(notification);
		expect(pushDispatcher.fireAndForgetPush).toHaveBeenCalledWith(data, 7);
		expect(cache.invalidateUnreadCount).toHaveBeenCalledWith(data.userId);
	});
});
