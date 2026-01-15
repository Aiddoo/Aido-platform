import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import { TypedConfigService } from "@/common/config/services/config.service";
import { TokenService } from "./token.service";

describe("TokenService", () => {
	let service: TokenService;
	let jwtService: JwtService;

	const mockConfigService = {
		jwtSecret: "test-jwt-secret-at-least-32-chars",
		jwtRefreshSecret: "test-refresh-secret-at-least-32-chars",
		jwtExpiresIn: "15m",
		jwtRefreshExpiresIn: "7d",
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TokenService,
				{
					provide: JwtService,
					useValue: {
						signAsync: jest.fn().mockImplementation((payload, _options) => {
							return Promise.resolve(`mock-token-${payload.sub}`);
						}),
						verifyAsync: jest.fn().mockImplementation((token, options) => {
							if (token.includes("invalid")) {
								throw new Error("Invalid token");
							}
							// access token 또는 refresh token에 따라 type 반환
							const isRefreshSecret =
								options?.secret === mockConfigService.jwtRefreshSecret;
							return Promise.resolve({
								sub: "user-id",
								email: "test@example.com",
								type: isRefreshSecret ? "refresh" : "access",
								sessionId: "session-id",
								tokenFamily: "family-id",
								tokenVersion: 1,
							});
						}),
					},
				},
				{
					provide: TypedConfigService,
					useValue: mockConfigService,
				},
			],
		}).compile();

		service = module.get<TokenService>(TokenService);
		jwtService = module.get<JwtService>(JwtService);
	});

	describe("generateTokenPair", () => {
		it("액세스 토큰과 리프레시 토큰 쌍을 생성한다", async () => {
			// Given
			// - beforeEach에서 JwtService mock 설정됨

			// When
			const result = await service.generateTokenPair(
				"user-id",
				"test@example.com",
				"session-id",
				"family-id",
				1,
			);

			// Then
			expect(result).toHaveProperty("accessToken");
			expect(result).toHaveProperty("refreshToken");
			expect(result).toHaveProperty("expiresIn");
			expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
		});
	});

	describe("verifyAccessToken", () => {
		it("유효한 액세스 토큰을 검증하여 페이로드를 반환한다", async () => {
			// Given
			// - beforeEach에서 유효한 토큰 검증 mock 설정됨

			// When
			const result = await service.verifyAccessToken("valid-token");

			// Then
			expect(result).toBeDefined();
			expect(result?.sub).toBe("user-id");
		});

		it("유효하지 않은 토큰이면 null을 반환한다", async () => {
			// Given
			// - beforeEach에서 "invalid" 포함 토큰은 에러 발생하도록 설정됨

			// When
			const result = await service.verifyAccessToken("invalid-token");

			// Then
			expect(result).toBeNull();
		});
	});

	describe("verifyRefreshToken", () => {
		it("유효한 리프레시 토큰을 검증하여 페이로드를 반환한다", async () => {
			// Given
			// - beforeEach에서 유효한 토큰 검증 mock 설정됨

			// When
			const result = await service.verifyRefreshToken("valid-token");

			// Then
			expect(result).toBeDefined();
			expect(result?.sub).toBe("user-id");
		});

		it("유효하지 않은 토큰이면 null을 반환한다", async () => {
			// Given
			// - beforeEach에서 "invalid" 포함 토큰은 에러 발생하도록 설정됨

			// When
			const result = await service.verifyRefreshToken("invalid-token");

			// Then
			expect(result).toBeNull();
		});
	});

	describe("hashRefreshToken", () => {
		it("리프레시 토큰을 SHA-256으로 해싱한다", () => {
			// Given
			const token = "refresh-token";

			// When
			const hash = service.hashRefreshToken(token);

			// Then
			expect(hash).toBeDefined();
			expect(hash.length).toBe(64); // SHA-256 hex string length
		});

		it("같은 토큰은 같은 해시를 생성한다", () => {
			// Given
			const token = "refresh-token";

			// When
			const hash1 = service.hashRefreshToken(token);
			const hash2 = service.hashRefreshToken(token);

			// Then
			expect(hash1).toBe(hash2);
		});
	});

	describe("generateTokenFamily", () => {
		it("32자 hex 문자열의 토큰 패밀리를 생성한다", () => {
			// Given
			// - 별도 설정 없이 서비스 메서드 호출

			// When
			const family = service.generateTokenFamily();

			// Then
			expect(family).toBeDefined();
			// 16 bytes = 32 hex characters
			expect(family).toMatch(/^[0-9a-f]{32}$/i);
			expect(family.length).toBe(32);
		});
	});

	describe("getRefreshTokenExpiresInSeconds", () => {
		it("리프레시 토큰 만료 시간을 초 단위로 반환한다", () => {
			// Given
			// - beforeEach에서 jwtRefreshExpiresIn: "7d"로 설정됨

			// When
			const seconds = service.getRefreshTokenExpiresInSeconds();

			// Then
			expect(seconds).toBeGreaterThan(0);
		});
	});
});
