import { CacheKeys } from "../../constants/cache-keys";

describe("CacheKeys", () => {
	describe("TTL 상수", () => {
		it("세션 TTL은 30초이다", () => {
			// Given
			const expectedTtl = 30_000;

			// When
			const actualTtl = CacheKeys.TTL.SESSION;

			// Then
			expect(actualTtl).toBe(expectedTtl);
		});

		it("사용자 프로필 TTL은 5분이다", () => {
			// Given
			const expectedTtl = 5 * 60_000;

			// When
			const actualTtl = CacheKeys.TTL.USER_PROFILE;

			// Then
			expect(actualTtl).toBe(expectedTtl);
		});

		it("구독 상태 TTL은 10분이다", () => {
			// Given
			const expectedTtl = 10 * 60_000;

			// When
			const actualTtl = CacheKeys.TTL.SUBSCRIPTION;

			// Then
			expect(actualTtl).toBe(expectedTtl);
		});

		it("상호 친구 TTL은 1분이다", () => {
			// Given
			const expectedTtl = 60_000;

			// When
			const actualTtl = CacheKeys.TTL.MUTUAL_FRIEND;

			// Then
			expect(actualTtl).toBe(expectedTtl);
		});

		it("모든 TTL 값은 양수이다", () => {
			// Given
			const ttlEntries = Object.entries(CacheKeys.TTL);

			// When & Then
			for (const [_key, value] of ttlEntries) {
				expect(typeof value).toBe("number");
				expect(value).toBeGreaterThan(0);
			}
		});
	});

	describe("키 빌더", () => {
		describe("session", () => {
			it("세션 키를 생성한다", () => {
				// Given
				const sessionId = "sess_123";

				// When
				const key = CacheKeys.session(sessionId);

				// Then
				expect(key).toBe("session:sess_123");
			});

			it("다양한 세션 ID 형식을 처리한다", () => {
				// Given
				const testCases = [
					{ input: "abc123", expected: "session:abc123" },
					{
						input: "session-with-dashes",
						expected: "session:session-with-dashes",
					},
					{
						input: "session_with_underscores",
						expected: "session:session_with_underscores",
					},
				];

				// When & Then
				for (const { input, expected } of testCases) {
					expect(CacheKeys.session(input)).toBe(expected);
				}
			});
		});

		describe("userProfile", () => {
			it("사용자 프로필 키를 생성한다", () => {
				// Given
				const userId = "user_1";

				// When
				const key = CacheKeys.userProfile(userId);

				// Then
				expect(key).toBe("user:profile:user_1");
			});

			it("UUID 형식을 처리한다", () => {
				// Given
				const uuid = "550e8400-e29b-41d4-a716-446655440000";

				// When
				const key = CacheKeys.userProfile(uuid);

				// Then
				expect(key).toBe(`user:profile:${uuid}`);
			});
		});

		describe("subscription", () => {
			it("구독 상태 키를 생성한다", () => {
				// Given
				const userId = "user_1";

				// When
				const key = CacheKeys.subscription(userId);

				// Then
				expect(key).toBe("user:subscription:user_1");
			});
		});

		describe("mutualFriend", () => {
			it("상호 친구 키를 생성한다", () => {
				// Given
				const userId = "user_1";
				const targetUserId = "user_2";

				// When
				const key = CacheKeys.mutualFriend(userId, targetUserId);

				// Then
				expect(key).toBe("friends:mutual:user_1:user_2");
			});

			it("사용자 ID 순서를 유지한다", () => {
				// Given
				const userA = "user_a";
				const userB = "user_b";

				// When
				const key1 = CacheKeys.mutualFriend(userA, userB);
				const key2 = CacheKeys.mutualFriend(userB, userA);

				// Then
				expect(key1).toBe("friends:mutual:user_a:user_b");
				expect(key2).toBe("friends:mutual:user_b:user_a");
				expect(key1).not.toBe(key2);
			});
		});
	});

	describe("패턴 빌더", () => {
		describe("mutualFriendPattern", () => {
			it("상호 친구 패턴을 생성한다", () => {
				// Given
				const userId = "user_1";

				// When
				const pattern = CacheKeys.mutualFriendPattern(userId);

				// Then
				expect(pattern).toBe("friends:mutual:user_1:*");
			});

			it("특정 사용자의 모든 친구 키와 매칭된다", () => {
				// Given
				const pattern = CacheKeys.mutualFriendPattern("user_1");
				const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);

				// When & Then
				expect(regex.test("friends:mutual:user_1:user_2")).toBe(true);
				expect(regex.test("friends:mutual:user_1:user_3")).toBe(true);
				expect(regex.test("friends:mutual:user_2:user_1")).toBe(false);
			});
		});
	});

	describe("키 고유성", () => {
		it("서로 다른 도메인의 키는 고유하다", () => {
			// Given
			const id = "123";

			// When
			const sessionKey = CacheKeys.session(id);
			const profileKey = CacheKeys.userProfile(id);
			const subscriptionKey = CacheKeys.subscription(id);

			// Then
			expect(sessionKey).not.toBe(profileKey);
			expect(profileKey).not.toBe(subscriptionKey);
			expect(sessionKey).not.toBe(subscriptionKey);
		});

		it("서로 다른 사용자의 키는 고유하다", () => {
			// Given
			const userId1 = "user_1";
			const userId2 = "user_2";

			// When
			const key1 = CacheKeys.userProfile(userId1);
			const key2 = CacheKeys.userProfile(userId2);

			// Then
			expect(key1).not.toBe(key2);
		});
	});

	describe("타입 안전성", () => {
		it("CacheKeys 구조가 올바르다", () => {
			// Given
			// - CacheKeys 상수 객체

			// When & Then
			expect(typeof CacheKeys.TTL).toBe("object");
			expect(typeof CacheKeys.session).toBe("function");
			expect(typeof CacheKeys.userProfile).toBe("function");
			expect(typeof CacheKeys.subscription).toBe("function");
			expect(typeof CacheKeys.mutualFriend).toBe("function");
			expect(typeof CacheKeys.mutualFriendPattern).toBe("function");
		});
	});
});
