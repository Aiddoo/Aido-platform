/**
 * AuthController 단위 테스트
 *
 * @description
 * 인증 컨트롤러의 회원가입, 로그인, 전체 로그아웃 엔드포인트를 검증한다.
 * 서비스 위임과 AuthMapper를 통한 응답 변환을 확인한다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test auth.controller.spec.ts
 * ```
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import type { Request } from "express";
import { AuthService } from "@/auth/application/services/auth.service";
import type { CurrentUserPayload } from "@/auth/presentation/decorators";
import type { LoginDto, RegisterDto } from "../dtos";
import { AuthController } from "./auth.controller";

describe("AuthController — 인증 컨트롤러", () => {
	let controller: AuthController;
	let mockAuthService: Mocked<AuthService>;

	const mockUser: CurrentUserPayload = {
		userId: "user-123",
		email: "test@example.com",
		sessionId: "session-123",
		role: "USER",
	};

	const mockReq = {
		ip: "127.0.0.1",
		headers: { "user-agent": "test-agent" },
	} as unknown as Request;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(AuthController).compile();

		controller = unit;
		mockAuthService = unitRef.get(AuthService);
	});

	describe("register", () => {
		it("회원가입 요청을 서비스에 위임하고 매퍼를 통해 응답을 반환해야 한다", async () => {
			// Given -회원가입 DTO와 서비스 응답이 준비되었을 때
			const dto = {
				email: "test@example.com",
				password: "Password1!",
				nickname: "테스터",
				termsAgreed: true,
				privacyAgreed: true,
				marketingAgreed: false,
			};
			const serviceResult = {
				userId: "user-123",
				message: "인증 코드가 발송되었습니다.",
				email: "test@example.com",
				emailSent: true,
			};
			mockAuthService.register.mockResolvedValue(serviceResult);

			// When -register를 호출하면
			const result = await controller.register(
				dto as unknown as RegisterDto,
				mockReq,
			);

			// Then -서비스에 위임하고 AuthMapper.toRegisterResponse 형식의 응답을 반환해야 한다
			expect(mockAuthService.register).toHaveBeenCalledWith(
				dto,
				expect.any(Object),
			);
			expect(result).toEqual({
				message: serviceResult.message,
				email: serviceResult.email,
				emailSent: true,
			});
		});
	});

	describe("login", () => {
		it("로그인 요청을 서비스에 위임하고 매퍼를 통해 토큰 응답을 반환해야 한다", async () => {
			// Given -로그인 DTO와 서비스 응답이 준비되었을 때
			const dto = {
				email: "test@example.com",
				password: "Password1!",
			};
			const serviceResult = {
				userId: "user-123",
				userTag: "tester#1234",
				name: "테스터",
				profileImage: null,
				sessionId: "session-789",
				tokens: {
					accessToken: "access-token",
					refreshToken: "refresh-token",
					expiresIn: 3600,
				},
			};
			mockAuthService.login.mockResolvedValue(serviceResult);

			// When -login을 호출하면
			const result = await controller.login(
				dto as unknown as LoginDto,
				mockReq,
			);

			// Then -서비스에 위임하고 AuthMapper.toAuthTokensResponse 형식의 응답을 반환해야 한다
			expect(mockAuthService.login).toHaveBeenCalledWith(
				dto,
				expect.any(Object),
			);
			expect(result).toEqual({
				userId: serviceResult.userId,
				userTag: serviceResult.userTag,
				accessToken: serviceResult.tokens.accessToken,
				refreshToken: serviceResult.tokens.refreshToken,
				name: serviceResult.name,
				profileImage: serviceResult.profileImage,
				accountRestored: false,
			});
		});
	});

	describe("logoutAll", () => {
		it("전체 로그아웃 요청을 서비스에 위임하고 메시지를 반환해야 한다", async () => {
			// Given -인증된 사용자가 있을 때
			mockAuthService.logoutAll.mockResolvedValue({
				message: "모든 기기에서 로그아웃되었습니다.",
				revokedCount: 3,
			});

			// When -logoutAll을 호출하면
			const result = await controller.logoutAll(mockUser, mockReq);

			// Then -서비스에 userId를 전달하고 메시지 응답을 반환해야 한다
			expect(mockAuthService.logoutAll).toHaveBeenCalledWith(
				mockUser.userId,
				expect.any(Object),
			);
			expect(result).toEqual({
				message: "모든 기기에서 로그아웃되었습니다.",
			});
		});
	});
});
