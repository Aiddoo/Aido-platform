import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import dayjs from "dayjs";

import type { IDedupProvider } from "@/common/dedup/interfaces/dedup.interface";
import { DEDUP_PROVIDER } from "@/common/dedup/interfaces/dedup.interface";
import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { NotificationMessageBuilder } from "@/modules/notification/templates/notification-templates";

import { NudgeSuggestStrategy } from "./nudge-suggest.strategy";
import type { TimezoneContext } from "./timezone-reminder-strategy.interface";

// =============================================================================
// Tests
// =============================================================================

describe("NudgeSuggestStrategy", () => {
	let strategy: NudgeSuggestStrategy;
	let database: Mocked<DatabaseService>;
	let notificationService: Mocked<NotificationService>;
	let dedupProvider: Mocked<IDedupProvider>;

	const TZ = "Asia/Seoul";

	/** KST 2024-01-16 14:00 = UTC 2024-01-16T05:00:00Z */
	const FAKE_NOW = new Date("2024-01-16T05:00:00Z");

	const makeCtx = (overrides?: Partial<TimezoneContext>): TimezoneContext => ({
		tz: TZ,
		localHour: 14,
		localMinute: 0,
		dayOfWeek: 2,
		today: dayjs.utc("2024-01-16").startOf("day").toDate(),
		tomorrow: dayjs.utc("2024-01-17").startOf("day").toDate(),
		...overrides,
	});

	beforeEach(async () => {
		jest.useFakeTimers();
		jest.setSystemTime(FAKE_NOW);
		jest.spyOn(Math, "random").mockReturnValue(0);

		const { unit, unitRef } =
			await TestBed.solitary(NudgeSuggestStrategy).compile();

		strategy = unit;
		database = unitRef.get(DatabaseService);
		notificationService = unitRef.get(NotificationService);
		dedupProvider = unitRef.get(DEDUP_PROVIDER);

		// 기본 mock 설정
		database.user.findMany.mockResolvedValue([] as never);
		database.follow.findMany.mockResolvedValue([] as never);
		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(new Set());
		notificationService.createAndSendBatch.mockResolvedValue(
			undefined as never,
		);
		dedupProvider.filterMembers.mockResolvedValue(new Set());
		dedupProvider.addMembers.mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	// =========================================================================
	// Nudge Suggest 발송
	// =========================================================================

	it("비활성 친구가 있으면 Nudge Suggest를 발송한다", async () => {
		const ctx = makeCtx();
		const threeDaysAgo = dayjs.utc("2024-01-13").startOf("day").toDate();

		// activeUsers
		database.user.findMany.mockResolvedValueOnce([{ id: "user-1" }] as never);

		// allFollows: user-1 → friend-1 (비활성 친구)
		database.follow.findMany.mockResolvedValueOnce([
			{
				followerId: "user-1",
				followingId: "friend-1",
				follower: {
					id: "user-1",
					lastActiveAt: FAKE_NOW,
					profile: { name: "사용자1" },
				},
				following: {
					id: "friend-1",
					lastActiveAt: threeDaysAgo,
					profile: { name: "친구1" },
				},
			},
		] as never);

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 1 });

		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		const expected = NotificationMessageBuilder.nudgeSuggest("친구1", 3);
		expect(notifications?.[0]).toMatchObject({
			userId: "user-1",
			type: "NUDGE_SUGGEST",
			title: expected.title,
			body: expected.body,
			friendId: "friend-1",
		});
	});

	// =========================================================================
	// 이번 주 중복 방지
	// =========================================================================

	it("이미 이번 주 같은 친구에게 발송했으면 스킵한다", async () => {
		const ctx = makeCtx();
		const threeDaysAgo = dayjs.utc("2024-01-13").startOf("day").toDate();

		database.user.findMany.mockResolvedValueOnce([{ id: "user-1" }] as never);

		database.follow.findMany.mockResolvedValueOnce([
			{
				followerId: "user-1",
				followingId: "friend-1",
				follower: {
					id: "user-1",
					lastActiveAt: FAKE_NOW,
					profile: { name: "사용자1" },
				},
				following: {
					id: "friend-1",
					lastActiveAt: threeDaysAgo,
					profile: { name: "친구1" },
				},
			},
		] as never);

		// 이번 주 이미 friend-1에게 발송 이력 (Redis)
		dedupProvider.filterMembers.mockResolvedValueOnce(
			new Set(["user-1:friend-1"]),
		);

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});

	// =========================================================================
	// 친구 없음
	// =========================================================================

	it("친구가 없으면 Nudge Suggest를 발송하지 않는다", async () => {
		const ctx = makeCtx();

		database.user.findMany.mockResolvedValueOnce([{ id: "user-1" }] as never);

		// 비활성 친구 없음
		database.follow.findMany.mockResolvedValueOnce([] as never);

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});

	// =========================================================================
	// 대상 없음
	// =========================================================================

	it("대상이 없으면 createAndSendBatch를 호출하지 않는다", async () => {
		const ctx = makeCtx();

		database.user.findMany.mockResolvedValueOnce([] as never);

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});
});
