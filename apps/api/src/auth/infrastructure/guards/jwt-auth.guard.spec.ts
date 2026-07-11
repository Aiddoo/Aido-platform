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

import { ErrorCode } from "@aido/errors";
import { Reflector } from "@nestjs/core";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createMockExecutionContext } from "@test/mocks";
import { IS_PUBLIC_KEY } from "@/auth/presentation/decorators/public.decorator";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
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

		it("ApplicationException(의도적 401)은 invalidToken으로 재포장해야 한다", () => {
			// Given — validate()의 assertSessionValid/계정 상태 검증 등이 던진 예외
			const error = new ApplicationException(ErrorCode.USER_0607, {
				email: "User",
				remainingMinutes: undefined,
			});
			const mockUser = {
				userId: "user-1",
				email: "test@test.com",
				sessionId: "session-1",
				role: "USER",
			};

			// When & Then — 기존(변경 전) 동작 유지: 클라 계약 불변
			expect(() => guard.handleRequest(error, mockUser)).toThrow(
				ApplicationException,
			);
		});

		it("사용자가 false이면 ApplicationException을 던져야 한다", () => {
			// Given & When & Then
			expect(() => guard.handleRequest(null, false)).toThrow(
				ApplicationException,
			);
		});

		it("HttpException 에러 발생 시 AUTH_0101 에러 코드를 반환해야 한다", () => {
			// Given
			const error = new ApplicationException(ErrorCode.USER_0605, {
				userId: "User",
			});

			// When & Then
			try {
				guard.handleRequest(error, false);
				fail("에러가 발생해야 합니다");
			} catch (error) {
				expect(error).toBeInstanceOf(ApplicationException);
				expect((error as ApplicationException).errorCode).toBe("AUTH_0101");
			}
		});

		it("비-HttpException(인프라 오류)은 401로 위장하지 않고 그대로 rethrow해야 한다", () => {
			// Given — DB 연결 실패 등 인프라 오류가 validate()에서 전파된 상황.
			// 401로 위장하면 구버전 클라가 토큰을 삭제(강제 로그아웃)하므로
			// 반드시 5xx로 흘려보내야 한다 (5xx는 토큰 보존 + Sentry 리포트).
			const infraError = new Error("Connection terminated unexpectedly");

			// When & Then
			expect(() => guard.handleRequest(infraError, false)).toThrow(infraError);
			expect(() => guard.handleRequest(infraError, false)).not.toThrow(
				ApplicationException,
			);
		});

		it("에러 메시지가 없으면 기본 메시지를 사용해야 한다", () => {
			// Given & When & Then
			try {
				guard.handleRequest(null, false);
				fail("에러가 발생해야 합니다");
			} catch (error) {
				expect(error).toBeInstanceOf(ApplicationException);
				expect((error as ApplicationException).errorCode).toBe("AUTH_0101");
			}
		});
	});
});
