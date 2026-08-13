/**
 * ReorderFriendUseCase 단위 테스트 (Suites solitary + 포트 모킹).
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { UNIT_OF_WORK } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import { Friendship } from "../../../domain/entities/friendship.aggregate";
import {
	FOLLOW_REPOSITORY,
	type FollowRepositoryPort,
	type FollowWithUser,
} from "../../ports/follow.repository.port";
import { ReorderFriendUseCase } from "./reorder-friend.use-case";

const accepted = (id: string, sortOrder: number): Friendship =>
	Friendship.reconstitute({
		id,
		followerId: "u1",
		followingId: `t-${id}`,
		status: "ACCEPTED",
		sortOrder,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

const withUser = (id: string): FollowWithUser => ({
	id,
	followerId: "u1",
	followingId: `t-${id}`,
	status: "ACCEPTED",
	sortOrder: 0,
	createdAt: new Date(),
	updatedAt: new Date(),
	follower: { id: "u1", userTag: "AAAA1111", profile: null },
	following: { id: `t-${id}`, userTag: "BBBB2222", profile: null },
});

describe("ReorderFriendUseCase", () => {
	let useCase: ReorderFriendUseCase;
	let repo: Mocked<FollowRepositoryPort>;
	let uow: Mocked<{ run: (fn: () => unknown) => unknown }>;

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(ReorderFriendUseCase).compile();
		useCase = unit;
		repo = unitRef.get(FOLLOW_REPOSITORY);
		uow = unitRef.get(UNIT_OF_WORK);
		uow.run.mockImplementation((fn: () => unknown) => fn());
	});

	it("대상 팔로우가 없으면 FOLLOW_0910", async () => {
		repo.findAcceptedByIdAndFollowerId.mockResolvedValue(null);
		await expect(
			useCase.execute({ followId: "f1", userId: "u1", position: "before" }),
		).rejects.toBeInstanceOf(ApplicationException);
	});

	it("자기 자신 기준이면 현재 상태 그대로 반환", async () => {
		repo.findAcceptedByIdAndFollowerId.mockResolvedValue(accepted("f1", 3));
		repo.findByIdWithUser.mockResolvedValue(withUser("f1"));

		const result = await useCase.execute({
			followId: "f1",
			userId: "u1",
			targetFollowId: "f1",
			position: "before",
		});

		expect(result.id).toBe("f1");
		expect(repo.shiftFriendSortOrders).not.toHaveBeenCalled();
	});

	it("기준 대상 앞으로 이동 시 시프트 후 업데이트", async () => {
		repo.findAcceptedByIdAndFollowerId
			.mockResolvedValueOnce(accepted("f1", 5)) // 이동 대상
			.mockResolvedValueOnce(accepted("f2", 2)); // 기준
		repo.updateFollowSortOrder.mockResolvedValue(withUser("f1"));

		await useCase.execute({
			followId: "f1",
			userId: "u1",
			targetFollowId: "f2",
			position: "before",
		});

		// current=5, target=2, before → newSortOrder=2, shift {2..4, +1}
		expect(repo.shiftFriendSortOrders).toHaveBeenCalledWith("u1", 2, 4, 1);
		expect(repo.updateFollowSortOrder).toHaveBeenCalledWith("f1", 2);
	});

	it("맨 뒤로 이동(edge, after)", async () => {
		repo.findAcceptedByIdAndFollowerId.mockResolvedValue(accepted("f1", 3));
		repo.getMaxSortOrderForFriends.mockResolvedValue(9);
		repo.updateFollowSortOrder.mockResolvedValue(withUser("f1"));

		await useCase.execute({ followId: "f1", userId: "u1", position: "after" });

		// current=3, after, max=9 → newSortOrder=9, shift {4..null, -1}
		expect(repo.shiftFriendSortOrders).toHaveBeenCalledWith("u1", 4, null, -1);
		expect(repo.updateFollowSortOrder).toHaveBeenCalledWith("f1", 9);
	});
});
