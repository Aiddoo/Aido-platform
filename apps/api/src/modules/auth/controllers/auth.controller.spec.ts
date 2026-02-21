import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "../decorators";
import { AuthService } from "../services/auth.service";
import { AuthController } from "./auth.controller";

describe("AuthController", () => {
	let controller: AuthController;
	let mockAuthService: Mocked<AuthService>;

	const mockUser: CurrentUserPayload = {
		userId: "user-123",
		email: "test@example.com",
		sessionId: "session-123",
		role: "USER",
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(AuthController).compile();

		controller = unit;
		mockAuthService = unitRef.get(
			AuthService,
		) as unknown as Mocked<AuthService>;
	});

	describe("register", () => {
		it("회원가입 요청을 서비스에 위임하고 매퍼를 통해 응답을 반환해야 한다", async () => {
			// Given: 회원가입 DTO와 서비스 응답이 준비되었을 때
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
			};
			mockAuthService.register.mockResolvedValue(serviceResult);

			// When: register를 호출하면
			const result = await controller.register(dto as any);

			// Then: 서비스에 위임하고 AuthMapper.toRegisterResponse 형식의 응답을 반환해야 한다
			expect(mockAuthService.register).toHaveBeenCalledWith(dto);
			expect(result).toEqual({
				message: serviceResult.message,
				email: serviceResult.email,
			});
		});
	});

	describe("login", () => {
		it("로그인 요청을 서비스에 위임하고 매퍼를 통해 토큰 응답을 반환해야 한다", async () => {
			// Given: 로그인 DTO와 서비스 응답이 준비되었을 때
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

			// req mock: extractMetadata에서 사용하는 필드
			const mockReq = {
				ip: "127.0.0.1",
				headers: { "user-agent": "test-agent" },
			} as any;

			// When: login을 호출하면
			const result = await controller.login(dto as any, mockReq);

			// Then: 서비스에 위임하고 AuthMapper.toAuthTokensResponse 형식의 응답을 반환해야 한다
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
			});
		});
	});

	describe("logoutAll", () => {
		it("전체 로그아웃 요청을 서비스에 위임하고 메시지를 반환해야 한다", async () => {
			// Given: 인증된 사용자가 있을 때
			mockAuthService.logoutAll.mockResolvedValue({
				message: "모든 기기에서 로그아웃되었습니다.",
				revokedCount: 3,
			});

			// When: logoutAll을 호출하면
			const result = await controller.logoutAll(mockUser);

			// Then: 서비스에 userId를 전달하고 메시지 응답을 반환해야 한다
			expect(mockAuthService.logoutAll).toHaveBeenCalledWith(mockUser.userId);
			expect(result).toEqual({
				message: "모든 기기에서 로그아웃되었습니다.",
			});
		});
	});
});
