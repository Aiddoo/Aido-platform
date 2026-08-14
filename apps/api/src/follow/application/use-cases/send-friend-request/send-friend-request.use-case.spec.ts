/**
 * SendFriendRequestUseCase 단위 테스트 (Suites solitary + 포트 모킹).
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { EntitlementService } from "@/shared/application/entitlement/entitlement.service";
import { UNIT_OF_WORK } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { Friendship } from "../../../domain/entities/friendship.aggregate";
import {
	FOLLOW_REPOSITORY,
	type FollowRepositoryPort,
} from "../../ports/follow.repository.port";
import {
	FOLLOW_NOTIFIER,
	type FollowNotifierPort,
} from "../../ports/follow-notifier.port";
import { FollowReader } from "../../services/follow.reader";
import { FriendshipEffects } from "../../services/friendship-effects.service";
import { SendFriendRequestUseCase } from "./send-friend-request.use-case";

const friendship = (
	followerId: string,
	followingId: string,
	status: "PENDING" | "ACCEPTED" = "PENDING",
): Friendship =>
	Friendship.reconstitute({
		id: "f-1",
		followerId,
		followingId,
		status,
		sortOrder: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

describe("SendFriendRequestUseCase", () => {
	let useCase: SendFriendRequestUseCase;
	let repo: Mocked<FollowRepositoryPort>;
	let notifier: Mocked<FollowNotifierPort>;
	let reader: Mocked<FollowReader>;
	let effects: Mocked<FriendshipEffects>;
	let entitlement: Mocked<EntitlementService>;
	let uow: Mocked<{ run: (fn: () => unknown) => unknown }>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			SendFriendRequestUseCase,
		).compile();
		useCase = unit;
		repo = unitRef.get(FOLLOW_REPOSITORY);
		notifier = unitRef.get(FOLLOW_NOTIFIER);
		reader = unitRef.get(FollowReader);
		effects = unitRef.get(FriendshipEffects);
		entitlement = unitRef.get(EntitlementService);
		uow = unitRef.get(UNIT_OF_WORK);

		reader.countFriends.mockResolvedValue(0);
		entitlement.getResourceLimit.mockResolvedValue({
			maxCount: null,
			isAdmin: false,
			subscriptionStatus: "ACTIVE",
		});
		repo.userExists.mockResolvedValue(true);
		repo.getUserDisplayName.mockResolvedValue("name");
		uow.run.mockImplementation((fn: () => unknown) => fn());
	});

	it("자기 자신에게 요청하면 FOLLOW_0904", async () => {
		await expect(
			useCase.execute({ userId: "u1", targetUserId: "u1" }),
		).rejects.toBeInstanceOf(ApplicationException);
	});

	it("한도 초과면 FOLLOW_0909", async () => {
		reader.countFriends.mockResolvedValue(50);
		entitlement.getResourceLimit.mockResolvedValue({
			maxCount: 50,
			isAdmin: false,
			subscriptionStatus: "FREE",
		});
		await expect(
			useCase.execute({ userId: "u1", targetUserId: "u2" }),
		).rejects.toBeInstanceOf(ApplicationException);
	});

	it("대상이 없으면 FOLLOW_0905", async () => {
		repo.userExists.mockResolvedValue(false);
		await expect(
			useCase.execute({ userId: "u1", targetUserId: "u2" }),
		).rejects.toBeInstanceOf(ApplicationException);
	});

	it("이미 ACCEPTED면 FOLLOW_0902", async () => {
		repo.findByFollowerAndFollowing.mockResolvedValueOnce(
			friendship("u1", "u2", "ACCEPTED"),
		);
		await expect(
			useCase.execute({ userId: "u1", targetUserId: "u2" }),
		).rejects.toBeInstanceOf(ApplicationException);
	});

	it("이미 PENDING이면 FOLLOW_0901", async () => {
		repo.findByFollowerAndFollowing.mockResolvedValueOnce(
			friendship("u1", "u2"),
		);
		await expect(
			useCase.execute({ userId: "u1", targetUserId: "u2" }),
		).rejects.toBeInstanceOf(ApplicationException);
	});

	it("신규 요청은 PENDING 생성 + 새 팔로우 알림", async () => {
		repo.findByFollowerAndFollowing.mockResolvedValue(null);
		repo.create.mockResolvedValue(friendship("u1", "u2"));

		const result = await useCase.execute({ userId: "u1", targetUserId: "u2" });

		expect(result.autoAccepted).toBe(false);
		expect(result.follow.status).toBe("PENDING");
		expect(notifier.notifyFollowNew).toHaveBeenCalledWith(
			expect.objectContaining({ followerId: "u1", followingId: "u2" }),
		);
	});

	it("상대가 먼저 PENDING이면 자동 수락 + 맞팔 알림/캐시 무효화", async () => {
		repo.findByFollowerAndFollowing
			.mockResolvedValueOnce(null) // 내가 보낸 요청 없음
			.mockResolvedValueOnce(friendship("u2", "u1")); // 상대가 보낸 PENDING
		repo.getMaxSortOrderForFriends.mockResolvedValue(0);
		repo.create.mockResolvedValue(friendship("u1", "u2", "ACCEPTED"));

		const result = await useCase.execute({ userId: "u1", targetUserId: "u2" });

		expect(result.autoAccepted).toBe(true);
		expect(result.follow.status).toBe("ACCEPTED");
		expect(effects.notifyMutual).toHaveBeenCalledTimes(2);
		expect(effects.invalidateFriendshipCaches).toHaveBeenCalledWith("u1", "u2");
	});
});
