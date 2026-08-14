/**
 * FollowController 단위 테스트 (Suites + GWT).
 * 컨트롤러가 endpoint UseCase에 위임하고, FollowMapper로 응답을 구성하는지 검증한다.
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "@/auth/presentation/decorators";
import type { FollowWithUser } from "../application/ports/follow.repository.port";
import { FollowReader } from "../application/services/follow.reader";
import { AcceptFriendRequestUseCase } from "../application/use-cases/accept-friend-request/accept-friend-request.use-case";
import { RejectFriendRequestUseCase } from "../application/use-cases/reject-friend-request/reject-friend-request.use-case";
import { RemoveFriendUseCase } from "../application/use-cases/remove-friend/remove-friend.use-case";
import { ReorderFriendUseCase } from "../application/use-cases/reorder-friend/reorder-friend.use-case";
import { SendFriendRequestByTagUseCase } from "../application/use-cases/send-friend-request-by-tag/send-friend-request-by-tag.use-case";
import { Friendship } from "../domain/entities/friendship.aggregate";
import type {
	GetFollowsQueryDto,
	GetFriendsQueryDto,
	ReorderFriendDto,
	UserTagParamDto,
} from "./dtos";
import { FollowController } from "./follow.controller";

const user: CurrentUserPayload = {
	userId: "user-123",
	email: "test@example.com",
	sessionId: "session-123",
	role: "USER",
};

const record = Friendship.reconstitute({
	id: "follow-1",
	followerId: "user-123",
	followingId: "user-456",
	status: "PENDING",
	sortOrder: 0,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	updatedAt: new Date("2026-01-01T00:00:00.000Z"),
});

const withUser: FollowWithUser = {
	id: "follow-1",
	followerId: "user-123",
	followingId: "user-456",
	status: "ACCEPTED",
	sortOrder: 0,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	updatedAt: new Date("2026-01-01T00:00:00.000Z"),
	follower: { id: "user-123", userTag: "MYTAG123", profile: null },
	following: {
		id: "user-456",
		userTag: "TGT67890",
		profile: { name: "Target", profileImage: null },
	},
};

describe("FollowController", () => {
	let controller: FollowController;
	let followReader: Mocked<FollowReader>;
	let sendByTagUseCase: Mocked<SendFriendRequestByTagUseCase>;
	let acceptUseCase: Mocked<AcceptFriendRequestUseCase>;
	let rejectUseCase: Mocked<RejectFriendRequestUseCase>;
	let removeUseCase: Mocked<RemoveFriendUseCase>;
	let reorderUseCase: Mocked<ReorderFriendUseCase>;

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(FollowController).compile();
		controller = unit;
		followReader = unitRef.get(FollowReader);
		sendByTagUseCase = unitRef.get(SendFriendRequestByTagUseCase);
		acceptUseCase = unitRef.get(AcceptFriendRequestUseCase);
		rejectUseCase = unitRef.get(RejectFriendRequestUseCase);
		removeUseCase = unitRef.get(RemoveFriendUseCase);
		reorderUseCase = unitRef.get(ReorderFriendUseCase);
	});

	describe("sendRequest", () => {
		it("태그로 요청을 위임하고 메시지/응답을 구성한다", async () => {
			sendByTagUseCase.execute.mockResolvedValue({
				follow: record,
				autoAccepted: false,
			});
			const params = { userTag: "TGT67890" } as UserTagParamDto;

			const result = await controller.sendRequest(user, params);

			expect(sendByTagUseCase.execute).toHaveBeenCalledWith({
				userId: user.userId,
				targetUserTag: "TGT67890",
			});
			expect(result.autoAccepted).toBe(false);
			expect(result.message).toBe("친구 요청을 보냈습니다.");
			expect(result.follow.id).toBe("follow-1");
		});

		it("자동 수락이면 메시지가 다르다", async () => {
			sendByTagUseCase.execute.mockResolvedValue({
				follow: record,
				autoAccepted: true,
			});
			const params = { userTag: "TGT67890" } as UserTagParamDto;

			const result = await controller.sendRequest(user, params);

			expect(result.autoAccepted).toBe(true);
			expect(result.message).toBe("친구가 되었습니다.");
		});
	});

	describe("acceptRequest", () => {
		it("수락을 위임하고 friend를 매핑한다", async () => {
			acceptUseCase.execute.mockResolvedValue(withUser);

			const result = await controller.acceptRequest(user, {
				userId: "user-456",
			});

			expect(acceptUseCase.execute).toHaveBeenCalledWith({
				userId: user.userId,
				requesterUserId: "user-456",
			});
			expect(result.message).toBe("친구 요청을 수락했습니다.");
			expect(result.friend.id).toBe("user-456");
		});
	});

	describe("rejectRequest", () => {
		it("거절을 위임한다", async () => {
			rejectUseCase.execute.mockResolvedValue(undefined);

			const result = await controller.rejectRequest(user, {
				userId: "user-456",
			});

			expect(rejectUseCase.execute).toHaveBeenCalledWith({
				userId: user.userId,
				requesterUserId: "user-456",
			});
			expect(result.message).toBe("친구 요청을 거절했습니다.");
		});
	});

	describe("remove", () => {
		it("삭제를 위임한다", async () => {
			removeUseCase.execute.mockResolvedValue(undefined);

			const result = await controller.remove(user, { userId: "user-456" });

			expect(removeUseCase.execute).toHaveBeenCalledWith({
				userId: user.userId,
				targetUserId: "user-456",
			});
			expect(result.message).toBe("친구를 삭제했습니다.");
		});
	});

	describe("reorderFriend", () => {
		it("순서 변경을 위임하고 friend를 매핑한다", async () => {
			reorderUseCase.execute.mockResolvedValue(withUser);
			const dto = {
				targetFollowId: "follow-2",
				position: "before",
			} as ReorderFriendDto;

			const result = await controller.reorderFriend(user, "follow-1", dto);

			expect(reorderUseCase.execute).toHaveBeenCalledWith({
				followId: "follow-1",
				userId: user.userId,
				targetFollowId: dto.targetFollowId,
				position: dto.position,
			});
			expect(result.message).toBe("친구 순서가 변경되었습니다.");
			expect(result.friend.followId).toBe("follow-1");
		});
	});

	describe("getResourceLimit", () => {
		it("리소스 제한을 위임한다", async () => {
			followReader.getResourceLimitInfo.mockResolvedValue({
				friendCount: 3,
				maxCount: 50,
			});

			const result = await controller.getResourceLimit(user);

			expect(followReader.getResourceLimitInfo).toHaveBeenCalledWith(
				user.userId,
			);
			expect(result).toEqual({ friendCount: 3, maxCount: 50 });
		});
	});

	describe("getFriends", () => {
		it("목록과 총 개수를 병렬 조회하고 매핑한다", async () => {
			followReader.getFriends.mockResolvedValue({
				items: [withUser],
				pagination: { hasNext: true, nextCursor: "c", size: 20 },
			});
			followReader.countFriends.mockResolvedValue(7);
			const query = {
				cursor: undefined,
				limit: 20,
				search: undefined,
			} as unknown as GetFriendsQueryDto;

			const result = await controller.getFriends(user, query);

			expect(followReader.getFriends).toHaveBeenCalledWith({
				userId: user.userId,
				cursor: undefined,
				size: 20,
				search: undefined,
			});
			expect(result.totalCount).toBe(7);
			expect(result.hasMore).toBe(true);
			expect(result.friends).toHaveLength(1);
			expect(result.friends[0]?.id).toBe("user-456");
		});
	});

	describe("getReceivedRequests", () => {
		it("받은 요청을 매핑한다", async () => {
			followReader.getReceivedRequests.mockResolvedValue({
				items: [withUser],
				pagination: { hasNext: false, nextCursor: null, size: 20 },
			});
			followReader.countReceivedRequests.mockResolvedValue(1);
			const query = {
				cursor: undefined,
				limit: 20,
			} as unknown as GetFollowsQueryDto;

			const result = await controller.getReceivedRequests(user, query);

			expect(result.totalCount).toBe(1);
			expect(result.requests[0]?.id).toBe("user-123");
		});
	});

	describe("getSentRequests", () => {
		it("보낸 요청을 매핑한다", async () => {
			followReader.getSentRequests.mockResolvedValue({
				items: [withUser],
				pagination: { hasNext: false, nextCursor: null, size: 20 },
			});
			followReader.countSentRequests.mockResolvedValue(1);
			const query = {
				cursor: undefined,
				limit: 20,
			} as unknown as GetFollowsQueryDto;

			const result = await controller.getSentRequests(user, query);

			expect(result.totalCount).toBe(1);
			expect(result.requests[0]?.id).toBe("user-456");
		});
	});
});
