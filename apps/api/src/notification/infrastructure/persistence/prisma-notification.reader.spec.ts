import { and } from "@prisma/orm-postgres/orm-client";

import {
	databaseDate,
	databaseTimestamp,
} from "#api/shared/infrastructure/database/database-values";
import { NotificationBuilder } from "#test/builders/index";
import {
	assertNativeWhere,
	createMockTransactionHost,
	databaseFixture,
	nativeRows,
} from "#test/mocks/database.mock";
import { asMock, createMockDatabaseContext, type MockDatabaseContext } from "#test/mocks/index";

import type { FindNotificationsParams } from "../../application/ports/notification-data.js";
import { PrismaNotificationReader } from "./prisma-notification.reader.js";

describe("PrismaNotificationReader", () => {
	let reader: PrismaNotificationReader;
	let db: MockDatabaseContext;

	beforeEach(async () => {
		NotificationBuilder.resetIdCounter();
		db = createMockDatabaseContext();
		reader = new PrismaNotificationReader(createMockTransactionHost(db));
	});

	it("ID로 알림을 조회하고 부재는 null로 유지한다", async () => {
		const notification = NotificationBuilder.create("user-1").withId(1).build();
		asMock(db.orm.public.Notification.first)
			.mockResolvedValueOnce(databaseFixture("Notification", notification))
			.mockResolvedValueOnce(null);

		await expect(reader.findNotificationById(1)).resolves.toEqual(notification);
		await expect(reader.findNotificationById(999)).resolves.toBeNull();
		assertNativeWhere(
			"Notification",
			db.orm.public.Notification.where.mock.calls[1 - 1]?.[0],
			(row) => row.id.eq(1),
		);
	});

	it("알림함 기본 조회는 size + 1과 안정적인 복합 정렬을 사용한다", async () => {
		const params: FindNotificationsParams = { userId: "user-1", size: 10 };
		const notifications = [NotificationBuilder.create("user-1").build()];
		asMock(db.orm.public.Notification.all).mockReturnValue(
			nativeRows(
				databaseFixture(
					"Notification",
					notifications.map((value) => ({
						...NotificationBuilder.create("user-1").build(),
						...value,
					})),
				),
			),
		);

		await expect(reader.findNotificationsByUser(params)).resolves.toEqual(notifications);
		assertNativeWhere(
			"Notification",
			db.orm.public.Notification.where.mock.calls.at(-1)?.[0],
			(row) => row.userId.eq("user-1"),
		);
	});

	it("cursor가 0이어도 유효한 cursor로 적용한다", async () => {
		asMock(db.orm.public.Notification.all).mockReturnValue(
			nativeRows(databaseFixture("Notification", [])),
		);

		const anchor = databaseFixture(
			"Notification",
			NotificationBuilder.create("user-1").withId(0).build(),
		);
		asMock(db.orm.public.Notification.first).mockResolvedValue(anchor);
		await reader.findNotificationsByUser({ userId: "user-1", cursor: 0, size: 10 });
		assertNativeWhere("Notification", db.orm.public.Notification.where.mock.calls[0]?.[0], (row) =>
			row.userId.eq("user-1"),
		);
		assertNativeWhere("Notification", db.orm.public.Notification.where.mock.calls[1]?.[0], (row) =>
			row.id.eq(0),
		);
		expect(db.orm.public.Notification.cursor).toHaveBeenCalledWith(anchor);
	});

	it("unreadOnly와 types를 같은 where에 결합한다", async () => {
		asMock(db.orm.public.Notification.all).mockReturnValue(
			nativeRows(databaseFixture("Notification", [])),
		);

		await reader.findNotificationsByUser({
			userId: "user-1",
			size: 20,
			unreadOnly: true,
			types: ["SYSTEM_NOTICE", "ADMIN_BROADCAST"],
		});
		assertNativeWhere(
			"Notification",
			db.orm.public.Notification.where.mock.calls.at(-1)?.[0],
			(row) =>
				and(
					row.userId.eq("user-1"),
					row.isRead.eq(false),
					row._type.in(["SYSTEM_NOTICE", "ADMIN_BROADCAST"]),
				),
		);
	});

	it("타입 필터가 없으면 type 조건을 만들지 않는다", async () => {
		asMock(db.orm.public.Notification.all).mockReturnValue(
			nativeRows(databaseFixture("Notification", [])),
		);

		await reader.findNotificationsByUser({ userId: "user-1", size: 20 });
		assertNativeWhere("Notification", db.orm.public.Notification.where.mock.calls[0]?.[0], (row) =>
			row.userId.eq("user-1"),
		);
	});

	it("허용된 타입이 빈 배열이면 전체 조회로 확장하지 않는다", async () => {
		// Given
		asMock(db.orm.public.Notification.all).mockReturnValue(
			nativeRows(databaseFixture("Notification", [])),
		);

		// When
		await reader.findNotificationsByUser({ userId: "user-1", size: 20, types: [] });

		// Then
		assertNativeWhere(
			"Notification",
			db.orm.public.Notification.where.mock.calls.at(-1)?.[0],
			(row) => and(row.userId.eq("user-1"), row._type.in([])),
		);
	});

	it("미읽음 개수는 사용자와 isRead 조건으로 센다", async () => {
		asMock(db.orm.public.Notification.aggregate).mockResolvedValue({ count: 3 });

		await expect(reader.countUnread("user-1")).resolves.toBe(3);
		assertNativeWhere(
			"Notification",
			db.orm.public.Notification.where.mock.calls.at(-1)?.[0],
			(row) => and(row.userId.eq("user-1"), row.isRead.eq(false)),
		);
	});

	it("최근 알림 조회는 전달된 context만 조건에 넣는다", async () => {
		const since = new Date("2026-02-06T00:00:00.000Z");
		asMock(db.orm.public.Notification.first).mockResolvedValue(
			databaseFixture("Notification", { id: 1 }),
		);

		await expect(
			reader.existsRecentNotification({
				userId: "user-1",
				type: "NUDGE_RECEIVED",
				since,
				friendId: "friend-1",
				nudgeId: 17,
			}),
		).resolves.toBe(true);
		assertNativeWhere("Notification", db.orm.public.Notification.where.mock.calls[0]?.[0], (row) =>
			and(
				row.userId.eq("user-1"),
				row._type.eq("NUDGE_RECEIVED"),
				row.createdAt.gte(databaseTimestamp(since)),
				row.friendId.eq("friend-1"),
				row.nudgeId.eq(17),
			),
		);
	});

	it("최근 알림이 없으면 false를 반환한다", async () => {
		asMock(db.orm.public.Notification.first).mockResolvedValue(
			databaseFixture("Notification", null),
		);
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
		asMock(db.orm.public.Notification.groupBy("userId").aggregate).mockResolvedValue([
			{ userId: "user-1", count: 1 },
			{ userId: "user-3", count: 1 },
		]);

		await expect(
			reader.findAlreadyNotifiedUserIds({
				userIds: ["user-1", "user-2", "user-3"],
				type: "FRIEND_COMPLETED",
				notificationDate,
				friendId: "friend-1",
			}),
		).resolves.toEqual(new Set(["user-1", "user-3"]));
		assertNativeWhere(
			"Notification",
			db.orm.public.Notification.where.mock.calls.at(-1)?.[0],
			(row) =>
				and(
					row.userId.in(["user-1", "user-2", "user-3"]),
					row._type.eq("FRIEND_COMPLETED"),
					row.notificationDate.eq(databaseDate(notificationDate)),
					row.friendId.eq("friend-1"),
				),
		);
	});

	it("마일스톤 metadata 존재 여부를 조회한다", async () => {
		asMock(db.orm.public.Notification.first).mockResolvedValue(
			databaseFixture("Notification", { id: 1 }),
		);

		await expect(reader.hasMilestoneNotification("user-1", "COUNT_10")).resolves.toBe(true);
		assertNativeWhere("Notification", db.orm.public.Notification.where.mock.calls[0]?.[0], (row) =>
			row.userId.eq("user-1"),
		);
		assertNativeWhere("Notification", db.orm.public.Notification.where.mock.calls[1]?.[0], (row) =>
			db.raw.sql`${row.metadata} ->> 'milestone' = ${"COUNT_10"}`.returns("pg/bool@1").buildAst(),
		);
		expect(db.orm.public.Notification.select).toHaveBeenCalledWith("id");
	});
});
