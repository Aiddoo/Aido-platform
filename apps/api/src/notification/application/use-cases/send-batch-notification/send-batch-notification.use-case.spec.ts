/**
 * SendBatchNotificationUseCase 단위 테스트
 *
 * - 빈 입력: DB/발송/캐시/dedup 모두 미수행, count=0
 * - 정상 배치: DB 생성 결과 수만큼 count, 사용자별 미읽음 카운트 무효화
 * - 중복 사용자: 유니크 사용자당 1회만 무효화
 * - notificationDate 그룹: dedup addMembers(센티넬 포함) 기록, 날짜 없으면 제외
 * - force 재결합: (userId, type) 복합 키로 force 플래그를 발송 페이로드에 반영
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { NotificationBuilder } from "@test/builders";
import {
	createNotificationRepositoryMock,
	createPushDispatcherMock,
} from "@test/mocks/ports/notification.mock";
import { createNotificationCacheMock } from "@test/mocks/ports/notification-cache.mock";
import { DedupKeys } from "@/shared/infrastructure/dedup/constants/dedup-keys";
import {
	DEDUP_PROVIDER,
	type IDedupProvider,
} from "@/shared/infrastructure/dedup/interfaces/dedup.interface";
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
import { SendBatchNotificationUseCase } from "./send-batch-notification.use-case";

describe("SendBatchNotificationUseCase", () => {
	let useCase: SendBatchNotificationUseCase;
	let repository: Mocked<NotificationRepositoryPort>;
	let pushDispatcher: Mocked<PushDispatcherPort>;
	let cache: Mocked<NotificationCachePort>;
	let dedupProvider: Mocked<IDedupProvider>;

	beforeEach(async () => {
		NotificationBuilder.resetIdCounter();

		const { unit, unitRef } = await TestBed.solitary(
			SendBatchNotificationUseCase,
		)
			.mock<NotificationRepositoryPort>(NOTIFICATION_REPOSITORY)
			.impl(() => createNotificationRepositoryMock())
			.mock<PushDispatcherPort>(PUSH_DISPATCHER)
			.impl(() => createPushDispatcherMock())
			.mock<NotificationCachePort>(NOTIFICATION_CACHE)
			.impl(() => createNotificationCacheMock())
			.mock<IDedupProvider>(DEDUP_PROVIDER)
			.impl(() => ({
				filterMembers: jest.fn(),
				isMember: jest.fn(),
				addMembers: jest.fn(),
			}))
			.compile();
		useCase = unit;
		repository = unitRef.get<NotificationRepositoryPort>(
			NOTIFICATION_REPOSITORY,
		);
		pushDispatcher = unitRef.get<PushDispatcherPort>(PUSH_DISPATCHER);
		cache = unitRef.get<NotificationCachePort>(NOTIFICATION_CACHE);
		dedupProvider = unitRef.get<IDedupProvider>(DEDUP_PROVIDER);
	});

	it("빈 입력이면 아무 것도 수행하지 않고 count 0을 반환한다", async () => {
		const result = await useCase.execute([]);

		expect(result).toEqual({ count: 0 });
		expect(repository.createManyNotificationsAndReturn).not.toHaveBeenCalled();
		expect(pushDispatcher.fireAndForgetBatchPush).not.toHaveBeenCalled();
		expect(cache.invalidateUnreadCount).not.toHaveBeenCalled();
		expect(dedupProvider.addMembers).not.toHaveBeenCalled();
	});

	it("정상 배치는 DB 생성 결과 수를 count로 반환하고 배치 푸시를 발송한다", async () => {
		const dataList: CreateNotificationData[] = [
			{ userId: "u1", type: "FOLLOW_NEW", title: "t1", body: "b1" },
			{ userId: "u2", type: "FOLLOW_NEW", title: "t2", body: "b2" },
		];
		const created = [
			NotificationBuilder.create("u1").withId(1).build(),
			NotificationBuilder.create("u2").withId(2).build(),
		];
		repository.createManyNotificationsAndReturn.mockResolvedValue(created);

		const result = await useCase.execute(dataList);

		expect(result).toEqual({ count: 2 });
		expect(repository.createManyNotificationsAndReturn).toHaveBeenCalledWith(
			dataList,
		);
		expect(pushDispatcher.fireAndForgetBatchPush).toHaveBeenCalledTimes(1);
	});

	it("같은 사용자가 여러 번 있어도 유니크 사용자당 1회만 미읽음 카운트를 무효화한다", async () => {
		const dataList: CreateNotificationData[] = [
			{ userId: "u1", type: "FOLLOW_NEW", title: "t", body: "b" },
			{ userId: "u1", type: "NUDGE_RECEIVED", title: "t", body: "b" },
			{ userId: "u2", type: "FOLLOW_NEW", title: "t", body: "b" },
		];
		repository.createManyNotificationsAndReturn.mockResolvedValue([
			NotificationBuilder.create("u1").withId(1).build(),
			NotificationBuilder.create("u1").withId(2).build(),
			NotificationBuilder.create("u2").withId(3).build(),
		]);

		await useCase.execute(dataList);

		expect(cache.invalidateUnreadCount).toHaveBeenCalledTimes(2);
		expect(cache.invalidateUnreadCount).toHaveBeenCalledWith("u1");
		expect(cache.invalidateUnreadCount).toHaveBeenCalledWith("u2");
	});

	it("notificationDate가 있는 항목은 타입·날짜 그룹으로 dedup에 센티넬과 함께 기록한다", async () => {
		const date = new Date("2026-03-09T00:00:00.000Z");
		const dataList: CreateNotificationData[] = [
			{
				userId: "u1",
				type: "FRIEND_COMPLETED",
				title: "t",
				body: "b",
				notificationDate: date,
			},
			{
				userId: "u2",
				type: "FRIEND_COMPLETED",
				title: "t",
				body: "b",
				notificationDate: date,
			},
			{ userId: "u3", type: "FOLLOW_NEW", title: "t", body: "b" },
		];
		repository.createManyNotificationsAndReturn.mockResolvedValue([
			NotificationBuilder.create("u1").withId(1).build(),
			NotificationBuilder.create("u2").withId(2).build(),
			NotificationBuilder.create("u3").withId(3).build(),
		]);

		await useCase.execute(dataList);

		expect(dedupProvider.addMembers).toHaveBeenCalledTimes(1);
		expect(dedupProvider.addMembers).toHaveBeenCalledWith(
			DedupKeys.notified("FRIEND_COMPLETED", date),
			[DedupKeys.SENTINEL, "u1", "u2"],
			DedupKeys.TTL.NOTIFIED,
		);
	});

	it("force는 (userId, type) 복합 키로 재결합되어 해당 발송 페이로드에만 반영된다", async () => {
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

		await useCase.execute(dataList);

		expect(pushDispatcher.fireAndForgetBatchPush).toHaveBeenCalledWith([
			expect.objectContaining({
				notificationId: 1,
				data: expect.objectContaining({
					userId: "u1",
					type: "SYSTEM_NOTICE",
					force: true,
				}),
			}),
			expect.objectContaining({
				notificationId: 2,
				data: expect.objectContaining({
					userId: "u2",
					type: "FOLLOW_NEW",
					force: false,
				}),
			}),
		]);
	});
});
