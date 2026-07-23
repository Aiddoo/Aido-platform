/**
 * AcceptFriendRequestUseCase 단위 테스트 (Suites solitary + 포트 모킹).
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createUnitOfWorkMock } from "@test/mocks/ports";
import { createFollowRepositoryMock } from "@test/mocks/ports/follow.mock";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { Friendship } from "../../../domain/entities/friendship.entity";
import {
	FOLLOW_REPOSITORY,
	type FollowRepositoryPort,
	type FollowWithUser,
} from "../../ports/follow.repository.port";
import { FriendshipEffects } from "../../services/friendship-effects.service";
import { AcceptFriendRequestUseCase } from "./accept-friend-request.use-case";

const ME = "u-me";
const REQUESTER = "u-req";

const friendship = (
	id: string,
	followerId: string,
	followingId: string,
	status: "PENDING" | "ACCEPTED" = "PENDING",
): Friendship =>
	Friendship.reconstitute({
		id,
		followerId,
		followingId,
		status,
		sortOrder: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

const withUser = (id: string): FollowWithUser => ({
	id,
	followerId: ME,
	followingId: REQUESTER,
	status: "ACCEPTED",
	sortOrder: 1,
	createdAt: new Date(),
	updatedAt: new Date(),
	follower: {
		id: ME,
		userTag: "MEMEME12",
		profile: { name: "나", profileImage: null },
	},
	following: {
		id: REQUESTER,
		userTag: "REQ12345",
		profile: { name: "상대", profileImage: null },
	},
});

describe("AcceptFriendRequestUseCase — 친구 요청 수락", () => {
	let useCase: AcceptFriendRequestUseCase;
	let repo: Mocked<FollowRepositoryPort>;
	let uow: Mocked<UnitOfWorkPort>;
	let effects: Mocked<FriendshipEffects>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(AcceptFriendRequestUseCase)
			.mock<FollowRepositoryPort>(FOLLOW_REPOSITORY)
			.impl(() => createFollowRepositoryMock())
			.mock<UnitOfWorkPort>(UNIT_OF_WORK)
			.impl(() => createUnitOfWorkMock())
			.compile();
		useCase = unit;
		repo = unitRef.get<FollowRepositoryPort>(FOLLOW_REPOSITORY);
		uow = unitRef.get<UnitOfWorkPort>(UNIT_OF_WORK);
		effects = unitRef.get(FriendshipEffects);

		repo.getMaxSortOrderForFriends.mockResolvedValue(0);
	});

	it("받은 PENDING 요청이 없으면 FOLLOW_0903, 트랜잭션 미실행", async () => {
		// Given
		repo.findByFollowerAndFollowing.mockResolvedValue(null);

		// When / Then
		await expect(
			useCase.execute({ userId: ME, requesterUserId: REQUESTER }),
		).rejects.toMatchObject({ errorCode: "FOLLOW_0903" });
		expect(uow.run).not.toHaveBeenCalled();
	});

	it("요청이 PENDING이 아니면(이미 ACCEPTED) FOLLOW_0903", async () => {
		// Given
		repo.findByFollowerAndFollowing.mockResolvedValue(
			friendship("req-1", REQUESTER, ME, "ACCEPTED"),
		);

		// When / Then
		await expect(
			useCase.execute({ userId: ME, requesterUserId: REQUESTER }),
		).rejects.toMatchObject({ errorCode: "FOLLOW_0903" });
	});

	it("수락 성공: 요청 ACCEPTED 갱신 + 역방향 생성 + 맞팔 알림/캐시 무효화", async () => {
		// Given
		repo.findByFollowerAndFollowing
			.mockResolvedValueOnce(friendship("req-1", REQUESTER, ME)) // 받은 PENDING 요청
			.mockResolvedValueOnce(null); // 역방향 관계 없음 → create
		repo.create.mockResolvedValue(
			friendship("rev-1", ME, REQUESTER, "ACCEPTED"),
		);
		repo.findByIdWithUser.mockResolvedValue(withUser("rev-1"));

		// When
		const result = await useCase.execute({
			userId: ME,
			requesterUserId: REQUESTER,
		});

		// Then
		expect(repo.update).toHaveBeenCalledWith(
			"req-1",
			expect.objectContaining({ status: "ACCEPTED" }),
		);
		expect(repo.create).toHaveBeenCalledWith(
			expect.objectContaining({
				followerId: ME,
				followingId: REQUESTER,
				status: "ACCEPTED",
			}),
		);
		expect(effects.invalidateFriendshipCaches).toHaveBeenCalledWith(
			ME,
			REQUESTER,
		);
		expect(effects.notifyMutual).toHaveBeenCalledTimes(2);
		expect(effects.checkFirstFriendMilestone).toHaveBeenCalledWith(ME);
		expect(effects.checkFirstFriendMilestone).toHaveBeenCalledWith(REQUESTER);
		expect(result.id).toBe("rev-1");
	});

	it("역방향 관계가 이미 있으면 create 대신 update로 ACCEPTED 전환", async () => {
		// Given
		repo.findByFollowerAndFollowing
			.mockResolvedValueOnce(friendship("req-1", REQUESTER, ME)) // 받은 PENDING
			.mockResolvedValueOnce(friendship("rev-old", ME, REQUESTER, "PENDING")); // 역방향 존재
		repo.update.mockResolvedValue(
			friendship("rev-old", ME, REQUESTER, "ACCEPTED"),
		);
		repo.findByIdWithUser.mockResolvedValue(withUser("rev-old"));

		// When
		await useCase.execute({ userId: ME, requesterUserId: REQUESTER });

		// Then
		expect(repo.create).not.toHaveBeenCalled();
		expect(repo.update).toHaveBeenCalledTimes(2); // 요청 + 역방향
	});

	it("부수효과(캐시 무효화)는 트랜잭션 커밋 이후 수행된다", async () => {
		// Given
		repo.findByFollowerAndFollowing
			.mockResolvedValueOnce(friendship("req-1", REQUESTER, ME))
			.mockResolvedValueOnce(null);
		repo.create.mockResolvedValue(
			friendship("rev-1", ME, REQUESTER, "ACCEPTED"),
		);
		repo.findByIdWithUser.mockResolvedValue(withUser("rev-1"));

		// When
		await useCase.execute({ userId: ME, requesterUserId: REQUESTER });

		// Then
		const runOrder = uow.run.mock.invocationCallOrder[0] ?? 0;
		const invalidateOrder =
			effects.invalidateFriendshipCaches.mock.invocationCallOrder[0] ?? 0;
		expect(invalidateOrder).toBeGreaterThan(runOrder);
	});

	it("생성된 팔로우의 사용자 정보 조회 실패 시 SYS_0001", async () => {
		// Given
		repo.findByFollowerAndFollowing
			.mockResolvedValueOnce(friendship("req-1", REQUESTER, ME))
			.mockResolvedValueOnce(null);
		repo.create.mockResolvedValue(
			friendship("rev-1", ME, REQUESTER, "ACCEPTED"),
		);
		repo.findByIdWithUser.mockResolvedValue(null);

		// When / Then
		await expect(
			useCase.execute({ userId: ME, requesterUserId: REQUESTER }),
		).rejects.toMatchObject({ errorCode: "SYS_0001" });
	});
});
