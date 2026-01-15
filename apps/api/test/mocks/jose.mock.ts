/**
 * Jose 라이브러리 Mock
 *
 * E2E 테스트에서 ESM 모듈인 jose를 로드할 수 없는 문제를 해결하기 위한 모킹
 * 실제 토큰 검증은 테스트하지 않으므로 기본 구현만 제공
 */

export const createRemoteJWKSet = jest.fn().mockReturnValue(async () => ({}));

export const jwtVerify = jest.fn().mockResolvedValue({
	payload: {
		sub: "mock-user-id",
		email: "mock@example.com",
		email_verified: true,
	},
	protectedHeader: { alg: "RS256" },
});

export const errors = {
	JWTExpired: class JWTExpired extends Error {
		constructor(message = "JWT expired") {
			super(message);
			this.name = "JWTExpired";
		}
	},
	JWTClaimValidationFailed: class JWTClaimValidationFailed extends Error {
		constructor(message = "JWT claim validation failed") {
			super(message);
			this.name = "JWTClaimValidationFailed";
		}
	},
};
