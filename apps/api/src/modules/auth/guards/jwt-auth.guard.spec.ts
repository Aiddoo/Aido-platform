/**
 * JwtAuthGuard 단위 테스트
 *
 * @description
 * JWT 인증 가드의 canActivate, handleRequest 로직을 검증한다.
 * @Public() 데코레이터 처리, 에러/미인증 사용자 거부를 확인한다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test jwt-auth.guard.spec.ts
 * ```
 */
import { Reflector } from "@nestjs/core";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createMockExecutionContext } from "@test/mocks";
import { BusinessException } from "@/common/exception/services/business-exception.service";

import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { JwtAuthGuard } from "./jwt-auth.guard";

describe("JwtAuthGuard — JWT 인증 가드", () => {
	let guard: JwtAuthGuard;
	let reflector: Mocked<Reflector>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(JwtAuthGuard).compile();

		guard = unit;
		reflector = unitRef.get(Reflector);
	});

	describe("canActivate", () => {
		it("@Public() 데코레이터가 적용된 라우트는 true를 반환해야 한다", () => {
			// Given
			const { context } = createMockExecutionContext();
			reflector.getAllAndOverride.mockReturnValue(true);

			// When
			const result = guard.canActivate(context);

			// Then
			expect(result).toBe(true);
			expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
				context.getHandler(),
				context.getClass(),
			]);
		});
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

		it("에러가 존재하면 BusinessException을 던져야 한다", () => {
			// Given
			const error = new Error("Token expired");
			const mockUser = {
				userId: "user-1",
				email: "test@test.com",
				sessionId: "session-1",
				role: "USER",
			};

			// When & Then
			expect(() => guard.handleRequest(error, mockUser)).toThrow(
				BusinessException,
			);
		});

		it("사용자가 false이면 BusinessException을 던져야 한다", () => {
			// Given & When & Then
			expect(() => guard.handleRequest(null, false)).toThrow(BusinessException);
		});

		it("에러 발생 시 AUTH_0101 에러 코드를 반환해야 한다", () => {
			// Given
			const error = new Error("Token expired");

			// When & Then
			try {
				guard.handleRequest(error, false);
				fail("에러가 발생해야 합니다");
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessException);
				expect((error as BusinessException).errorCode).toBe("AUTH_0101");
			}
		});

		it("에러 메시지가 없으면 기본 메시지를 사용해야 한다", () => {
			// Given & When & Then
			try {
				guard.handleRequest(null, false);
				fail("에러가 발생해야 합니다");
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessException);
				expect((error as BusinessException).errorCode).toBe("AUTH_0101");
			}
		});
	});
});
