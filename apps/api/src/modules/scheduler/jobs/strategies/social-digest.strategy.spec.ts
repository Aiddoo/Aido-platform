import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import dayjs from "dayjs";

import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { NotificationMessageBuilder } from "@/modules/notification/templates/notification-templates";

import { SocialDigestStrategy } from "./social-digest.strategy";
import type { TimezoneContext } from "./timezone-reminder-strategy.interface";

// =============================================================================
// Tests
// =============================================================================

describe("SocialDigestStrategy", () => {
	let strategy: SocialDigestStrategy;
	let database: Mocked<DatabaseService>;
	let notificationService: Mocked<NotificationService>;

	const TZ = "Asia/Seoul";

	/** KST 2024-01-16 20:00 = UTC 2024-01-16T11:00:00Z */
	const FAKE_NOW = new Date("2024-01-16T11:00:00Z");

	const makeCtx = (overrides?: Partial<TimezoneContext>): TimezoneContext => ({
		tz: TZ,
		localHour: 20,
		localMinute: 0,
		dayOfWeek: 2,
		today: dayjs.utc("2024-01-16").startOf("day").toDate(),
		tomorrow: dayjs.utc("2024-01-17").startOf("day").toDate(),
		...overrides,
	});

	beforeEach(async () => {
		jest.useFakeTimers();
		jest.setSystemTime(FAKE_NOW);

		const { unit, unitRef } =
			await TestBed.solitary(SocialDigestStrategy).compile();

		strategy = unit;
		database = unitRef.get(DatabaseService);
		notificationService = unitRef.get(NotificationService);

		// 기본 mock 설정
		database.user.findMany.mockResolvedValue([] as never);
		database.follow.findMany.mockResolvedValue([] as never);
		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(new Set());
		notificationService.createAndSendBatch.mockResolvedValue(
			undefined as never,
		);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	// =========================================================================
	// 본인 미완료 + 완료 친구 1명
	// =========================================================================

	it("본인 미완료 + 완료 친구 1명일 때 Social Digest를 발송한다", async () => {
		const ctx = makeCtx();

		// 미완료 투두가 있는 유저
		database.user.findMany
			.mockResolvedValueOnce([
				{
					id: "user-1",
					todos: [{ completed: false }, { completed: true }],
				},
			] as never)
			// 친구의 투두 완료 현황
			.mockResolvedValueOnce([
				{
					id: "friend-1",
					profile: { name: "친구1" },
					todos: [{ completed: true }, { completed: true }],
				},
			] as never);

		// 팔로우 관계
		database.follow.findMany.mockResolvedValueOnce([
			{ followerId: "user-1", followingId: "friend-1" },
		] as never);

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 1 });

		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		const expected = NotificationMessageBuilder.socialDigest(1, "친구1");
		expect(notifications?.[0]).toMatchObject({
			userId: "user-1",
			type: "SOCIAL_DIGEST",
			title: expected.title,
			body: expected.body,
		});
	});

	// =========================================================================
	// 본인 미완료 + 완료 친구 2명 이상
	// =========================================================================

	it("본인 미완료 + 완료 친구 2명 이상일 때 다른 메시지를 발송한다", async () => {
		const ctx = makeCtx();

		database.user.findMany
			.mockResolvedValueOnce([
				{
					id: "user-1",
					todos: [{ completed: false }],
				},
			] as never)
			.mockResolvedValueOnce([
				{
					id: "friend-1",
					profile: { name: "친구1" },
					todos: [{ completed: true }],
				},
				{
					id: "friend-2",
					profile: { name: "친구2" },
					todos: [{ completed: true }],
				},
			] as never);

		database.follow.findMany.mockResolvedValueOnce([
			{ followerId: "user-1", followingId: "friend-1" },
			{ followerId: "user-1", followingId: "friend-2" },
		] as never);

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 1 });

		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		const expected = NotificationMessageBuilder.socialDigest(2);
		expect(notifications?.[0]).toMatchObject({
			title: expected.title,
			body: expected.body,
		});
	});

	// =========================================================================
	// 본인 전체 완료
	// =========================================================================

	it("본인이 전체 완료이면 발송하지 않는다", async () => {
		const ctx = makeCtx();

		// 쿼리에서 completed: false인 투두가 있는 유저만 조회하므로
		// 전체 완료 유저는 쿼리 결과에 포함되지 않음
		database.user.findMany.mockResolvedValueOnce([] as never);

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});

	// =========================================================================
	// 친구 없음
	// =========================================================================

	it("친구가 없으면 발송하지 않는다", async () => {
		const ctx = makeCtx();

		database.user.findMany
			.mockResolvedValueOnce([
				{
					id: "user-1",
					todos: [{ completed: false }],
				},
			] as never)
			// 친구 투두 현황 조회 불필요 (allFriendIds.size === 0으로 조기 반환)
			.mockResolvedValueOnce([] as never);

		// 팔로우 관계 없음
		database.follow.findMany.mockResolvedValueOnce([] as never);

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});

	// =========================================================================
	// 중복 방지
	// =========================================================================

	it("이미 알림 받은 사용자를 제외한다", async () => {
		const ctx = makeCtx();

		database.user.findMany.mockResolvedValueOnce([
			{
				id: "user-1",
				todos: [{ completed: false }],
			},
		] as never);

		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(
			new Set(["user-1"]),
		);

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});
});
