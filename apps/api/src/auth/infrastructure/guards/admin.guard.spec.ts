/**
 * AdminGuard 단위 테스트
 *
 * @description
 * 관리자 권한 가드의 역할 기반 접근 제어를 검증한다.
 * ADMIN 허용, USER/미인증/알 수 없는 역할 거부를 확인한다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test admin.guard.spec.ts
 * ```
 */
import { TestBed } from "@suites/unit";
import { asDep, createMockExecutionContext } from "@test/mocks";

import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import { AdminGuard } from "./admin.guard";

describe("AdminGuard — 관리자 가드", () => {
	let guard: AdminGuard;

	beforeEach(async () => {
		const { unit } = await TestBed.solitary(AdminGuard).compile();

		guard = unit;
	});

	describe("canActivate", () => {
		it("ADMIN 역할을 가진 사용자는 접근을 허용해야 한다", () => {
			// Given
			const { context } = createMockExecutionContext({
				user: {
					userId: "user-1",
					email: "admin@test.com",
					sessionId: "session-1",
					role: "ADMIN",
				},
			});

			// When
			const result = guard.canActivate(context);

			// Then
			expect(result).toBe(true);
		});

		it("USER 역할을 가진 사용자는 접근을 거부해야 한다", () => {
			// Given
			const { context } = createMockExecutionContext({
				user: {
					userId: "user-1",
					email: "user@test.com",
					sessionId: "session-1",
					role: "USER",
				},
			});

			// When & Then
			expect(() => guard.canActivate(context)).toThrow(ApplicationException);
		});

		it("사용자 정보가 없으면 invalidToken 에러를 던져야 한다", () => {
			// Given
			const { context } = createMockExecutionContext();

			// When & Then
			expect(() => guard.canActivate(context)).toThrow(ApplicationException);
		});

		it("알 수 없는 역할은 접근을 거부해야 한다", () => {
			// Given
			const { context } = createMockExecutionContext({
				user: {
					userId: "user-1",
					email: "unknown@test.com",
					sessionId: "session-1",
					role: asDep("UNKNOWN_ROLE"),
				},
			});

			// When & Then
			expect(() => guard.canActivate(context)).toThrow(ApplicationException);
		});

		it("빈 문자열 역할은 접근을 거부해야 한다", () => {
			// Given
			const { context } = createMockExecutionContext({
				user: {
					userId: "user-1",
					email: "empty@test.com",
					sessionId: "session-1",
					role: asDep(""),
				},
			});

			// When & Then
			expect(() => guard.canActivate(context)).toThrow(ApplicationException);
		});
	});

	describe("에러 메시지 검증", () => {
		it("USER 역할 거부 시 ADMIN_1401 에러 코드를 반환해야 한다", () => {
			// Given
			const { context } = createMockExecutionContext({
				user: {
					userId: "user-1",
					email: "user@test.com",
					sessionId: "session-1",
					role: "USER",
				},
			});

			// When & Then
			try {
				guard.canActivate(context);
				fail("에러가 발생해야 합니다");
			} catch (error) {
				expect(error).toBeInstanceOf(ApplicationException);
				if (error instanceof ApplicationException) {
					expect(error.errorCode).toBe("ADMIN_1401");
				}
			}
		});

		it("사용자 정보 없음 시 AUTH 에러 코드를 반환해야 한다", () => {
			// Given
			const { context } = createMockExecutionContext();

			// When & Then
			try {
				guard.canActivate(context);
				fail("에러가 발생해야 합니다");
			} catch (error) {
				expect(error).toBeInstanceOf(ApplicationException);
				// invalidToken 에러는 AUTH 도메인 에러 코드를 사용
				if (error instanceof ApplicationException) {
					expect(error.errorCode).toMatch(/^AUTH_/);
				}
			}
		});
	});
});
