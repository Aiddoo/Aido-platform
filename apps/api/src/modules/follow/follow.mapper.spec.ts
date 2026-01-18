import { type Follow, FollowStatus } from "@/generated/prisma/client";
import {
	mapFollowsToFriendUsers,
	mapFollowsToReceivedRequests,
	mapFollowsToSentRequests,
	mapFollowToFriendUser,
	mapFollowToReceivedRequest,
	mapFollowToResponse,
	mapFollowToSentRequest,
} from "./follow.mapper";
import type { FollowWithUser } from "./types/follow.types";

describe("Follow Mapper", () => {
	const createMockFollow = (overrides: Partial<Follow> = {}): Follow => ({
		id: "follow-123",
		followerId: "follower-user-123",
		followingId: "following-user-456",
		status: FollowStatus.PENDING,
		createdAt: new Date("2024-01-01T00:00:00.000Z"),
		updatedAt: new Date("2024-01-02T00:00:00.000Z"),
		...overrides,
	});

	const createMockFollowWithUser = (
		overrides: Partial<FollowWithUser> = {},
	): FollowWithUser => ({
		...createMockFollow(),
		follower: {
			id: "follower-user-123",
			userTag: "follower_tag",
			profile: {
				name: "팔로워 이름",
				profileImage: "https://example.com/follower.jpg",
			},
		},
		following: {
			id: "following-user-456",
			userTag: "following_tag",
			profile: {
				name: "팔로잉 이름",
				profileImage: "https://example.com/following.jpg",
			},
		},
		...overrides,
	});

	describe("mapFollowToResponse", () => {
		it("Follow 엔티티를 올바른 응답 형식으로 변환해야 한다", () => {
			const follow = createMockFollow();
			const result = mapFollowToResponse(follow);

			expect(result).toEqual({
				id: "follow-123",
				followerId: "follower-user-123",
				followingId: "following-user-456",
				status: FollowStatus.PENDING,
				createdAt: new Date("2024-01-01T00:00:00.000Z"),
				updatedAt: new Date("2024-01-02T00:00:00.000Z"),
			});
		});

		it("ACCEPTED 상태를 올바르게 처리해야 한다", () => {
			const follow = createMockFollow({
				status: FollowStatus.ACCEPTED,
			});
			const result = mapFollowToResponse(follow);

			expect(result.status).toBe(FollowStatus.ACCEPTED);
		});
	});

	describe("mapFollowToFriendUser", () => {
		it("FollowWithUser를 친구 정보로 올바르게 변환해야 한다", () => {
			const followWithUser = createMockFollowWithUser({
				status: FollowStatus.ACCEPTED,
				updatedAt: new Date("2024-01-15T00:00:00.000Z"),
			});
			const result = mapFollowToFriendUser(followWithUser);

			expect(result).toEqual({
				followId: "follow-123",
				id: "following-user-456",
				userTag: "following_tag",
				name: "팔로잉 이름",
				profileImage: "https://example.com/following.jpg",
				friendsSince: new Date("2024-01-15T00:00:00.000Z"),
			});
		});

		it("프로필이 null인 경우 name과 profileImage가 null이어야 한다", () => {
			const followWithUser = createMockFollowWithUser({
				following: {
					id: "following-user-456",
					userTag: "following_tag",
					profile: null,
				},
			});
			const result = mapFollowToFriendUser(followWithUser);

			expect(result.name).toBeNull();
			expect(result.profileImage).toBeNull();
		});

		it("프로필의 name이 null인 경우를 올바르게 처리해야 한다", () => {
			const followWithUser = createMockFollowWithUser({
				following: {
					id: "following-user-456",
					userTag: "following_tag",
					profile: {
						name: null,
						profileImage: "https://example.com/image.jpg",
					},
				},
			});
			const result = mapFollowToFriendUser(followWithUser);

			expect(result.name).toBeNull();
			expect(result.profileImage).toBe("https://example.com/image.jpg");
		});
	});

	describe("mapFollowToReceivedRequest", () => {
		it("받은 친구 요청을 올바르게 변환해야 한다", () => {
			const followWithUser = createMockFollowWithUser({
				createdAt: new Date("2024-01-10T00:00:00.000Z"),
			});
			const result = mapFollowToReceivedRequest(followWithUser);

			expect(result).toEqual({
				id: "follower-user-123",
				userTag: "follower_tag",
				name: "팔로워 이름",
				profileImage: "https://example.com/follower.jpg",
				requestedAt: new Date("2024-01-10T00:00:00.000Z"),
			});
		});

		it("follower의 프로필이 null인 경우를 올바르게 처리해야 한다", () => {
			const followWithUser = createMockFollowWithUser({
				follower: {
					id: "follower-user-123",
					userTag: "follower_tag",
					profile: null,
				},
			});
			const result = mapFollowToReceivedRequest(followWithUser);

			expect(result.name).toBeNull();
			expect(result.profileImage).toBeNull();
		});
	});

	describe("mapFollowToSentRequest", () => {
		it("보낸 친구 요청을 올바르게 변환해야 한다", () => {
			const followWithUser = createMockFollowWithUser({
				createdAt: new Date("2024-01-10T00:00:00.000Z"),
			});
			const result = mapFollowToSentRequest(followWithUser);

			expect(result).toEqual({
				id: "following-user-456",
				userTag: "following_tag",
				name: "팔로잉 이름",
				profileImage: "https://example.com/following.jpg",
				requestedAt: new Date("2024-01-10T00:00:00.000Z"),
			});
		});

		it("following의 프로필이 null인 경우를 올바르게 처리해야 한다", () => {
			const followWithUser = createMockFollowWithUser({
				following: {
					id: "following-user-456",
					userTag: "following_tag",
					profile: null,
				},
			});
			const result = mapFollowToSentRequest(followWithUser);

			expect(result.name).toBeNull();
			expect(result.profileImage).toBeNull();
		});
	});

	describe("mapFollowsToFriendUsers", () => {
		it("빈 배열을 올바르게 처리해야 한다", () => {
			const result = mapFollowsToFriendUsers([]);
			expect(result).toEqual([]);
		});

		it("여러 친구를 올바르게 변환해야 한다", () => {
			const follows = [
				createMockFollowWithUser({
					id: "follow-1",
					following: {
						id: "friend-1",
						userTag: "friend1_tag",
						profile: { name: "친구 1", profileImage: null },
					},
				}),
				createMockFollowWithUser({
					id: "follow-2",
					following: {
						id: "friend-2",
						userTag: "friend2_tag",
						profile: { name: "친구 2", profileImage: null },
					},
				}),
			];
			const result = mapFollowsToFriendUsers(follows);

			expect(result).toHaveLength(2);
			expect(result[0]?.id).toBe("friend-1");
			expect(result[0]?.userTag).toBe("friend1_tag");
			expect(result[1]?.id).toBe("friend-2");
			expect(result[1]?.userTag).toBe("friend2_tag");
		});
	});

	describe("mapFollowsToReceivedRequests", () => {
		it("빈 배열을 올바르게 처리해야 한다", () => {
			const result = mapFollowsToReceivedRequests([]);
			expect(result).toEqual([]);
		});

		it("여러 받은 요청을 올바르게 변환해야 한다", () => {
			const follows = [
				createMockFollowWithUser({
					id: "follow-1",
					follower: {
						id: "requester-1",
						userTag: "requester1_tag",
						profile: { name: "요청자 1", profileImage: null },
					},
				}),
				createMockFollowWithUser({
					id: "follow-2",
					follower: {
						id: "requester-2",
						userTag: "requester2_tag",
						profile: { name: "요청자 2", profileImage: null },
					},
				}),
			];
			const result = mapFollowsToReceivedRequests(follows);

			expect(result).toHaveLength(2);
			expect(result[0]?.id).toBe("requester-1");
			expect(result[0]?.userTag).toBe("requester1_tag");
			expect(result[1]?.id).toBe("requester-2");
			expect(result[1]?.userTag).toBe("requester2_tag");
		});
	});

	describe("mapFollowsToSentRequests", () => {
		it("빈 배열을 올바르게 처리해야 한다", () => {
			const result = mapFollowsToSentRequests([]);
			expect(result).toEqual([]);
		});

		it("여러 보낸 요청을 올바르게 변환해야 한다", () => {
			const follows = [
				createMockFollowWithUser({
					id: "follow-1",
					following: {
						id: "recipient-1",
						userTag: "recipient1_tag",
						profile: { name: "수신자 1", profileImage: null },
					},
				}),
				createMockFollowWithUser({
					id: "follow-2",
					following: {
						id: "recipient-2",
						userTag: "recipient2_tag",
						profile: { name: "수신자 2", profileImage: null },
					},
				}),
			];
			const result = mapFollowsToSentRequests(follows);

			expect(result).toHaveLength(2);
			expect(result[0]?.id).toBe("recipient-1");
			expect(result[0]?.userTag).toBe("recipient1_tag");
			expect(result[1]?.id).toBe("recipient-2");
			expect(result[1]?.userTag).toBe("recipient2_tag");
		});
	});
});
