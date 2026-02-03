/**
 * TokenService 테스트 (Suites 패턴)
 *
 * NestJS 공식 권장 Suites 라이브러리 사용
 * - 자동 Mock 생성으로 보일러플레이트 제거
 * - Given/When/Then 패턴으로 테스트 구조화
 *
 * 주의: JwtService는 외부 라이브러리이므로 수동 mock 필요
 *
 * @see https://docs.nestjs.com/recipes/suites
 */

import { JwtService } from "@nestjs/jwt";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { TypedConfigService } from "@/common/config/services/config.service";
import { TokenService } from "./token.service";

describe("TokenService", () => {
	let service: TokenService;
	let jwtService: Mocked<JwtService>;
	let configService: Mocked<TypedConfigService>;

	// 테스트용 설정 값
	const mockConfig = {
		jwtSecret: "test-jwt-secret-at-least-32-chars",
		jwtRefreshSecret: "test-refresh-secret-at-least-32-chars",
		jwtExpiresIn: "15m",
		jwtRefreshExpiresIn: "7d",
	};

	beforeEach(async () => {
		// Given - Suites TestBed로 자동 mock 생성
		const { unit, unitRef } = await TestBed.solitary(TokenService).compile();

		service = unit;
		jwtService = unitRef.get(JwtService) as unknown as Mocked<JwtService>;
		configService = unitRef.get(
			TypedConfigService,
		) as unknown as Mocked<TypedConfigService>;

		// JwtService 외부 라이브러리 mock 수동 설정
		jwtService.signAsync.mockImplementation((payload, _options) => {
			return Promise.resolve(`mock-token-${(payload as { sub: string }).sub}`);
		});

		jwtService.verifyAsync.mockImplementation((token, options) => {
			if ((token as string).includes("invalid")) {
				throw new Error("Invalid token");
			}
			// access token 또는 refresh token에 따라 type 반환
			const isRefreshSecret =
				(options as { secret: string })?.secret === mockConfig.jwtRefreshSecret;
			return Promise.resolve({
				sub: "user-id",
				email: "test@example.com",
				role: "USER",
				type: isRefreshSecret ? "refresh" : "access",
				sessionId: "session-id",
				tokenFamily: "family-id",
				tokenVersion: 1,
			});
		});

		// TypedConfigService mock 설정
		Object.defineProperty(configService, "jwtSecret", {
			get: () => mockConfig.jwtSecret,
		});
		Object.defineProperty(configService, "jwtRefreshSecret", {
			get: () => mockConfig.jwtRefreshSecret,
		});
		Object.defineProperty(configService, "jwtExpiresIn", {
			get: () => mockConfig.jwtExpiresIn,
		});
		Object.defineProperty(configService, "jwtRefreshExpiresIn", {
			get: () => mockConfig.jwtRefreshExpiresIn,
		});
	});

	// ============================================
	// generateTokenPair
	// ============================================

	describe("generateTokenPair", () => {
		it("액세스 토큰과 리프레시 토큰 쌍을 생성한다", async () => {
			// Given
			// - beforeEach에서 JwtService mock 설정됨
			const userId = "user-id";
			const email = "test@example.com";
			const sessionId = "session-id";
			const role = "USER" as const;
			const tokenFamily = "family-id";
			const tokenVersion = 1;

			// When
			const result = await service.generateTokenPair(
				userId,
				email,
				sessionId,
				role,
				tokenFamily,
				tokenVersion,
			);

			// Then
			expect(result).toHaveProperty("accessToken");
			expect(result).toHaveProperty("refreshToken");
			expect(result).toHaveProperty("expiresIn");
			expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
		});

		it("tokenFamily를 전달하지 않으면 새로 생성한다", async () => {
			// Given
			const userId = "user-id";
			const email = "test@example.com";
			const sessionId = "session-id";
			const role = "USER" as const;

			// When
			const result = await service.generateTokenPair(
				userId,
				email,
				sessionId,
				role,
			);

			// Then
			expect(result.accessToken).toBeDefined();
			expect(result.refreshToken).toBeDefined();
		});
	});

	// ============================================
	// verifyAccessToken
	// ============================================

	describe("verifyAccessToken", () => {
		it("유효한 액세스 토큰을 검증하여 페이로드를 반환한다", async () => {
			// Given
			// - beforeEach에서 유효한 토큰 검증 mock 설정됨
			const validToken = "valid-token";

			// When
			const result = await service.verifyAccessToken(validToken);

			// Then
			expect(result).toBeDefined();
			expect(result?.sub).toBe("user-id");
			expect(result?.type).toBe("access");
		});

		it("유효하지 않은 토큰이면 null을 반환한다", async () => {
			// Given
			// - beforeEach에서 "invalid" 포함 토큰은 에러 발생하도록 설정됨
			const invalidToken = "invalid-token";

			// When
			const result = await service.verifyAccessToken(invalidToken);

			// Then
			expect(result).toBeNull();
		});
	});

	// ============================================
	// verifyRefreshToken
	// ============================================

	describe("verifyRefreshToken", () => {
		it("유효한 리프레시 토큰을 검증하여 페이로드를 반환한다", async () => {
			// Given
			// - beforeEach에서 유효한 토큰 검증 mock 설정됨
			const validToken = "valid-token";

			// When
			const result = await service.verifyRefreshToken(validToken);

			// Then
			expect(result).toBeDefined();
			expect(result?.sub).toBe("user-id");
			expect(result?.type).toBe("refresh");
		});

		it("유효하지 않은 토큰이면 null을 반환한다", async () => {
			// Given
			// - beforeEach에서 "invalid" 포함 토큰은 에러 발생하도록 설정됨
			const invalidToken = "invalid-token";

			// When
			const result = await service.verifyRefreshToken(invalidToken);

			// Then
			expect(result).toBeNull();
		});
	});

	// ============================================
	// hashRefreshToken
	// ============================================

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

		it("다른 토큰은 다른 해시를 생성한다", () => {
			// Given
			const token1 = "refresh-token-1";
			const token2 = "refresh-token-2";

			// When
			const hash1 = service.hashRefreshToken(token1);
			const hash2 = service.hashRefreshToken(token2);

			// Then
			expect(hash1).not.toBe(hash2);
		});
	});

	// ============================================
	// generateTokenFamily
	// ============================================

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

		it("매번 고유한 토큰 패밀리를 생성한다", () => {
			// Given
			// - 별도 설정 없이 서비스 메서드 호출

			// When
			const family1 = service.generateTokenFamily();
			const family2 = service.generateTokenFamily();

			// Then
			expect(family1).not.toBe(family2);
		});
	});

	// ============================================
	// getRefreshTokenExpiresInSeconds
	// ============================================

	describe("getRefreshTokenExpiresInSeconds", () => {
		it("리프레시 토큰 만료 시간을 초 단위로 반환한다", () => {
			// Given
			// - beforeEach에서 jwtRefreshExpiresIn: "7d"로 설정됨

			// When
			const seconds = service.getRefreshTokenExpiresInSeconds();

			// Then
			expect(seconds).toBeGreaterThan(0);
			// 7일 = 7 * 24 * 60 * 60 = 604800초
			expect(seconds).toBe(604800);
		});
	});
});
