import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { TestBed } from "@suites/unit";
import { NotificationBuilder } from "@test/builders";
import { asMock, createMockPrisma, type MockPrismaClient } from "@test/mocks";

import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import type { FindNotificationsParams } from "../../application/ports/notification-data";
import { PrismaNotificationReader } from "./prisma-notification.reader";

describe("PrismaNotificationReader", () => {
	let reader: PrismaNotificationReader;
	let db: MockPrismaClient;

	beforeEach(async () => {
		NotificationBuilder.resetIdCounter();
		db = createMockPrisma();
		const { unit } = await TestBed.solitary(PrismaNotificationReader)
			.mock<TransactionHost<TransactionalAdapterPrisma<DatabaseService>>>(TransactionHost)
			.impl(() => ({ tx: db }))
			.compile();
		reader = unit;
	});

	it("ID로 알림을 조회하고 부재는 null로 유지한다", async () => {
		const notification = NotificationBuilder.create("user-1").withId(1).build();
		asMock(db.notification.findUnique)
			.mockResolvedValueOnce(notification)
			.mockResolvedValueOnce(null);

		await expect(reader.findNotificationById(1)).resolves.toEqual(notification);
		await expect(reader.findNotificationById(999)).resolves.toBeNull();
		expect(db.notification.findUnique).toHaveBeenNthCalledWith(1, { where: { id: 1 } });
	});

	it("알림함 기본 조회는 size + 1과 안정적인 복합 정렬을 사용한다", async () => {
		const params: FindNotificationsParams = { userId: "user-1", size: 10 };
		const notifications = [NotificationBuilder.create("user-1").build()];
		asMock(db.notification.findMany).mockResolvedValue(notifications);

		await expect(reader.findNotificationsByUser(params)).resolves.toEqual(notifications);
		expect(db.notification.findMany).toHaveBeenCalledWith({
			where: { userId: "user-1" },
			take: 11,
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		});
	});

	it("cursor가 0이어도 유효한 cursor로 적용한다", async () => {
		asMock(db.notification.findMany).mockResolvedValue([]);

		await reader.findNotificationsByUser({ userId: "user-1", cursor: 0, size: 10 });
		expect(db.notification.findMany).toHaveBeenCalledWith({
			where: { userId: "user-1" },
			take: 11,
			skip: 1,
			cursor: { id: 0 },
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		});
	});

	it("unreadOnly와 types를 같은 where에 결합한다", async () => {
		asMock(db.notification.findMany).mockResolvedValue([]);

		await reader.findNotificationsByUser({
			userId: "user-1",
			size: 20,
			unreadOnly: true,
			types: ["SYSTEM_NOTICE", "ADMIN_BROADCAST"],
		});
		expect(db.notification.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					userId: "user-1",
					isRead: false,
					type: { in: ["SYSTEM_NOTICE", "ADMIN_BROADCAST"] },
				},
			}),
		);
	});

	it.each([undefined, []])("types=%p이면 type 조건을 만들지 않는다", async (types) => {
		asMock(db.notification.findMany).mockResolvedValue([]);

		await reader.findNotificationsByUser({ userId: "user-1", size: 20, types });
		const call = asMock(db.notification.findMany).mock.calls[0]?.[0];
		expect(call?.where).not.toHaveProperty("type");
	});

	it("미읽음 개수는 사용자와 isRead 조건으로 센다", async () => {
		asMock(db.notification.count).mockResolvedValue(3);

		await expect(reader.countUnread("user-1")).resolves.toBe(3);
		expect(db.notification.count).toHaveBeenCalledWith({
			where: { userId: "user-1", isRead: false },
		});
	});

	it("최근 알림 조회는 전달된 context만 조건에 넣는다", async () => {
		const since = new Date("2026-02-06T00:00:00.000Z");
		asMock(db.notification.count).mockResolvedValue(1);

		await expect(
			reader.existsRecentNotification({
				userId: "user-1",
				type: "NUDGE_RECEIVED",
				since,
				friendId: "friend-1",
				nudgeId: 17,
			}),
		).resolves.toBe(true);
		expect(db.notification.count).toHaveBeenCalledWith({
			where: {
				userId: "user-1",
				type: "NUDGE_RECEIVED",
				createdAt: { gte: since },
				friendId: "friend-1",
				nudgeId: 17,
			},
		});
	});

	it("최근 알림이 없으면 false를 반환한다", async () => {
		asMock(db.notification.count).mockResolvedValue(0);
		await expect(
			reader.existsRecentNotification({
				userId: "user-1",
				type: "WEEKLY_ACHIEVEMENT",
				since: new Date("2026-02-06T00:00:00.000Z"),
			}),
		).resolves.toBe(false);
	});

	it("이미 알림 받은 수신자를 distinct Set으로 반환한다", async () => {
		const notificationDate = new Date("2026-02-06T00:00:00.000Z");
		asMock(db.notification.findMany).mockResolvedValue([
			{ userId: "user-1" },
			{ userId: "user-3" },
		]);

		await expect(
			reader.findAlreadyNotifiedUserIds({
				userIds: ["user-1", "user-2", "user-3"],
				type: "FRIEND_COMPLETED",
				notificationDate,
				friendId: "friend-1",
			}),
		).resolves.toEqual(new Set(["user-1", "user-3"]));
		expect(db.notification.findMany).toHaveBeenCalledWith({
			where: {
				userId: { in: ["user-1", "user-2", "user-3"] },
				type: "FRIEND_COMPLETED",
				friendId: "friend-1",
				notificationDate,
			},
			select: { userId: true },
			distinct: ["userId"],
		});
	});
});
