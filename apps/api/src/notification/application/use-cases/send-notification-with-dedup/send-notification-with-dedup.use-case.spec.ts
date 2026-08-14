/**
 * SendNotificationWithDedupUseCase 단위 테스트
 *
 * - 전략 없는 타입(NUDGE_RECEIVED): 바로 SendNotification 위임 (락 미사용)
 * - 전략 있는 타입(FOLLOW_NEW): 락 경합 시 skip, 최근 중복 시 skip, 아니면 발송
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CreateNotificationData } from "../../ports/notification-data";
import {
	NOTIFICATION_DEDUP_LOCK,
	type NotificationDedupLockPort,
} from "../../ports/notification-dedup.port";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../ports/notification.repository.port";
import { SendNotificationUseCase } from "../send-notification/send-notification.use-case";
import { SendNotificationWithDedupUseCase } from "./send-notification-with-dedup.use-case";

const followData: CreateNotificationData = {
	userId: "user-1",
	type: "FOLLOW_NEW",
	title: "t",
	body: "b",
	friendId: "friend-1",
};

const nudgeData: CreateNotificationData = {
	userId: "user-1",
	type: "NUDGE_RECEIVED",
	title: "t",
	body: "b",
	nudgeId: 1,
};

describe("SendNotificationWithDedupUseCase", () => {
	let useCase: SendNotificationWithDedupUseCase;
	let sendNotification: Mocked<SendNotificationUseCase>;
	let repository: Mocked<NotificationRepositoryPort>;
	let dedupLock: Mocked<NotificationDedupLockPort>;
	const release = jest.fn().mockResolvedValue(undefined);

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(SendNotificationWithDedupUseCase).compile();
		useCase = unit;
		sendNotification = unitRef.get(SendNotificationUseCase);
		repository = unitRef.get(NOTIFICATION_REPOSITORY);
		dedupLock = unitRef.get(NOTIFICATION_DEDUP_LOCK);
		dedupLock.acquire.mockResolvedValue(release);
		sendNotification.execute.mockResolvedValue(null);
	});

	it("전략 없는 타입이면 락 없이 바로 발송한다", async () => {
		await useCase.execute(nudgeData);

		expect(dedupLock.acquire).not.toHaveBeenCalled();
		expect(sendNotification.execute).toHaveBeenCalledWith(nudgeData);
	});

	it("락 경합(acquire=null) 시 null 반환하고 발송하지 않는다", async () => {
		dedupLock.acquire.mockResolvedValue(null);

		const result = await useCase.execute(followData);

		expect(result).toBeNull();
		expect(sendNotification.execute).not.toHaveBeenCalled();
	});

	it("최근 동일 알림 존재 시 skip(null) + 락 해제", async () => {
		repository.existsRecentNotification.mockResolvedValue(true);

		const result = await useCase.execute(followData);

		expect(result).toBeNull();
		expect(sendNotification.execute).not.toHaveBeenCalled();
		expect(release).toHaveBeenCalledTimes(1);
	});

	it("최근 중복 없으면 발송 + 락 해제", async () => {
		repository.existsRecentNotification.mockResolvedValue(false);

		await useCase.execute(followData);

		expect(sendNotification.execute).toHaveBeenCalledWith(followData);
		expect(release).toHaveBeenCalledTimes(1);
	});
});
