/**
 * SocialDigestStrategy 전략 단위 테스트
 *
 * @description
 * SocialDigestStrategy의 실행 로직을 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test social-digest.strategy
 * ```
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import dayjs from "dayjs";
import { NotificationFacade, NotificationMessageBuilder } from "@/notification";

import type { TimezoneContext } from "../../domain/services/timezone-context";
import {
	RE_ENGAGEMENT_READER,
	type ReEngagementReaderPort,
} from "../ports/re-engagement-reader.port";
import {
	SCHEDULER_PREFERENCE_READER,
	type SchedulerPreferenceReaderPort,
} from "../ports/scheduler-preference-reader.port";
import { SocialDigestStrategy } from "./social-digest.strategy";

describe("SocialDigestStrategy — 소셜 다이제스트 전략", () => {
	let strategy: SocialDigestStrategy;
	let reader: Mocked<ReEngagementReaderPort>;
	let preferenceReader: Mocked<SchedulerPreferenceReaderPort>;
	let notificationService: Mocked<NotificationFacade>;

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
		jest.spyOn(Math, "random").mockReturnValue(0);

		const { unit, unitRef } =
			await TestBed.solitary(SocialDigestStrategy).compile();

		strategy = unit;
		reader = unitRef.get(RE_ENGAGEMENT_READER);
		preferenceReader = unitRef.get(SCHEDULER_PREFERENCE_READER);
		notificationService = unitRef.get(NotificationFacade);

		// 기본 mock 설정
		reader.findSocialDigestCandidates.mockResolvedValue([]);
		reader.findAcceptedFollows.mockResolvedValue([]);
		reader.findFriendsWithTodayTodos.mockResolvedValue([]);
		preferenceReader.findUserLocales.mockResolvedValue(new Map());
		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(new Set());
		notificationService.createAndSendBatch.mockResolvedValue({ count: 0 });
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("본인 미완료 + 완료 친구 1명일 때 Social Digest를 발송한다", async () => {
		// Given
		const ctx = makeCtx();

		// 미완료 투두가 있는 유저
		reader.findSocialDigestCandidates.mockResolvedValue([
			{
				id: "user-1",
				todos: [{ completed: false }, { completed: true }],
			},
		]);

		// 친구의 투두 완료 현황
		reader.findFriendsWithTodayTodos.mockResolvedValue([
			{
				id: "friend-1",
				profile: { name: "친구1" },
				todos: [{ completed: true }, { completed: true }],
			},
		]);

		// 팔로우 관계
		reader.findAcceptedFollows.mockResolvedValue([
			{ followerId: "user-1", followingId: "friend-1" },
		]);

		// When
		const result = await strategy.execute(ctx);

		// Then
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

	it("본인 미완료 + 완료 친구 2명 이상일 때 다른 메시지를 발송한다", async () => {
		// Given
		const ctx = makeCtx();

		reader.findSocialDigestCandidates.mockResolvedValue([
			{
				id: "user-1",
				todos: [{ completed: false }],
			},
		]);

		reader.findFriendsWithTodayTodos.mockResolvedValue([
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
		]);

		reader.findAcceptedFollows.mockResolvedValue([
			{ followerId: "user-1", followingId: "friend-1" },
			{ followerId: "user-1", followingId: "friend-2" },
		]);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 1 });

		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		const expected = NotificationMessageBuilder.socialDigest(2);
		expect(notifications?.[0]).toMatchObject({
			title: expected.title,
			body: expected.body,
		});
	});

	it("본인이 전체 완료이면 발송하지 않는다", async () => {
		// Given
		const ctx = makeCtx();

		// 쿼리에서 completed: false인 투두가 있는 유저만 조회하므로
		// 전체 완료 유저는 쿼리 결과에 포함되지 않음
		reader.findSocialDigestCandidates.mockResolvedValue([]);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});

	it("친구가 없으면 발송하지 않는다", async () => {
		// Given
		const ctx = makeCtx();

		reader.findSocialDigestCandidates.mockResolvedValue([
			{
				id: "user-1",
				todos: [{ completed: false }],
			},
		]);

		// 친구 투두 현황 조회 불필요 (allFriendIds.size === 0으로 조기 반환)
		reader.findFriendsWithTodayTodos.mockResolvedValue([]);

		// 팔로우 관계 없음
		reader.findAcceptedFollows.mockResolvedValue([]);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});

	it("이미 알림 받은 사용자를 제외한다", async () => {
		// Given
		const ctx = makeCtx();

		reader.findSocialDigestCandidates.mockResolvedValue([
			{
				id: "user-1",
				todos: [{ completed: false }],
			},
		]);

		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(
			new Set(["user-1"]),
		);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});
});
