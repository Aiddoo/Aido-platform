/**
 * RejectFriendRequestUseCase 단위 테스트 (Suites solitary + 포트 모킹).
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createFollowRepositoryMock } from "@test/mocks/ports/follow.mock";

import { Friendship } from "../../../domain/entities/friendship.aggregate";
import { FOLLOW_REPOSITORY, type FollowRepositoryPort } from "../../ports/follow.repository.port";
import { RejectFriendRequestUseCase } from "./reject-friend-request.use-case";

const ME = "u-me";
const REQUESTER = "u-req";

const friendship = (id: string, status: "PENDING" | "ACCEPTED" = "PENDING"): Friendship =>
	Friendship.reconstitute({
		id,
		followerId: REQUESTER,
		followingId: ME,
		status,
		sortOrder: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

describe("RejectFriendRequestUseCase — 친구 요청 거절", () => {
	let useCase: RejectFriendRequestUseCase;
	let repo: Mocked<FollowRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(RejectFriendRequestUseCase)
			.mock<FollowRepositoryPort>(FOLLOW_REPOSITORY)
			.impl(() => createFollowRepositoryMock())
			.compile();
		useCase = unit;
		repo = unitRef.get<FollowRepositoryPort>(FOLLOW_REPOSITORY);
	});

	it("받은 PENDING 요청이 없으면 FOLLOW_0903, 삭제하지 않는다", async () => {
		// Given
		repo.findByFollowerAndFollowing.mockResolvedValue(null);

		// When / Then
		await expect(useCase.execute({ userId: ME, requesterUserId: REQUESTER })).rejects.toMatchObject(
			{ errorCode: "FOLLOW_0903" },
		);
		expect(repo.delete).not.toHaveBeenCalled();
	});

	it("요청이 PENDING이 아니면(이미 ACCEPTED) FOLLOW_0903", async () => {
		// Given
		repo.findByFollowerAndFollowing.mockResolvedValue(friendship("req-1", "ACCEPTED"));

		// When / Then
		await expect(useCase.execute({ userId: ME, requesterUserId: REQUESTER })).rejects.toMatchObject(
			{ errorCode: "FOLLOW_0903" },
		);
		expect(repo.delete).not.toHaveBeenCalled();
	});

	it("PENDING 요청은 삭제한다", async () => {
		// Given
		repo.findByFollowerAndFollowing.mockResolvedValue(friendship("req-1"));

		// When
		await useCase.execute({ userId: ME, requesterUserId: REQUESTER });

		// Then
		expect(repo.findByFollowerAndFollowing).toHaveBeenCalledWith(REQUESTER, ME);
		expect(repo.delete).toHaveBeenCalledWith("req-1");
	});
});
