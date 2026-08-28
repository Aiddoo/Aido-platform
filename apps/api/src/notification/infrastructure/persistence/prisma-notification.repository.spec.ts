import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { TestBed } from "@suites/unit";
import { NotificationBuilder } from "@test/builders";
import { asMock, createMockPrisma, type MockPrismaClient } from "@test/mocks";

import { Prisma } from "@/generated/prisma/client";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import type { CreateNotificationData } from "../../application/ports/notification-data";
import { DuplicateNotificationError } from "../../application/ports/notification.repository.port";
import { PrismaNotificationRepository } from "./prisma-notification.repository";

describe("PrismaNotificationRepository", () => {
	let repository: PrismaNotificationRepository;
	let db: MockPrismaClient;

	beforeEach(async () => {
		NotificationBuilder.resetIdCounter();
		db = createMockPrisma();
		const { unit } = await TestBed.solitary(PrismaNotificationRepository)
			.mock<TransactionHost<TransactionalAdapterPrisma<DatabaseService>>>(TransactionHost)
			.impl(() => ({ tx: db }))
			.compile();
		repository = unit;
	});

	it("알림 생성 입력을 Prisma 행으로 손실 없이 매핑한다", async () => {
		const data: CreateNotificationData = {
			userId: "user-1",
			type: "FOLLOW_NEW",
			title: "새로운 친구 요청",
			body: "친구 문을 두드렸어요",
			friendId: "friend-1",
		};
		const expected = NotificationBuilder.create("user-1").asFollowNew("friend-1").build();
		asMock(db.notification.create).mockResolvedValue(expected);

		await expect(repository.createNotification(data)).resolves.toEqual(expected);
		expect(db.notification.create).toHaveBeenCalledWith({
			data: {
				userId: data.userId,
				type: data.type,
				title: data.title,
				body: data.body,
				todoId: undefined,
				friendId: data.friendId,
				nudgeId: undefined,
				cheerId: undefined,
				metadata: undefined,
				notificationDate: undefined,
				actionType: "DEEP_LINK",
				actionUrl: undefined,
				campaignKey: undefined,
				variantId: undefined,
				purpose: "TRANSACTIONAL",
			},
		});
	});

	it("metadata와 action을 createManyAndReturn에도 동일하게 매핑한다", async () => {
		const data: CreateNotificationData = {
			userId: "user-1",
			type: "SYSTEM_NOTICE",
			title: "공지",
			body: "새 소식",
			metadata: { noticeId: "notice-1" },
			action: { type: "BROWSER", url: "https://aido.kr/notice" },
			purpose: "ENGAGEMENT",
		};
		const expected = [NotificationBuilder.create("user-1").asSystemNotice().build()];
		asMock(db.notification.createManyAndReturn).mockResolvedValue(expected);

		await expect(repository.createManyNotificationsAndReturn([data])).resolves.toEqual(expected);
		expect(db.notification.createManyAndReturn).toHaveBeenCalledWith({
			data: [
				expect.objectContaining({
					metadata: { noticeId: "notice-1" },
					actionType: "BROWSER",
					actionUrl: "https://aido.kr/notice",
					purpose: "ENGAGEMENT",
				}),
			],
			skipDuplicates: true,
		});
	});

	it("빈 배치는 DB를 호출하지 않는다", async () => {
		await expect(repository.createManyNotificationsAndReturn([])).resolves.toEqual([]);
		expect(db.notification.createManyAndReturn).not.toHaveBeenCalled();
	});

	it("배치 unique violation을 application duplicate error로 변환한다", async () => {
		asMock(db.notification.createManyAndReturn).mockRejectedValue(
			new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
				code: "P2002",
				clientVersion: "test",
			}),
		);

		await expect(
			repository.createManyNotificationsAndReturn([
				{ userId: "u1", type: "FRIEND_COMPLETED", title: "t", body: "b" },
			]),
		).rejects.toBeInstanceOf(DuplicateNotificationError);
	});

	it("소유한 미읽음 알림만 읽음으로 전이한다", async () => {
		asMock(db.notification.updateMany).mockResolvedValue({ count: 1 });

		await expect(repository.markAsRead(1, "user-1")).resolves.toBe(true);
		expect(db.notification.updateMany).toHaveBeenCalledWith({
			where: { id: 1, userId: "user-1", isRead: false },
			data: { isRead: true, readAt: expect.any(Date) },
		});
	});

	it("알림 열림이 처음 기록될 때 연관 dispatch도 같은 시각으로 갱신한다", async () => {
		asMock(db.notification.updateMany).mockResolvedValue({ count: 1 });
		asMock(db.pushDispatch.updateMany).mockResolvedValue({ count: 1 });

		await expect(repository.markAsOpened(7, "user-1")).resolves.toBe(true);
		const notificationUpdate = asMock(db.notification.updateMany).mock.calls[0]?.[0];
		const openedAt = notificationUpdate?.data.openedAt;
		expect(db.pushDispatch.updateMany).toHaveBeenCalledWith({
			where: { notificationId: 7, userId: "user-1", openedAt: null },
			data: { openedAt },
		});
	});

	it("이미 열린 알림이면 dispatch를 다시 갱신하지 않는다", async () => {
		asMock(db.notification.updateMany).mockResolvedValue({ count: 0 });

		await expect(repository.markAsOpened(7, "user-1")).resolves.toBe(false);
		expect(db.pushDispatch.updateMany).not.toHaveBeenCalled();
	});

	it("사용자의 모든 미읽음 알림을 한 번에 읽음 처리한다", async () => {
		asMock(db.notification.updateMany).mockResolvedValue({ count: 5 });

		await expect(repository.markAllAsRead("user-1")).resolves.toEqual({ count: 5 });
		expect(db.notification.updateMany).toHaveBeenCalledWith({
			where: { userId: "user-1", isRead: false },
			data: { isRead: true, readAt: expect.any(Date) },
		});
	});

	it("발신자 개인정보가 복사된 알림을 한 쿼리로 지우고 수신자를 중복 제거한다", async () => {
		asMock(db.$queryRaw).mockResolvedValue([
			{ userId: "recipient-1" },
			{ userId: "recipient-1" },
			{ userId: "recipient-2" },
		]);

		await expect(repository.deleteNotificationsByActorId("actor-1")).resolves.toEqual({
			count: 3,
			affectedUserIds: ["recipient-1", "recipient-2"],
		});
		expect(db.$queryRaw).toHaveBeenCalledTimes(1);
		expect(db.notification.findMany).not.toHaveBeenCalled();
		expect(db.notification.deleteMany).not.toHaveBeenCalled();
	});
});
