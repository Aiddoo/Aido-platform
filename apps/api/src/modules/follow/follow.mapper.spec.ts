import { FollowBuilder, type FollowWithUser } from "@test/builders";
import { FollowStatus } from "@/generated/prisma/client";
import { FollowMapper } from "./follow.mapper";

describe("Follow Mapper", () => {
	describe("FollowMapper.toResponse", () => {
		it("Follow 엔티티를 올바른 응답 형식으로 변환해야 한다", () => {
			// Given - 변환할 Follow 엔티티 준비
			const follow = FollowBuilder.create(
				"follower-user-123",
				"following-user-456",
			)
				.withId("follow-123")
				.withCreatedAt(new Date("2024-01-01T00:00:00.000Z"))
				.withUpdatedAt(new Date("2024-01-02T00:00:00.000Z"))
				.pending()
				.build();

			// When - Mapper 호출
			const result = FollowMapper.toResponse(follow);

			// Then - 변환 결과 검증
			expect(result).toEqual({
				id: "follow-123",
				followerId: "follower-user-123",
				followingId: "following-user-456",
				status: FollowStatus.PENDING,
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-02T00:00:00.000Z",
			});
		});

		it("ACCEPTED 상태를 올바르게 처리해야 한다", () => {
			// Given - ACCEPTED 상태의 Follow 엔티티 준비
			const follow = FollowBuilder.create("follower-123", "following-456")
				.accepted()
				.build();

			// When - Mapper 호출
			const result = FollowMapper.toResponse(follow);

			// Then - ACCEPTED 상태가 올바르게 변환되었는지 검증
			expect(result.status).toBe(FollowStatus.ACCEPTED);
		});
	});

	describe("FollowMapper.toFriendUser", () => {
		it("FollowWithUser를 친구 정보로 올바르게 변환해야 한다", () => {
			// Given - 친구 정보가 포함된 FollowWithUser 준비
			const followWithUser = FollowBuilder.create(
				"follower-user-123",
				"following-user-456",
			)
				.withId("follow-123")
				.accepted()
				.withUpdatedAt(new Date("2024-01-15T00:00:00.000Z"))
				.withFollowerUser({
					id: "follower-user-123",
					userTag: "follower_tag",
					profile: {
						name: "팔로워 이름",
						profileImage: "https://example.com/follower.jpg",
					},
				})
				.withFollowingUser({
					id: "following-user-456",
					userTag: "following_tag",
					profile: {
						name: "팔로잉 이름",
						profileImage: "https://example.com/following.jpg",
					},
				})
				.buildWithUser();

			// When - Mapper 호출
			const result = FollowMapper.toFriendUser(followWithUser);

			// Then - 친구 정보가 올바르게 변환되었는지 검증
			expect(result).toEqual({
				followId: "follow-123",
				id: "following-user-456",
				userTag: "following_tag",
				name: "팔로잉 이름",
				profileImage: "https://example.com/following.jpg",
				friendsSince: "2024-01-15T00:00:00.000Z",
			});
		});

		it("프로필이 null인 경우 name과 profileImage가 null이어야 한다", () => {
			// Given - 프로필이 null인 FollowWithUser 준비
			const followWithUser = FollowBuilder.create(
				"follower-user-123",
				"following-user-456",
			)
				.withFollowerUser({
					id: "follower-user-123",
					userTag: "follower_tag",
					profile: null,
				})
				.withFollowingUser({
					id: "following-user-456",
					userTag: "following_tag",
					profile: null,
				})
				.buildWithUser();

			// When - Mapper 호출
			const result = FollowMapper.toFriendUser(followWithUser);

			// Then - name과 profileImage가 null인지 검증
			expect(result.name).toBeNull();
			expect(result.profileImage).toBeNull();
		});

		it("프로필의 name이 null인 경우를 올바르게 처리해야 한다", () => {
			// Given - 프로필의 name이 null인 FollowWithUser 준비
			const followWithUser = FollowBuilder.create(
				"follower-user-123",
				"following-user-456",
			)
				.withFollowerUser({
					id: "follower-user-123",
					userTag: "follower_tag",
					profile: null,
				})
				.withFollowingUser({
					id: "following-user-456",
					userTag: "following_tag",
					profile: {
						name: null,
						profileImage: "https://example.com/image.jpg",
					},
				})
				.buildWithUser();

			// When - Mapper 호출
			const result = FollowMapper.toFriendUser(followWithUser);

			// Then - name은 null이고 profileImage는 값이 있는지 검증
			expect(result.name).toBeNull();
			expect(result.profileImage).toBe("https://example.com/image.jpg");
		});
	});

	describe("FollowMapper.toReceivedRequest", () => {
		it("받은 친구 요청을 올바르게 변환해야 한다", () => {
			// Given - 받은 요청으로 변환할 FollowWithUser 준비
			const followWithUser = FollowBuilder.create(
				"follower-user-123",
				"following-user-456",
			)
				.withCreatedAt(new Date("2024-01-10T00:00:00.000Z"))
				.withFollowerUser({
					id: "follower-user-123",
					userTag: "follower_tag",
					profile: {
						name: "팔로워 이름",
						profileImage: "https://example.com/follower.jpg",
					},
				})
				.withFollowingUser({
					id: "following-user-456",
					userTag: "following_tag",
					profile: {
						name: "팔로잉 이름",
						profileImage: "https://example.com/following.jpg",
					},
				})
				.buildWithUser();

			// When - Mapper 호출
			const result = FollowMapper.toReceivedRequest(followWithUser);

			// Then - 받은 요청 정보가 올바르게 변환되었는지 검증
			expect(result).toEqual({
				id: "follower-user-123",
				userTag: "follower_tag",
				name: "팔로워 이름",
				profileImage: "https://example.com/follower.jpg",
				requestedAt: "2024-01-10T00:00:00.000Z",
			});
		});

		it("follower의 프로필이 null인 경우를 올바르게 처리해야 한다", () => {
			// Given - follower 프로필이 null인 FollowWithUser 준비
			const followWithUser = FollowBuilder.create(
				"follower-user-123",
				"following-user-456",
			)
				.withFollowerUser({
					id: "follower-user-123",
					userTag: "follower_tag",
					profile: null,
				})
				.withFollowingUser({
					id: "following-user-456",
					userTag: "following_tag",
					profile: null,
				})
				.buildWithUser();

			// When - Mapper 호출
			const result = FollowMapper.toReceivedRequest(followWithUser);

			// Then - name과 profileImage가 null인지 검증
			expect(result.name).toBeNull();
			expect(result.profileImage).toBeNull();
		});
	});

	describe("FollowMapper.toSentRequest", () => {
		it("보낸 친구 요청을 올바르게 변환해야 한다", () => {
			// Given - 보낸 요청으로 변환할 FollowWithUser 준비
			const followWithUser = FollowBuilder.create(
				"follower-user-123",
				"following-user-456",
			)
				.withCreatedAt(new Date("2024-01-10T00:00:00.000Z"))
				.withFollowerUser({
					id: "follower-user-123",
					userTag: "follower_tag",
					profile: {
						name: "팔로워 이름",
						profileImage: "https://example.com/follower.jpg",
					},
				})
				.withFollowingUser({
					id: "following-user-456",
					userTag: "following_tag",
					profile: {
						name: "팔로잉 이름",
						profileImage: "https://example.com/following.jpg",
					},
				})
				.buildWithUser();

			// When - Mapper 호출
			const result = FollowMapper.toSentRequest(followWithUser);

			// Then - 보낸 요청 정보가 올바르게 변환되었는지 검증
			expect(result).toEqual({
				id: "following-user-456",
				userTag: "following_tag",
				name: "팔로잉 이름",
				profileImage: "https://example.com/following.jpg",
				requestedAt: "2024-01-10T00:00:00.000Z",
			});
		});

		it("following의 프로필이 null인 경우를 올바르게 처리해야 한다", () => {
			// Given - following 프로필이 null인 FollowWithUser 준비
			const followWithUser = FollowBuilder.create(
				"follower-user-123",
				"following-user-456",
			)
				.withFollowerUser({
					id: "follower-user-123",
					userTag: "follower_tag",
					profile: null,
				})
				.withFollowingUser({
					id: "following-user-456",
					userTag: "following_tag",
					profile: null,
				})
				.buildWithUser();

			// When - Mapper 호출
			const result = FollowMapper.toSentRequest(followWithUser);

			// Then - name과 profileImage가 null인지 검증
			expect(result.name).toBeNull();
			expect(result.profileImage).toBeNull();
		});
	});

	describe("FollowMapper.toFriendUsers", () => {
		it("빈 배열을 올바르게 처리해야 한다", () => {
			// Given - 빈 배열 준비
			const follows: FollowWithUser[] = [];

			// When - Mapper 호출
			const result = FollowMapper.toFriendUsers(follows);

			// Then - 빈 배열이 반환되는지 검증
			expect(result).toEqual([]);
		});

		it("여러 친구를 올바르게 변환해야 한다", () => {
			// Given - 여러 친구 정보가 포함된 FollowWithUser 배열 준비
			const follows: FollowWithUser[] = [
				FollowBuilder.create("follower-123", "friend-1")
					.withId("follow-1")
					.withFollowerUser({
						id: "follower-123",
						userTag: "follower_tag",
						profile: null,
					})
					.withFollowingUser({
						id: "friend-1",
						userTag: "friend1_tag",
						profile: { name: "친구 1", profileImage: null },
					})
					.buildWithUser(),
				FollowBuilder.create("follower-123", "friend-2")
					.withId("follow-2")
					.withFollowerUser({
						id: "follower-123",
						userTag: "follower_tag",
						profile: null,
					})
					.withFollowingUser({
						id: "friend-2",
						userTag: "friend2_tag",
						profile: { name: "친구 2", profileImage: null },
					})
					.buildWithUser(),
			];

			// When - Mapper 호출
			const result = FollowMapper.toFriendUsers(follows);

			// Then - 여러 친구가 올바르게 변환되었는지 검증
			expect(result).toHaveLength(2);
			expect(result[0]?.id).toBe("friend-1");
			expect(result[0]?.userTag).toBe("friend1_tag");
			expect(result[1]?.id).toBe("friend-2");
			expect(result[1]?.userTag).toBe("friend2_tag");
		});
	});

	describe("FollowMapper.toReceivedRequests", () => {
		it("빈 배열을 올바르게 처리해야 한다", () => {
			// Given - 빈 배열 준비
			const follows: FollowWithUser[] = [];

			// When - Mapper 호출
			const result = FollowMapper.toReceivedRequests(follows);

			// Then - 빈 배열이 반환되는지 검증
			expect(result).toEqual([]);
		});

		it("여러 받은 요청을 올바르게 변환해야 한다", () => {
			// Given - 여러 받은 요청 정보가 포함된 FollowWithUser 배열 준비
			const follows: FollowWithUser[] = [
				FollowBuilder.create("requester-1", "following-123")
					.withId("follow-1")
					.withFollowerUser({
						id: "requester-1",
						userTag: "requester1_tag",
						profile: { name: "요청자 1", profileImage: null },
					})
					.withFollowingUser({
						id: "following-123",
						userTag: "following_tag",
						profile: null,
					})
					.buildWithUser(),
				FollowBuilder.create("requester-2", "following-123")
					.withId("follow-2")
					.withFollowerUser({
						id: "requester-2",
						userTag: "requester2_tag",
						profile: { name: "요청자 2", profileImage: null },
					})
					.withFollowingUser({
						id: "following-123",
						userTag: "following_tag",
						profile: null,
					})
					.buildWithUser(),
			];

			// When - Mapper 호출
			const result = FollowMapper.toReceivedRequests(follows);

			// Then - 여러 받은 요청이 올바르게 변환되었는지 검증
			expect(result).toHaveLength(2);
			expect(result[0]?.id).toBe("requester-1");
			expect(result[0]?.userTag).toBe("requester1_tag");
			expect(result[1]?.id).toBe("requester-2");
			expect(result[1]?.userTag).toBe("requester2_tag");
		});
	});

	describe("FollowMapper.toSentRequests", () => {
		it("빈 배열을 올바르게 처리해야 한다", () => {
			// Given - 빈 배열 준비
			const follows: FollowWithUser[] = [];

			// When - Mapper 호출
			const result = FollowMapper.toSentRequests(follows);

			// Then - 빈 배열이 반환되는지 검증
			expect(result).toEqual([]);
		});

		it("여러 보낸 요청을 올바르게 변환해야 한다", () => {
			// Given - 여러 보낸 요청 정보가 포함된 FollowWithUser 배열 준비
			const follows: FollowWithUser[] = [
				FollowBuilder.create("follower-123", "recipient-1")
					.withId("follow-1")
					.withFollowerUser({
						id: "follower-123",
						userTag: "follower_tag",
						profile: null,
					})
					.withFollowingUser({
						id: "recipient-1",
						userTag: "recipient1_tag",
						profile: { name: "수신자 1", profileImage: null },
					})
					.buildWithUser(),
				FollowBuilder.create("follower-123", "recipient-2")
					.withId("follow-2")
					.withFollowerUser({
						id: "follower-123",
						userTag: "follower_tag",
						profile: null,
					})
					.withFollowingUser({
						id: "recipient-2",
						userTag: "recipient2_tag",
						profile: { name: "수신자 2", profileImage: null },
					})
					.buildWithUser(),
			];

			// When - Mapper 호출
			const result = FollowMapper.toSentRequests(follows);

			// Then - 여러 보낸 요청이 올바르게 변환되었는지 검증
			expect(result).toHaveLength(2);
			expect(result[0]?.id).toBe("recipient-1");
			expect(result[0]?.userTag).toBe("recipient1_tag");
			expect(result[1]?.id).toBe("recipient-2");
			expect(result[1]?.userTag).toBe("recipient2_tag");
		});
	});
});
