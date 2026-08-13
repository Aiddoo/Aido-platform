import { AuthSession } from "./auth-session.aggregate";

const createSession = () =>
	AuthSession.reconstitute({
		id: "session-1",
		userId: "user-1",
		refreshTokenHash: "current-hash",
		previousTokenHash: "previous-hash",
		tokenFamily: "family-1",
		tokenVersion: 3,
		lastUsedAt: new Date("2026-08-14T00:00:00.000Z"),
		expiresAt: new Date("2026-08-21T00:00:00.000Z"),
		revokedAt: null,
	});

describe("AuthSession", () => {
	it("소유자와 폐기 상태를 판정한다", () => {
		const session = createSession();

		expect(session.isOwnedBy("user-1")).toBe(true);
		expect(session.isOwnedBy("other-user")).toBe(false);
		expect(session.isRevoked()).toBe(false);
	});

	it("직전 토큰의 grace period 내 재시도만 허용한다", () => {
		const session = createSession();

		expect(
			session.isRetryWithin(
				"previous-hash",
				new Date("2026-08-14T00:00:10.000Z"),
				10_000,
			),
		).toBe(true);
		expect(
			session.isRetryWithin(
				"previous-hash",
				new Date("2026-08-14T00:00:10.001Z"),
				10_000,
			),
		).toBe(false);
		expect(
			session.isRetryWithin(
				"unknown-hash",
				new Date("2026-08-14T00:00:01.000Z"),
				10_000,
			),
		).toBe(false);
	});

	it("현재 버전을 기준으로 낙관적 회전 계획을 만든다", () => {
		const session = createSession();
		const expiresAt = new Date("2026-08-22T00:00:00.000Z");

		expect(
			session.planRotation("next-hash", "current-hash", expiresAt),
		).toEqual({
			refreshTokenHash: "next-hash",
			tokenVersion: 4,
			previousTokenHash: "current-hash",
			expectedTokenVersion: 3,
			expiresAt,
		});
	});
});
