/**
 * FollowMapper 단위 테스트 — 애플리케이션 타입 → API 응답 변환 검증(계약 불변).
 */
import type {
	FollowWithUser,
	UserSearchResult,
} from "../application/ports/follow.repository.port";
import { Friendship } from "../domain/entities/friendship.aggregate";
import { FollowMapper } from "./follow.mapper";

describe("FollowMapper", () => {
	const createdAt = new Date("2026-01-01T00:00:00.000Z");
	const updatedAt = new Date("2026-01-02T03:04:05.000Z");

	const record = Friendship.reconstitute({
		id: "follow-1",
		followerId: "user-a",
		followingId: "user-b",
		status: "PENDING",
		sortOrder: 0,
		createdAt,
		updatedAt,
	});

	const withUser: FollowWithUser = {
		id: "follow-1",
		followerId: "user-a",
		followingId: "user-b",
		status: "ACCEPTED",
		sortOrder: 0,
		createdAt,
		updatedAt,
		follower: {
			id: "user-a",
			userTag: "AAAA1111",
			profile: { name: "Alice", profileImage: "img-a" },
		},
		following: {
			id: "user-b",
			userTag: "BBBB2222",
			profile: { name: "Bob", profileImage: null },
		},
	};

	it("toResponse는 Follow 응답으로 변환한다", () => {
		expect(FollowMapper.toResponse(record)).toEqual({
			id: "follow-1",
			followerId: "user-a",
			followingId: "user-b",
			status: "PENDING",
			createdAt: createdAt.toISOString(),
			updatedAt: updatedAt.toISOString(),
		});
	});

	it("toFriendUser는 following을 친구로 변환한다", () => {
		expect(FollowMapper.toFriendUser(withUser)).toEqual({
			followId: "follow-1",
			id: "user-b",
			userTag: "BBBB2222",
			name: "Bob",
			profileImage: null,
			friendsSince: updatedAt.toISOString(),
		});
	});

	it("toReceivedRequest는 follower를 요청자로 변환한다", () => {
		expect(FollowMapper.toReceivedRequest(withUser)).toEqual({
			id: "user-a",
			userTag: "AAAA1111",
			name: "Alice",
			profileImage: "img-a",
			requestedAt: createdAt.toISOString(),
		});
	});

	it("toSentRequest는 following을 수신자로 변환한다", () => {
		expect(FollowMapper.toSentRequest(withUser)).toEqual({
			id: "user-b",
			userTag: "BBBB2222",
			name: "Bob",
			profileImage: null,
			requestedAt: createdAt.toISOString(),
		});
	});

	it("profile이 null이면 name/profileImage는 null", () => {
		const noProfile: FollowWithUser = {
			...withUser,
			following: { id: "user-b", userTag: "BBBB2222", profile: null },
		};
		const friend = FollowMapper.toFriendUser(noProfile);
		expect(friend.name).toBeNull();
		expect(friend.profileImage).toBeNull();
	});

	describe("toSearchUser", () => {
		const searchResult = (
			overrides: Partial<UserSearchResult> = {},
		): UserSearchResult => ({
			id: "user-1",
			userTag: "TAG00001",
			profile: { name: "홍길동", profileImage: "https://img/1.jpg" },
			isFollowing: false,
			isFollower: false,
			isFriend: false,
			requestPending: false,
			rank: 2,
			...overrides,
		});

		it("관계 flag를 전달하고 내부 rank는 응답에서 제외한다", () => {
			const result = FollowMapper.toSearchUser(
				searchResult({ isFollowing: true, isFriend: true }),
			);

			expect(result).toEqual({
				id: "user-1",
				userTag: "TAG00001",
				name: "홍길동",
				profileImage: "https://img/1.jpg",
				isFollowing: true,
				isFollower: false,
				isFriend: true,
				requestPending: false,
			});
			expect(result).not.toHaveProperty("rank");
		});

		it("profile이 null이면 name/profileImage는 null", () => {
			const result = FollowMapper.toSearchUser(searchResult({ profile: null }));
			expect(result.name).toBeNull();
			expect(result.profileImage).toBeNull();
		});
	});
});
