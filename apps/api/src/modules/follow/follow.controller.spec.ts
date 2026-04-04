/**
 * FollowController 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - Suites: TestBed.solitary()로 자동 Mock 생성
 * - GWT: Given/When/Then 주석으로 테스트 구조화
 *
 * @see https://docs.nestjs.com/recipes/suites
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "@/modules/auth/decorators";

import type {
	GetFollowsQueryDto,
	GetFriendsQueryDto,
	UserIdParamDto,
	UserTagParamDto,
} from "./dtos";
import { FollowController } from "./follow.controller";
import { FollowMapper } from "./follow.mapper";
import { FollowService } from "./follow.service";
import type {
	FollowWithUser,
	SendFollowRequestResult,
} from "./types/follow.types";

describe("FollowController — 팔로우 컨트롤러", () => {
	let controller: FollowController;
	let mockFollowService: Mocked<FollowService>;

	const mockUser: CurrentUserPayload = {
		userId: "user-123",
		email: "test@example.com",
		sessionId: "session-123",
		role: "USER",
	};

	const mockFollowWithUser: FollowWithUser = {
		id: "follow-1",
		followerId: "user-123",
		followingId: "user-456",
		status: "ACCEPTED",
		sortOrder: 0,
		createdAt: new Date("2026-03-01T10:00:00Z"),
		updatedAt: new Date("2026-03-01T10:00:00Z"),
		follower: {
			id: "user-123",
			userTag: "USER1234",
			profile: { name: "나", profileImage: null },
		},
		following: {
			id: "user-456",
			userTag: "FRND5678",
			profile: { name: "친구", profileImage: null },
		},
	};

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(FollowController).compile();

		controller = unit;
		mockFollowService = unitRef.get(FollowService);
	});

	describe("sendRequest", () => {
		it("친구 요청 보내기를 서비스에 위임하고 매핑된 결과를 반환해야 한다", async () => {
			// Given -친구 요청 보내기 파라미터와 서비스 응답이 준비되었을 때
			const params = { userTag: "FRND5678" } as unknown as UserTagParamDto;
			const serviceResult: SendFollowRequestResult = {
				follow: {
					id: "follow-2",
					followerId: "user-123",
					followingId: "user-456",
					status: "PENDING",
					sortOrder: 0,
					createdAt: new Date("2026-03-01T10:00:00Z"),
					updatedAt: new Date("2026-03-01T10:00:00Z"),
				},
				autoAccepted: false,
			};
			mockFollowService.sendRequestByTag.mockResolvedValue(serviceResult);

			// When -sendRequest를 호출하면
			const result = await controller.sendRequest(mockUser, params);

			// Then -서비스에 userId와 userTag를 전달하고 매핑된 결과를 반환해야 한다
			expect(mockFollowService.sendRequestByTag).toHaveBeenCalledWith(
				mockUser.userId,
				params.userTag,
			);
			expect(result).toEqual({
				message: "친구 요청을 보냈습니다.",
				follow: FollowMapper.toResponse(serviceResult.follow),
				autoAccepted: false,
			});
		});

		it("자동 수락된 경우 적절한 메시지를 반환해야 한다", async () => {
			// Given -상대방이 이미 요청을 보내 자동 수락되는 경우
			const params = { userTag: "FRND5678" } as unknown as UserTagParamDto;
			const serviceResult: SendFollowRequestResult = {
				follow: {
					id: "follow-3",
					followerId: "user-123",
					followingId: "user-456",
					status: "ACCEPTED",
					sortOrder: 0,
					createdAt: new Date("2026-03-01T10:00:00Z"),
					updatedAt: new Date("2026-03-01T10:00:00Z"),
				},
				autoAccepted: true,
			};
			mockFollowService.sendRequestByTag.mockResolvedValue(serviceResult);

			// When -sendRequest를 호출하면
			const result = await controller.sendRequest(mockUser, params);

			// Then -자동 수락 메시지가 반환되어야 한다
			expect(result.message).toBe("친구가 되었습니다.");
			expect(result.autoAccepted).toBe(true);
		});
	});

	describe("acceptRequest", () => {
		it("친구 요청 수락을 서비스에 위임하고 매핑된 결과를 반환해야 한다", async () => {
			// Given -수락할 친구 요청의 사용자 ID가 있을 때
			const params = { userId: "user-456" } as unknown as UserIdParamDto;
			mockFollowService.acceptRequest.mockResolvedValue(mockFollowWithUser);

			// When -acceptRequest를 호출하면
			const result = await controller.acceptRequest(mockUser, params);

			// Then -서비스에 userId와 상대방 userId를 전달하고 매핑된 결과를 반환해야 한다
			expect(mockFollowService.acceptRequest).toHaveBeenCalledWith(
				mockUser.userId,
				params.userId,
			);
			expect(result).toEqual({
				message: "친구 요청을 수락했습니다.",
				friend: FollowMapper.toFriendUser(mockFollowWithUser),
			});
		});
	});

	describe("rejectRequest", () => {
		it("친구 요청 거절을 서비스에 위임하고 메시지를 반환해야 한다", async () => {
			// Given -거절할 친구 요청의 사용자 ID가 있을 때
			const params = { userId: "user-456" } as unknown as UserIdParamDto;
			mockFollowService.rejectRequest.mockResolvedValue(undefined);

			// When -rejectRequest를 호출하면
			const result = await controller.rejectRequest(mockUser, params);

			// Then -서비스에 userId와 상대방 userId를 전달하고 메시지를 반환해야 한다
			expect(mockFollowService.rejectRequest).toHaveBeenCalledWith(
				mockUser.userId,
				params.userId,
			);
			expect(result).toEqual({
				message: "친구 요청을 거절했습니다.",
			});
		});
	});

	describe("remove", () => {
		it("친구 삭제/요청 철회를 서비스에 위임하고 메시지를 반환해야 한다", async () => {
			// Given -삭제할 친구의 사용자 ID가 있을 때
			const params = { userId: "user-456" } as unknown as UserIdParamDto;
			mockFollowService.remove.mockResolvedValue(undefined);

			// When -remove를 호출하면
			const result = await controller.remove(mockUser, params);

			// Then -서비스에 userId와 상대방 userId를 전달하고 메시지를 반환해야 한다
			expect(mockFollowService.remove).toHaveBeenCalledWith(
				mockUser.userId,
				params.userId,
			);
			expect(result).toEqual({
				message: "친구를 삭제했습니다.",
			});
		});
	});

	describe("getResourceLimit", () => {
		it("친구 리소스 제한 정보 조회를 서비스에 위임하고 결과를 반환해야 한다", async () => {
			// Given -리소스 제한 정보 서비스 응답이 준비되었을 때
			const resourceLimit = { friendCount: 5, maxCount: 50 };
			mockFollowService.getResourceLimitInfo.mockResolvedValue(resourceLimit);

			// When -getResourceLimit를 호출하면
			const result = await controller.getResourceLimit(mockUser);

			// Then -서비스에 userId를 전달하고 결과를 반환해야 한다
			expect(mockFollowService.getResourceLimitInfo).toHaveBeenCalledWith(
				mockUser.userId,
			);
			expect(result).toEqual({ friendCount: 5, maxCount: 50 });
		});
	});

	describe("getFriends", () => {
		it("친구 목록 조회를 서비스에 위임하고 매핑된 결과를 반환해야 한다", async () => {
			// Given -친구 목록 조회 쿼리와 서비스 응답이 준비되었을 때
			const query = {
				limit: 20,
				cursor: undefined,
				search: undefined,
			} as unknown as GetFriendsQueryDto;
			const items = [mockFollowWithUser];
			const serviceResult = {
				items,
				pagination: { hasNext: false, nextCursor: null, size: 20 },
			};
			mockFollowService.getFriends.mockResolvedValue(serviceResult);
			mockFollowService.countFriends.mockResolvedValue(1);

			// When -getFriends를 호출하면
			const result = await controller.getFriends(mockUser, query);

			// Then -서비스에 올바른 파라미터를 전달하고 매핑된 결과를 반환해야 한다
			expect(mockFollowService.getFriends).toHaveBeenCalledWith({
				userId: mockUser.userId,
				cursor: query.cursor,
				size: query.limit,
				search: query.search,
			});
			expect(mockFollowService.countFriends).toHaveBeenCalledWith(
				mockUser.userId,
			);
			expect(result).toEqual({
				friends: items.map(FollowMapper.toFriendUser),
				totalCount: 1,
				hasMore: false,
			});
		});
	});

	describe("getReceivedRequests", () => {
		it("받은 친구 요청 목록 조회를 서비스에 위임하고 매핑된 결과를 반환해야 한다", async () => {
			// Given -받은 친구 요청 목록 조회 쿼리와 서비스 응답이 준비되었을 때
			const query = {
				limit: 20,
				cursor: undefined,
			} as unknown as GetFollowsQueryDto;
			const pendingFollow: FollowWithUser = {
				...mockFollowWithUser,
				status: "PENDING",
			};
			const items = [pendingFollow];
			const serviceResult = {
				items,
				pagination: { hasNext: false, nextCursor: null, size: 20 },
			};
			mockFollowService.getReceivedRequests.mockResolvedValue(serviceResult);
			mockFollowService.countReceivedRequests.mockResolvedValue(1);

			// When -getReceivedRequests를 호출하면
			const result = await controller.getReceivedRequests(mockUser, query);

			// Then -서비스에 올바른 파라미터를 전달하고 매핑된 결과를 반환해야 한다
			expect(mockFollowService.getReceivedRequests).toHaveBeenCalledWith({
				userId: mockUser.userId,
				cursor: query.cursor,
				size: query.limit,
			});
			expect(mockFollowService.countReceivedRequests).toHaveBeenCalledWith(
				mockUser.userId,
			);
			expect(result).toEqual({
				requests: items.map(FollowMapper.toReceivedRequest),
				totalCount: 1,
				hasMore: false,
			});
		});
	});

	describe("getSentRequests", () => {
		it("보낸 친구 요청 목록 조회를 서비스에 위임하고 매핑된 결과를 반환해야 한다", async () => {
			// Given -보낸 친구 요청 목록 조회 쿼리와 서비스 응답이 준비되었을 때
			const query = {
				limit: 20,
				cursor: undefined,
			} as unknown as GetFollowsQueryDto;
			const pendingFollow: FollowWithUser = {
				...mockFollowWithUser,
				status: "PENDING",
			};
			const items = [pendingFollow];
			const serviceResult = {
				items,
				pagination: { hasNext: true, nextCursor: "cursor-1", size: 20 },
			};
			mockFollowService.getSentRequests.mockResolvedValue(serviceResult);
			mockFollowService.countSentRequests.mockResolvedValue(25);

			// When -getSentRequests를 호출하면
			const result = await controller.getSentRequests(mockUser, query);

			// Then -서비스에 올바른 파라미터를 전달하고 매핑된 결과를 반환해야 한다
			expect(mockFollowService.getSentRequests).toHaveBeenCalledWith({
				userId: mockUser.userId,
				cursor: query.cursor,
				size: query.limit,
			});
			expect(mockFollowService.countSentRequests).toHaveBeenCalledWith(
				mockUser.userId,
			);
			expect(result).toEqual({
				requests: items.map(FollowMapper.toSentRequest),
				totalCount: 25,
				hasMore: true,
			});
		});
	});

	describe("reorderFriend", () => {
		it("친구 순서 변경을 서비스에 위임하고 매핑된 결과를 반환해야 한다", async () => {
			// Given - 순서 변경 파라미터와 서비스 응답이 준비되었을 때
			const dto = { targetFollowId: "follow-2", position: "after" as const };
			mockFollowService.reorder.mockResolvedValue(mockFollowWithUser);

			// When - reorderFriend를 호출하면
			const result = await controller.reorderFriend(mockUser, "follow-1", dto);

			// Then - 서비스에 올바른 파라미터를 전달하고 매핑된 결과를 반환해야 한다
			expect(mockFollowService.reorder).toHaveBeenCalledWith(
				"follow-1",
				mockUser.userId,
				dto,
			);
			expect(result).toEqual({
				message: "친구 순서가 변경되었습니다.",
				friend: FollowMapper.toFriendUser(mockFollowWithUser),
			});
		});
	});
});
