/**
 * RemoveFriendUseCase 단위 테스트 (Suites solitary + 포트 모킹).
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createUnitOfWorkMock } from "@test/mocks/ports";
import { createFollowRepositoryMock } from "@test/mocks/ports/follow.mock";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";

import { Friendship } from "../../../domain/entities/friendship.aggregate";
import { FOLLOW_REPOSITORY, type FollowRepositoryPort } from "../../ports/follow.repository.port";
import { FriendshipEffects } from "../../services/friendship-effects.service";
import { RemoveFriendUseCase } from "./remove-friend.use-case";

const ME = "u-me";
const TARGET = "u-target";

const friendship = (id: string, followerId: string, followingId: string): Friendship =>
	Friendship.reconstitute({
		id,
		followerId,
		followingId,
		status: "ACCEPTED",
		sortOrder: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

describe("RemoveFriendUseCase — 친구 삭제/요청 철회", () => {
	let useCase: RemoveFriendUseCase;
	let repo: Mocked<FollowRepositoryPort>;
	let uow: Mocked<UnitOfWorkPort>;
	let effects: Mocked<FriendshipEffects>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(RemoveFriendUseCase)
			.mock<FollowRepositoryPort>(FOLLOW_REPOSITORY)
			.impl(() => createFollowRepositoryMock())
			.mock<UnitOfWorkPort>(UNIT_OF_WORK)
			.impl(() => createUnitOfWorkMock())
			.compile();
		useCase = unit;
		repo = unitRef.get<FollowRepositoryPort>(FOLLOW_REPOSITORY);
		uow = unitRef.get<UnitOfWorkPort>(UNIT_OF_WORK);
		effects = unitRef.get(FriendshipEffects);
	});

	it("내 방향 관계가 없으면 FOLLOW_0907, 트랜잭션 미실행", async () => {
		// Given
		repo.findByFollowerAndFollowing.mockResolvedValue(null);

		// When / Then
		await expect(useCase.execute({ userId: ME, targetUserId: TARGET })).rejects.toMatchObject({
			errorCode: "FOLLOW_0907",
		});
		expect(uow.run).not.toHaveBeenCalled();
		expect(effects.invalidateFriendshipCaches).not.toHaveBeenCalled();
	});

	it("양방향 관계를 모두 삭제하고 캐시를 무효화한다", async () => {
		// Given
		repo.findByFollowerAndFollowing
			.mockResolvedValueOnce(friendship("my-1", ME, TARGET)) // 내 방향
			.mockResolvedValueOnce(friendship("their-1", TARGET, ME)); // 상대 방향

		// When
		await useCase.execute({ userId: ME, targetUserId: TARGET });

		// Then
		expect(repo.delete).toHaveBeenCalledWith("my-1");
		expect(repo.delete).toHaveBeenCalledWith("their-1");
		expect(repo.delete).toHaveBeenCalledTimes(2);
		expect(effects.invalidateFriendshipCaches).toHaveBeenCalledWith(ME, TARGET);
	});

	it("상대 방향 관계가 없으면 내 방향만 삭제한다", async () => {
		// Given
		repo.findByFollowerAndFollowing
			.mockResolvedValueOnce(friendship("my-1", ME, TARGET)) // 내 방향
			.mockResolvedValueOnce(null); // 상대 방향 없음

		// When
		await useCase.execute({ userId: ME, targetUserId: TARGET });

		// Then
		expect(repo.delete).toHaveBeenCalledWith("my-1");
		expect(repo.delete).toHaveBeenCalledTimes(1);
	});

	it("캐시 무효화는 트랜잭션 커밋 이후 수행된다", async () => {
		// Given
		repo.findByFollowerAndFollowing
			.mockResolvedValueOnce(friendship("my-1", ME, TARGET))
			.mockResolvedValueOnce(null);

		// When
		await useCase.execute({ userId: ME, targetUserId: TARGET });

		// Then
		const runOrder = uow.run.mock.invocationCallOrder[0] ?? 0;
		const invalidateOrder = effects.invalidateFriendshipCaches.mock.invocationCallOrder[0] ?? 0;
		expect(invalidateOrder).toBeGreaterThan(runOrder);
	});
});
