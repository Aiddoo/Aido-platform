/**
 * FollowController 단위 테스트 (Suites + GWT).
 * 컨트롤러가 FollowFacade에 위임하고, FollowMapper로 응답을 구성하는지 검증한다.
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "@/auth/decorators";
import { FollowFacade } from "../application/facades/follow.facade";
import type { FollowWithUser } from "../application/ports/follow.repository.port";
import { Friendship } from "../domain/entities/friendship.entity";
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
	let facade: Mocked<FollowFacade>;

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(FollowController).compile();
		controller = unit;
		facade = unitRef.get(FollowFacade);
	});

	describe("sendRequest", () => {
		it("태그로 요청을 위임하고 메시지/응답을 구성한다", async () => {
			facade.sendRequestByTag.mockResolvedValue({
				follow: record,
				autoAccepted: false,
			});
			const params = { userTag: "TGT67890" } as UserTagParamDto;

			const result = await controller.sendRequest(user, params);

			expect(facade.sendRequestByTag).toHaveBeenCalledWith(
				user.userId,
				"TGT67890",
			);
			expect(result.autoAccepted).toBe(false);
			expect(result.message).toBe("친구 요청을 보냈습니다.");
			expect(result.follow.id).toBe("follow-1");
		});

		it("자동 수락이면 메시지가 다르다", async () => {
			facade.sendRequestByTag.mockResolvedValue({
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
			facade.acceptRequest.mockResolvedValue(withUser);

			const result = await controller.acceptRequest(user, {
				userId: "user-456",
			});

			expect(facade.acceptRequest).toHaveBeenCalledWith(
				user.userId,
				"user-456",
			);
			expect(result.message).toBe("친구 요청을 수락했습니다.");
			expect(result.friend.id).toBe("user-456");
		});
	});

	describe("rejectRequest", () => {
		it("거절을 위임한다", async () => {
			facade.rejectRequest.mockResolvedValue(undefined);

			const result = await controller.rejectRequest(user, {
				userId: "user-456",
			});

			expect(facade.rejectRequest).toHaveBeenCalledWith(
				user.userId,
				"user-456",
			);
			expect(result.message).toBe("친구 요청을 거절했습니다.");
		});
	});

	describe("remove", () => {
		it("삭제를 위임한다", async () => {
			facade.remove.mockResolvedValue(undefined);

			const result = await controller.remove(user, { userId: "user-456" });

			expect(facade.remove).toHaveBeenCalledWith(user.userId, "user-456");
			expect(result.message).toBe("친구를 삭제했습니다.");
		});
	});

	describe("reorderFriend", () => {
		it("순서 변경을 위임하고 friend를 매핑한다", async () => {
			facade.reorder.mockResolvedValue(withUser);
			const dto = {
				targetFollowId: "follow-2",
				position: "before",
			} as ReorderFriendDto;

			const result = await controller.reorderFriend(user, "follow-1", dto);

			expect(facade.reorder).toHaveBeenCalledWith("follow-1", user.userId, dto);
			expect(result.message).toBe("친구 순서가 변경되었습니다.");
			expect(result.friend.followId).toBe("follow-1");
		});
	});

	describe("getResourceLimit", () => {
		it("리소스 제한을 위임한다", async () => {
			facade.getResourceLimitInfo.mockResolvedValue({
				friendCount: 3,
				maxCount: 50,
			});

			const result = await controller.getResourceLimit(user);

			expect(facade.getResourceLimitInfo).toHaveBeenCalledWith(user.userId);
			expect(result).toEqual({ friendCount: 3, maxCount: 50 });
		});
	});

	describe("getFriends", () => {
		it("목록과 총 개수를 병렬 조회하고 매핑한다", async () => {
			facade.getFriends.mockResolvedValue({
				items: [withUser],
				pagination: { hasNext: true, nextCursor: "c", size: 20 },
			});
			facade.countFriends.mockResolvedValue(7);
			const query = {
				cursor: undefined,
				limit: 20,
				search: undefined,
			} as unknown as GetFriendsQueryDto;

			const result = await controller.getFriends(user, query);

			expect(facade.getFriends).toHaveBeenCalledWith({
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
			facade.getReceivedRequests.mockResolvedValue({
				items: [withUser],
				pagination: { hasNext: false, nextCursor: null, size: 20 },
			});
			facade.countReceivedRequests.mockResolvedValue(1);
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
			facade.getSentRequests.mockResolvedValue({
				items: [withUser],
				pagination: { hasNext: false, nextCursor: null, size: 20 },
			});
			facade.countSentRequests.mockResolvedValue(1);
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
