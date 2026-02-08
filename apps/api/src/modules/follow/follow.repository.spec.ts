/**
 * FollowRepository 단위 테스트
 *
 * Suites + Builder + GWT 패턴 적용
 * - Suites: 자동 Mock 생성
 * - Builder: FollowBuilder로 테스트 데이터 생성
 * - GWT: Given/When/Then 주석
 *
 * @see https://docs.nestjs.com/recipes/suites
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { FollowBuilder } from "@test/builders";
import { DatabaseService } from "@/database/database.service";

import { FollowRepository } from "./follow.repository";
import type { FindFollowsParams } from "./types/follow.types";

// =============================================================================
// Test Suite
// =============================================================================

describe("FollowRepository", () => {
	let repository: FollowRepository;
	let db: Mocked<DatabaseService>;

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(FollowRepository).compile();

		repository = unit;
		db = unitRef.get(DatabaseService) as unknown as Mocked<DatabaseService>;
	});

	// ==========================================================================
	// findMutualFriends
	// ==========================================================================

	describe("findMutualFriends", () => {
		it("맞팔 친구 목록을 조회해야 한다", async () => {
			// Given
			const params: FindFollowsParams = {
				userId: "user-1",
				size: 10,
			};
			const follows = [
				FollowBuilder.create("user-1", "friend-1").accepted().buildWithUser(),
			];
			(db.follow.findMany as jest.Mock).mockResolvedValue(follows);

			// When
			const result = await repository.findMutualFriends(params);

			// Then
			expect(db.follow.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					take: 11,
					orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				}),
			);
			expect(result).toEqual(follows);
		});

		it("커서 기반 페이지네이션을 적용해야 한다", async () => {
			// Given
			const params: FindFollowsParams = {
				userId: "user-1",
				cursor: "follow-abc",
				size: 10,
			};
			(db.follow.findMany as jest.Mock).mockResolvedValue([]);

			// When
			await repository.findMutualFriends(params);

			// Then
			expect(db.follow.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					take: 11,
					skip: 1,
					cursor: { id: "follow-abc" },
					orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				}),
			);
		});

		it("검색어로 필터링해야 한다", async () => {
			// Given
			const params: FindFollowsParams = {
				userId: "user-1",
				size: 10,
				search: "test",
			};
			(db.follow.findMany as jest.Mock).mockResolvedValue([]);

			// When
			await repository.findMutualFriends(params);

			// Then
			expect(db.follow.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						following: expect.objectContaining({
							userTag: { contains: "test", mode: "insensitive" },
						}),
					}),
				}),
			);
		});

		it("동일한 createdAt인 Follow가 id 기준으로 정렬된다", async () => {
			// Given - orderBy가 복합키 [createdAt desc, id desc]로 설정되어야 함
			const params: FindFollowsParams = {
				userId: "user-1",
				size: 10,
			};
			(db.follow.findMany as jest.Mock).mockResolvedValue([]);

			// When
			await repository.findMutualFriends(params);

			// Then - orderBy가 복합키 배열인지 검증
			const callArgs = (db.follow.findMany as jest.Mock).mock.calls[0]?.[0];
			expect(callArgs?.orderBy).toEqual([
				{ createdAt: "desc" },
				{ id: "desc" },
			]);
		});
	});

	// ==========================================================================
	// findReceivedRequests
	// ==========================================================================

	describe("findReceivedRequests", () => {
		it("받은 친구 요청 목록을 조회해야 한다", async () => {
			// Given
			const params: FindFollowsParams = {
				userId: "user-1",
				size: 10,
			};
			const follows = [
				FollowBuilder.create("other-1", "user-1").pending().buildWithUser(),
			];
			(db.follow.findMany as jest.Mock).mockResolvedValue(follows);

			// When
			const result = await repository.findReceivedRequests(params);

			// Then
			expect(db.follow.findMany).toHaveBeenCalledWith({
				where: {
					followingId: "user-1",
					status: "PENDING",
				},
				include: expect.any(Object),
				take: 11,
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			});
			expect(result).toEqual(follows);
		});

		it("커서 기반 페이지네이션을 적용해야 한다", async () => {
			// Given
			const params: FindFollowsParams = {
				userId: "user-1",
				cursor: "follow-xyz",
				size: 10,
			};
			(db.follow.findMany as jest.Mock).mockResolvedValue([]);

			// When
			await repository.findReceivedRequests(params);

			// Then
			expect(db.follow.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					take: 11,
					skip: 1,
					cursor: { id: "follow-xyz" },
					orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				}),
			);
		});

		it("동일한 createdAt인 Follow가 id 기준으로 정렬된다", async () => {
			// Given
			const params: FindFollowsParams = {
				userId: "user-1",
				size: 10,
			};
			(db.follow.findMany as jest.Mock).mockResolvedValue([]);

			// When
			await repository.findReceivedRequests(params);

			// Then
			const callArgs = (db.follow.findMany as jest.Mock).mock.calls[0]?.[0];
			expect(callArgs?.orderBy).toEqual([
				{ createdAt: "desc" },
				{ id: "desc" },
			]);
		});
	});

	// ==========================================================================
	// findSentRequests
	// ==========================================================================

	describe("findSentRequests", () => {
		it("보낸 친구 요청 목록을 조회해야 한다", async () => {
			// Given
			const params: FindFollowsParams = {
				userId: "user-1",
				size: 10,
			};
			const follows = [
				FollowBuilder.create("user-1", "other-1").pending().buildWithUser(),
			];
			(db.follow.findMany as jest.Mock).mockResolvedValue(follows);

			// When
			const result = await repository.findSentRequests(params);

			// Then
			expect(db.follow.findMany).toHaveBeenCalledWith({
				where: {
					followerId: "user-1",
					status: "PENDING",
				},
				include: expect.any(Object),
				take: 11,
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			});
			expect(result).toEqual(follows);
		});

		it("커서 기반 페이지네이션을 적용해야 한다", async () => {
			// Given
			const params: FindFollowsParams = {
				userId: "user-1",
				cursor: "follow-abc",
				size: 10,
			};
			(db.follow.findMany as jest.Mock).mockResolvedValue([]);

			// When
			await repository.findSentRequests(params);

			// Then
			expect(db.follow.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					take: 11,
					skip: 1,
					cursor: { id: "follow-abc" },
					orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				}),
			);
		});

		it("동일한 createdAt인 Follow가 id 기준으로 정렬된다", async () => {
			// Given
			const params: FindFollowsParams = {
				userId: "user-1",
				size: 10,
			};
			(db.follow.findMany as jest.Mock).mockResolvedValue([]);

			// When
			await repository.findSentRequests(params);

			// Then
			const callArgs = (db.follow.findMany as jest.Mock).mock.calls[0]?.[0];
			expect(callArgs?.orderBy).toEqual([
				{ createdAt: "desc" },
				{ id: "desc" },
			]);
		});
	});
});
