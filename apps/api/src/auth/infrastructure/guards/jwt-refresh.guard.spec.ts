/**
 * JwtRefreshGuard 단위 테스트
 *
 * @description
 * Refresh 토큰 인증 가드의 handleRequest 로직을 검증한다.
 * 유효 사용자 반환, 에러/미인증 시 ApplicationException 발생을 확인한다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test jwt-refresh.guard.spec.ts
 * ```
 */
import { TestBed } from "@suites/unit";

import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import { JwtRefreshGuard } from "./jwt-refresh.guard";

describe("JwtRefreshGuard — 가드", () => {
	let guard: JwtRefreshGuard;

	beforeEach(async () => {
		const { unit } = await TestBed.solitary(JwtRefreshGuard).compile();

		guard = unit;
	});

	describe("handleRequest", () => {
		it("유효한 사용자가 있으면 사용자를 반환해야 한다", () => {
			// Given
			const mockUser = {
				userId: "user-1",
				email: "test@test.com",
				sessionId: "session-1",
				role: "USER",
			};

			// When
			const result = guard.handleRequest(null, mockUser);

			// Then
			expect(result).toBe(mockUser);
		});

		it("에러가 존재하면 ApplicationException을 던져야 한다", () => {
			// Given
			const error = new Error("Refresh token expired");

			// When & Then
			expect(() => guard.handleRequest(error, false)).toThrow(ApplicationException);
		});

		it("사용자가 false이면 ApplicationException을 던져야 한다", () => {
			// Given & When & Then
			expect(() => guard.handleRequest(null, false)).toThrow(ApplicationException);
		});

		it("에러 발생 시 AUTH_0104 에러 코드를 반환해야 한다", () => {
			// Given
			const error = new Error("Refresh token invalid");

			// When & Then
			try {
				guard.handleRequest(error, false);
				fail("에러가 발생해야 합니다");
			} catch (error) {
				expect(error).toBeInstanceOf(ApplicationException);
				if (error instanceof ApplicationException) {
					expect(error.errorCode).toBe("AUTH_0104");
				}
			}
		});

		it("사용자 없이 에러도 없으면 AUTH_0104 에러 코드를 반환해야 한다", () => {
			// Given & When & Then
			try {
				guard.handleRequest(null, false);
				fail("에러가 발생해야 합니다");
			} catch (error) {
				expect(error).toBeInstanceOf(ApplicationException);
				if (error instanceof ApplicationException) {
					expect(error.errorCode).toBe("AUTH_0104");
				}
			}
		});
	});
});
