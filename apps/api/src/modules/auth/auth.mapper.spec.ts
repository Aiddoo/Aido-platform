import { AuthMapper } from "./auth.mapper";
import type {
	CurrentUserResult,
	ExchangeCodeResult,
	LoginResult,
	RefreshTokensResult,
	RegisterResult,
	UpdateProfileResult,
	VerifyEmailResult,
} from "./types/auth.types";

describe("AuthMapper", () => {
	describe("toRegisterResponse", () => {
		it("회원가입 결과를 응답 형식으로 변환한다", () => {
			// Given
			const result: RegisterResult = {
				userId: "user-123",
				email: "test@example.com",
				emailSent: true,
				message: "회원가입이 완료되었습니다.",
			};

			// When
			const response = AuthMapper.toRegisterResponse(result);

			// Then
			expect(response).toEqual({
				message: "회원가입이 완료되었습니다.",
				email: "test@example.com",
				emailSent: true,
			});
		});
	});

	describe("toAuthTokensResponse", () => {
		it("이메일 인증 결과를 토큰 응답으로 변환한다", () => {
			// Given
			const result: VerifyEmailResult = {
				userId: "user-123",
				userTag: "user#1234",
				tokens: {
					accessToken: "access-token",
					refreshToken: "refresh-token",
					expiresIn: 3600,
				},
				name: "테스터",
				profileImage: "https://example.com/img.jpg",
			};

			// When
			const response = AuthMapper.toAuthTokensResponse(result);

			// Then
			expect(response).toEqual({
				userId: "user-123",
				userTag: "user#1234",
				accessToken: "access-token",
				refreshToken: "refresh-token",
				name: "테스터",
				profileImage: "https://example.com/img.jpg",
				accountRestored: false,
			});
		});

		it("로그인 결과를 토큰 응답으로 변환한다", () => {
			// Given
			const result: LoginResult = {
				userId: "user-456",
				userTag: "login#5678",
				tokens: {
					accessToken: "login-access",
					refreshToken: "login-refresh",
					expiresIn: 3600,
				},
				sessionId: "session-789",
				name: null,
				profileImage: null,
			};

			// When
			const response = AuthMapper.toAuthTokensResponse(result);

			// Then
			expect(response).toEqual({
				userId: "user-456",
				userTag: "login#5678",
				accessToken: "login-access",
				refreshToken: "login-refresh",
				name: null,
				profileImage: null,
				accountRestored: false,
			});
		});

		it("계정 복구 로그인 시 accountRestored: true를 포함한다", () => {
			// Given
			const result: LoginResult = {
				userId: "user-789",
				userTag: "rest#1234",
				tokens: {
					accessToken: "restored-access",
					refreshToken: "restored-refresh",
					expiresIn: 3600,
				},
				sessionId: "session-restored",
				name: "복구유저",
				profileImage: null,
				accountRestored: true,
			};

			// When
			const response = AuthMapper.toAuthTokensResponse(result);

			// Then
			expect(response.accountRestored).toBe(true);
		});
	});

	describe("toRefreshTokensResponse", () => {
		it("토큰 갱신 결과를 응답으로 변환한다", () => {
			// Given
			const result: RefreshTokensResult = {
				tokens: {
					accessToken: "new-access",
					refreshToken: "new-refresh",
					expiresIn: 3600,
				},
				sessionId: "session-123",
			};

			// When
			const response = AuthMapper.toRefreshTokensResponse(result);

			// Then
			expect(response).toEqual({
				accessToken: "new-access",
				refreshToken: "new-refresh",
			});
		});
	});

	describe("toCurrentUserResponse", () => {
		it("현재 사용자 정보의 모든 필드를 포함한 응답으로 변환한다", () => {
			// Given
			const result: CurrentUserResult = {
				userId: "user-123",
				email: "test@example.com",
				sessionId: "session-456",
				role: "USER",
				userTag: "test#1234",
				status: "ACTIVE",
				emailVerifiedAt: "2024-01-01T00:00:00.000Z",
				subscriptionStatus: "FREE",
				subscriptionExpiresAt: null,
				name: "테스터",
				profileImage: "https://example.com/img.jpg",
				createdAt: "2024-01-01T00:00:00.000Z",
				providers: ["CREDENTIAL", "KAKAO"],
			};

			// When
			const response = AuthMapper.toCurrentUserResponse(result);

			// Then
			expect(response).toEqual(result);
			expect(Object.keys(response)).toHaveLength(13);
		});
	});

	describe("toUpdateProfileResponse", () => {
		it("프로필 수정 결과를 응답으로 변환한다", () => {
			// Given
			const result: UpdateProfileResult = {
				message: "프로필이 수정되었습니다.",
				name: "새이름",
				profileImage: "https://example.com/new.jpg",
			};

			// When
			const response = AuthMapper.toUpdateProfileResponse(result);

			// Then
			expect(response).toEqual({
				message: "프로필이 수정되었습니다.",
				name: "새이름",
				profileImage: "https://example.com/new.jpg",
			});
		});
	});

	describe("toMessageResponse", () => {
		it("단순 메시지 응답을 생성한다", () => {
			// Given
			const message = "로그아웃되었습니다.";

			// When
			const response = AuthMapper.toMessageResponse(message);

			// Then
			expect(response).toEqual({ message: "로그아웃되었습니다." });
		});
	});

	describe("toExchangeCodeResponse", () => {
		it("OAuth 코드 교환 결과를 응답으로 변환한다", () => {
			// Given
			const result: ExchangeCodeResult = {
				userId: "user-789",
				accessToken: "oauth-access",
				refreshToken: "oauth-refresh",
				userName: "OAuth유저",
				profileImage: "https://example.com/oauth.jpg",
			};

			// When
			const response = AuthMapper.toExchangeCodeResponse(result);

			// Then
			expect(response).toEqual({
				userId: "user-789",
				accessToken: "oauth-access",
				refreshToken: "oauth-refresh",
				name: "OAuth유저",
				profileImage: "https://example.com/oauth.jpg",
				accountRestored: false,
			});
		});

		it("userName이 undefined면 null로 변환한다", () => {
			// Given
			const result: ExchangeCodeResult = {
				userId: "user-789",
				accessToken: "oauth-access",
				refreshToken: "oauth-refresh",
			};

			// When
			const response = AuthMapper.toExchangeCodeResponse(result);

			// Then
			expect(response.name).toBeNull();
			expect(response.profileImage).toBeNull();
			expect(response.accountRestored).toBe(false);
		});

		it("계정 복구 시 accountRestored: true를 포함한다", () => {
			// Given
			const result: ExchangeCodeResult = {
				userId: "user-restored",
				accessToken: "restored-access",
				refreshToken: "restored-refresh",
				userName: "복구유저",
				accountRestored: true,
			};

			// When
			const response = AuthMapper.toExchangeCodeResponse(result);

			// Then
			expect(response.accountRestored).toBe(true);
		});
	});
});
