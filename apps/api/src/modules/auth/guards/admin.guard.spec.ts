import { TestBed } from "@suites/unit";
import { createMockExecutionContext } from "@test/mocks";
import { BusinessException } from "@/common/exception/services/business-exception.service";

import { AdminGuard } from "./admin.guard";

describe("AdminGuard", () => {
	let guard: AdminGuard;

	// ==========================================================================
	// Setup
	// ==========================================================================

	beforeEach(async () => {
		const { unit } = await TestBed.solitary(AdminGuard).compile();

		guard = unit;
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	// ==========================================================================
	// canActivate
	// ==========================================================================

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
			expect(() => guard.canActivate(context)).toThrow(BusinessException);
		});

		it("사용자 정보가 없으면 invalidToken 에러를 던져야 한다", () => {
			// Given
			const { context } = createMockExecutionContext();

			// When & Then
			expect(() => guard.canActivate(context)).toThrow(BusinessException);
		});

		it("알 수 없는 역할은 접근을 거부해야 한다", () => {
			// Given
			const { context } = createMockExecutionContext({
				user: {
					userId: "user-1",
					email: "unknown@test.com",
					sessionId: "session-1",
					role: "UNKNOWN_ROLE" as any,
				},
			});

			// When & Then
			expect(() => guard.canActivate(context)).toThrow(BusinessException);
		});

		it("빈 문자열 역할은 접근을 거부해야 한다", () => {
			// Given
			const { context } = createMockExecutionContext({
				user: {
					userId: "user-1",
					email: "empty@test.com",
					sessionId: "session-1",
					role: "" as any,
				},
			});

			// When & Then
			expect(() => guard.canActivate(context)).toThrow(BusinessException);
		});
	});

	// ==========================================================================
	// 에러 메시지 검증
	// ==========================================================================

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
				expect(error).toBeInstanceOf(BusinessException);
				expect((error as BusinessException).errorCode).toBe("ADMIN_1401");
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
				expect(error).toBeInstanceOf(BusinessException);
				// invalidToken 에러는 AUTH 도메인 에러 코드를 사용
				expect((error as BusinessException).errorCode).toMatch(/^AUTH_/);
			}
		});
	});
});
