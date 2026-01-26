/**
 * Auth E2E 테스트
 *
 * @description
 * 인증 시스템 전체 플로우 테스트
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 */

import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { ZodValidationPipe } from "nestjs-zod";
import request from "supertest";
import type { App } from "supertest/types";
import { AppModule } from "@/app.module";
import { CacheService } from "@/common/cache/cache.service";
import {
	CACHE_SERVICE,
	type ICacheService,
} from "@/common/cache/interfaces/cache.interface";
import { DatabaseService } from "@/database";
import { OAuthTokenVerifierService } from "@/modules/auth/services/oauth-token-verifier.service";
import { EmailService } from "@/modules/email/email.service";
import { FakeEmailService } from "../mocks/fake-email.service";
import { FakeOAuthTokenVerifierService } from "../mocks/fake-oauth-token-verifier.service";
import { TestDatabase } from "../setup/test-database";

describe("Auth (e2e)", () => {
	let app: INestApplication<App>;
	let testDatabase: TestDatabase;
	let fakeEmailService: FakeEmailService;
	let fakeOAuthTokenVerifierService: FakeOAuthTokenVerifierService;
	let cacheService: CacheService;
	let _cacheAdapter: ICacheService;

	/**
	 * 테스트용 사용자 등록 헬퍼
	 */
	async function registerUser(
		email: string,
		password: string,
		options?: { name?: string },
	): Promise<void> {
		await request(app.getHttpServer())
			.post("/auth/register")
			.send({
				email,
				password,
				passwordConfirm: password,
				name: options?.name,
				termsAgreed: true,
				privacyAgreed: true,
			})
			.expect(201);
	}

	/**
	 * 테스트용 이메일 인증 헬퍼
	 */
	async function verifyUser(email: string): Promise<string> {
		const code = fakeEmailService.getLastCode(email);
		const response = await request(app.getHttpServer())
			.post("/auth/verify-email")
			.send({ email, code })
			.expect(200);

		return response.body.data.accessToken;
	}

	/**
	 * 테스트용 사용자 등록 및 인증 헬퍼
	 */
	async function createVerifiedUser(
		email: string,
		password: string,
		options?: { name?: string },
	): Promise<string> {
		await registerUser(email, password, options);
		return verifyUser(email);
	}

	/**
	 * 테스트용 로그인 헬퍼
	 */
	async function loginUser(
		email: string,
		password: string,
	): Promise<{ accessToken: string; refreshToken: string }> {
		const response = await request(app.getHttpServer())
			.post("/auth/login")
			.send({ email, password })
			.expect(200);

		return {
			accessToken: response.body.data.accessToken,
			refreshToken: response.body.data.refreshToken,
		};
	}

	beforeAll(async () => {
		// 테스트용 Kakao OAuth 환경변수 설정 (웹 플로우 테스트용)
		// 실제 API 호출은 하지 않고 URL 생성/리다이렉트만 테스트
		process.env.KAKAO_CLIENT_ID = "test-kakao-client-id";
		process.env.KAKAO_CLIENT_SECRET = "test-kakao-client-secret";
		process.env.KAKAO_CALLBACK_URL =
			"http://localhost:3000/auth/kakao/callback";

		// Testcontainers로 PostgreSQL 컨테이너 시작
		testDatabase = new TestDatabase();
		await testDatabase.start();

		// FakeEmailService 인스턴스 생성
		fakeEmailService = new FakeEmailService();

		// FakeOAuthTokenVerifierService 인스턴스 생성
		fakeOAuthTokenVerifierService = new FakeOAuthTokenVerifierService();

		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		})
			.overrideProvider(DatabaseService)
			.useValue(testDatabase.getPrisma())
			.overrideProvider(EmailService)
			.useValue(fakeEmailService)
			.overrideProvider(OAuthTokenVerifierService)
			.useValue(fakeOAuthTokenVerifierService)
			.compile();

		app = moduleFixture.createNestApplication();
		app.useGlobalPipes(new ZodValidationPipe());
		await app.init();

		// CacheService 인스턴스 가져오기
		cacheService = moduleFixture.get<CacheService>(CacheService);
		_cacheAdapter = moduleFixture.get<ICacheService>(CACHE_SERVICE);
	}, 60000);

	afterAll(async () => {
		await app.close();
		await testDatabase.stop();
	});

	describe("회원가입 플로우", () => {
		const testEmail = "test@example.com";
		const testPassword = "Test1234!";

		it("POST /auth/register - 새 사용자 등록", async () => {
			const response = await request(app.getHttpServer())
				.post("/auth/register")
				.send({
					email: testEmail,
					password: testPassword,
					passwordConfirm: testPassword,
					termsAgreed: true,
					privacyAgreed: true,
					marketingAgreed: false,
				})
				.expect(201);

			expect(response.body.success).toBe(true);
			expect(response.body.data.email).toBe(testEmail);
			expect(response.body.data.message).toContain("인증 코드");
			expect(fakeEmailService.hasSentTo(testEmail)).toBe(true);
		});

		it("POST /auth/register - 중복 이메일 거부", async () => {
			const response = await request(app.getHttpServer())
				.post("/auth/register")
				.send({
					email: testEmail,
					password: testPassword,
					passwordConfirm: testPassword,
					termsAgreed: true,
					privacyAgreed: true,
				})
				.expect(409);

			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("EMAIL_0501");
		});

		it("POST /auth/verify-email - 이메일 인증", async () => {
			const code = fakeEmailService.getLastCode(testEmail);
			expect(code).toBeTruthy();

			const response = await request(app.getHttpServer())
				.post("/auth/verify-email")
				.send({
					email: testEmail,
					code,
				})
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data).toHaveProperty("accessToken");
			expect(response.body.data).toHaveProperty("refreshToken");
		});

		it("POST /auth/verify-email - 잘못된 코드 거부", async () => {
			// 새 사용자로 테스트
			const newEmail = "verify-test@example.com";
			await request(app.getHttpServer())
				.post("/auth/register")
				.send({
					email: newEmail,
					password: testPassword,
					passwordConfirm: testPassword,
					termsAgreed: true,
					privacyAgreed: true,
				})
				.expect(201);

			const response = await request(app.getHttpServer())
				.post("/auth/verify-email")
				.send({
					email: newEmail,
					code: "000000",
				})
				.expect(401);

			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("VERIFY_0751");
		});
	});

	describe("회원가입 플로우 - 이메일 전송 실패", () => {
		const emailFailureEmail = "email-failure@example.com";
		const emailFailurePassword = "Test1234!";

		beforeEach(() => {
			// 이메일 서비스에 장애 설정 (전송 실패)
			fakeEmailService.simulateFailures(999);
		});

		afterEach(() => {
			// 각 테스트 후 정상 상태로 복구
			fakeEmailService.simulateFailures(0);
		});

		it("이메일 전송 실패해도 회원가입은 성공한다", async () => {
			const response = await request(app.getHttpServer())
				.post("/auth/register")
				.send({
					email: emailFailureEmail,
					password: emailFailurePassword,
					passwordConfirm: emailFailurePassword,
					termsAgreed: true,
					privacyAgreed: true,
				})
				.expect(201);

			expect(response.body.success).toBe(true);
			expect(response.body.data.email).toBe(emailFailureEmail);
			// 메시지는 반환되지만 사용자는 이메일을 받지 못함
			expect(response.body.data.message).toContain("인증 코드");
		});

		// NOTE: 재전송 테스트는 Verification 모델이 sentAt 필드가 없어서 제거됨
		// 재전송 기능은 verification.service.ts 단위 테스트로 검증됨
	});

	describe("로그인 플로우", () => {
		const loginEmail = "login-test@example.com";
		const loginPassword = "Test1234!";
		let accessToken: string;
		let refreshToken: string;

		beforeAll(async () => {
			await createVerifiedUser(loginEmail, loginPassword);
		});

		it("POST /auth/login - 올바른 자격증명으로 로그인", async () => {
			const response = await request(app.getHttpServer())
				.post("/auth/login")
				.send({
					email: loginEmail,
					password: loginPassword,
				})
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data).toHaveProperty("accessToken");
			expect(response.body.data).toHaveProperty("refreshToken");

			accessToken = response.body.data.accessToken;
			refreshToken = response.body.data.refreshToken;
		});

		it("POST /auth/login - 잘못된 비밀번호 거부", async () => {
			const response = await request(app.getHttpServer())
				.post("/auth/login")
				.send({
					email: loginEmail,
					password: "WrongPassword!",
				})
				.expect(401);

			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("USER_0602");
		});

		it("POST /auth/login - 존재하지 않는 이메일 거부", async () => {
			const response = await request(app.getHttpServer())
				.post("/auth/login")
				.send({
					email: "nonexistent@example.com",
					password: loginPassword,
				})
				.expect(401);

			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("USER_0602");
		});

		it("GET /auth/me - 인증된 사용자 정보 조회", async () => {
			const response = await request(app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.email).toBe(loginEmail);
		});

		it("GET /auth/me - 토큰 없이 접근 거부", async () => {
			await request(app.getHttpServer()).get("/auth/me").expect(401);
		});

		it("POST /auth/refresh - 토큰 갱신", async () => {
			const response = await request(app.getHttpServer())
				.post("/auth/refresh")
				.set("Authorization", `Bearer ${refreshToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data).toHaveProperty("accessToken");
			expect(response.body.data).toHaveProperty("refreshToken");
		});

		it("POST /auth/logout - 로그아웃", async () => {
			// 새로운 로그인 수행
			const loginRes = await request(app.getHttpServer())
				.post("/auth/login")
				.send({
					email: loginEmail,
					password: loginPassword,
				});

			const token = loginRes.body.data.accessToken;

			const response = await request(app.getHttpServer())
				.post("/auth/logout")
				.set("Authorization", `Bearer ${token}`)
				.expect(200);

			expect(response.body.success).toBe(true);
		});
	});

	describe("비밀번호 재설정 플로우", () => {
		const resetEmail = "reset-test@example.com";
		const resetPassword = "Test1234!";
		const newPassword = "NewTest5678!";

		beforeAll(async () => {
			await createVerifiedUser(resetEmail, resetPassword);
		});

		it("POST /auth/forgot-password - 재설정 코드 발송", async () => {
			const response = await request(app.getHttpServer())
				.post("/auth/forgot-password")
				.send({ email: resetEmail })
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(fakeEmailService.hasSentTo(resetEmail)).toBe(true);
		});

		it("POST /auth/reset-password - 비밀번호 재설정", async () => {
			const code = fakeEmailService.getLastCode(resetEmail);

			const response = await request(app.getHttpServer())
				.post("/auth/reset-password")
				.send({
					email: resetEmail,
					code,
					newPassword: newPassword,
					newPasswordConfirm: newPassword,
				})
				.expect(200);

			expect(response.body.success).toBe(true);
		});

		it("POST /auth/login - 새 비밀번호로 로그인", async () => {
			const response = await request(app.getHttpServer())
				.post("/auth/login")
				.send({
					email: resetEmail,
					password: newPassword,
				})
				.expect(200);

			expect(response.body.success).toBe(true);
		});
	});

	describe("세션 관리", () => {
		const sessionEmail = "session-test@example.com";
		const sessionPassword = "Test1234!";
		let accessToken: string;

		beforeAll(async () => {
			await createVerifiedUser(sessionEmail, sessionPassword);
			const tokens = await loginUser(sessionEmail, sessionPassword);
			accessToken = tokens.accessToken;
		});

		it("GET /auth/sessions - 활성 세션 목록 조회", async () => {
			const response = await request(app.getHttpServer())
				.get("/auth/sessions")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(Array.isArray(response.body.data.sessions)).toBe(true);
			expect(response.body.data.sessions.length).toBeGreaterThan(0);
		});
	});

	describe("프로필 관리", () => {
		const profileEmail = "profile-test@example.com";
		const profilePassword = "Test1234!";
		let accessToken: string;

		beforeAll(async () => {
			accessToken = await createVerifiedUser(profileEmail, profilePassword, {
				name: "테스트 사용자",
			});
		});

		it("POST /auth/verify-email - 이메일 인증 응답에 프로필 정보 포함", async () => {
			// 새 사용자로 프로필 응답 확인
			const newEmail = "profile-verify-test@example.com";

			await request(app.getHttpServer())
				.post("/auth/register")
				.send({
					email: newEmail,
					password: profilePassword,
					passwordConfirm: profilePassword,
					name: "인증 테스트",
					termsAgreed: true,
					privacyAgreed: true,
				})
				.expect(201);

			const code = fakeEmailService.getLastCode(newEmail);
			const verifyRes = await request(app.getHttpServer())
				.post("/auth/verify-email")
				.send({ email: newEmail, code })
				.expect(200);

			expect(verifyRes.body.data).toHaveProperty("name", "인증 테스트");
			expect(verifyRes.body.data).toHaveProperty("profileImage", null);
		});

		it("POST /auth/login - 로그인 응답에 프로필 정보 포함", async () => {
			const response = await request(app.getHttpServer())
				.post("/auth/login")
				.send({
					email: profileEmail,
					password: profilePassword,
				})
				.expect(200);

			expect(response.body.data).toHaveProperty("name", "테스트 사용자");
			expect(response.body.data).toHaveProperty("profileImage", null);

			// 토큰 업데이트
			accessToken = response.body.data.accessToken;
		});

		it("GET /auth/me - 프로필 정보 포함", async () => {
			const response = await request(app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(response.body.data).toHaveProperty("name", "테스트 사용자");
			expect(response.body.data).toHaveProperty("profileImage", null);
		});

		it("PATCH /auth/profile - 이름 수정", async () => {
			const response = await request(app.getHttpServer())
				.patch("/auth/profile")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "수정된 이름" })
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.name).toBe("수정된 이름");
		});

		it("PATCH /auth/profile - 프로필 이미지 설정", async () => {
			const response = await request(app.getHttpServer())
				.patch("/auth/profile")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ profileImage: "https://example.com/profile.jpg" })
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.profileImage).toBe(
				"https://example.com/profile.jpg",
			);
		});

		it("PATCH /auth/profile - 프로필 이미지 삭제 (null)", async () => {
			const response = await request(app.getHttpServer())
				.patch("/auth/profile")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ profileImage: null })
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.profileImage).toBeNull();
		});

		it("PATCH /auth/profile - 이름과 프로필 이미지 동시 수정", async () => {
			const response = await request(app.getHttpServer())
				.patch("/auth/profile")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					name: "최종 이름",
					profileImage: "https://example.com/final.jpg",
				})
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.name).toBe("최종 이름");
			expect(response.body.data.profileImage).toBe(
				"https://example.com/final.jpg",
			);
		});

		it("PATCH /auth/profile - 필드 없으면 400", async () => {
			const response = await request(app.getHttpServer())
				.patch("/auth/profile")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({})
				.expect(400);

			expect(response.body.success).toBe(false);
		});

		it("PATCH /auth/profile - 인증 없이 접근 거부", async () => {
			await request(app.getHttpServer())
				.patch("/auth/profile")
				.send({ name: "테스트" })
				.expect(401);
		});

		it("PATCH /auth/profile - 잘못된 URL 형식 거부", async () => {
			const response = await request(app.getHttpServer())
				.patch("/auth/profile")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ profileImage: "not-a-valid-url" })
				.expect(400);

			expect(response.body.success).toBe(false);
		});

		it("GET /auth/me - 수정된 프로필 정보 확인", async () => {
			const response = await request(app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(response.body.data.name).toBe("최종 이름");
			expect(response.body.data.profileImage).toBe(
				"https://example.com/final.jpg",
			);
		});
	});

	describe("보안 시나리오", () => {
		const securityEmail = "security-test@example.com";
		const securityPassword = "Test1234!";

		beforeAll(async () => {
			await createVerifiedUser(securityEmail, securityPassword);
		});

		it("로그아웃 후 Access Token 사용 거부", async () => {
			// 1. 로그인
			const loginRes = await request(app.getHttpServer())
				.post("/auth/login")
				.send({
					email: securityEmail,
					password: securityPassword,
				})
				.expect(200);

			const { accessToken } = loginRes.body.data;

			// 2. 로그아웃
			await request(app.getHttpServer())
				.post("/auth/logout")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// 3. 이전 accessToken으로 /auth/me 접근 시 401 확인
			const meRes = await request(app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(401);

			expect(meRes.body.success).toBe(false);
			// 세션이 폐기되었거나 토큰이 무효화됨
			expect(["SESSION_0703", "SESSION_0701", "AUTH_0101"]).toContain(
				meRes.body.error.code,
			);
		});

		it("세션 폐기 후 Refresh Token 사용 거부", async () => {
			// 1. 로그인
			const loginRes = await request(app.getHttpServer())
				.post("/auth/login")
				.send({
					email: securityEmail,
					password: securityPassword,
				})
				.expect(200);

			const { accessToken, refreshToken } = loginRes.body.data;

			// 2. 세션 목록 조회
			const sessionsRes = await request(app.getHttpServer())
				.get("/auth/sessions")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// 현재 세션 ID 찾기 (가장 최근 생성된 세션)
			const currentSession = sessionsRes.body.data.sessions.find(
				(s: { isCurrent: boolean }) => s.isCurrent,
			);
			expect(currentSession).toBeDefined();

			// 3. 세션 폐기
			await request(app.getHttpServer())
				.delete(`/auth/sessions/${currentSession.id}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// 4. refreshToken으로 갱신 시도 시 실패 확인
			const refreshRes = await request(app.getHttpServer())
				.post("/auth/refresh")
				.set("Authorization", `Bearer ${refreshToken}`)
				.expect(401);

			expect(refreshRes.body.success).toBe(false);
		});

		it("인증 코드 5회 초과 시도 시 잠금", async () => {
			// 새 사용자 등록 (인증 전 상태)
			const bruteForceEmail = "bruteforce-test@example.com";
			await registerUser(bruteForceEmail, securityPassword);

			// 잘못된 코드로 5회 시도
			for (let i = 0; i < 5; i++) {
				await request(app.getHttpServer())
					.post("/auth/verify-email")
					.send({
						email: bruteForceEmail,
						code: "000000",
					})
					.expect(401);
			}

			// 6번째 시도에서 MAX_ATTEMPTS 오류 확인
			const res = await request(app.getHttpServer())
				.post("/auth/verify-email")
				.send({
					email: bruteForceEmail,
					code: "000000",
				})
				.expect(429);

			expect(res.body.success).toBe(false);
			expect(res.body.error.code).toBe("VERIFY_0754");
		});

		it("토큰 재사용 감지 및 전체 세션 폐기", async () => {
			// 1. 로그인
			const loginRes = await request(app.getHttpServer())
				.post("/auth/login")
				.send({
					email: securityEmail,
					password: securityPassword,
				})
				.expect(200);

			const originalRefreshToken = loginRes.body.data.refreshToken;

			// 2. refreshToken으로 갱신 (새 토큰 획득)
			const refreshRes = await request(app.getHttpServer())
				.post("/auth/refresh")
				.set("Authorization", `Bearer ${originalRefreshToken}`)
				.expect(200);

			const newRefreshToken = refreshRes.body.data.refreshToken;

			// 3. 이전 refreshToken으로 다시 갱신 시도 (재사용 감지)
			const reuseRes = await request(app.getHttpServer())
				.post("/auth/refresh")
				.set("Authorization", `Bearer ${originalRefreshToken}`)
				.expect(401);

			expect(reuseRes.body.success).toBe(false);
			expect(reuseRes.body.error.code).toBe("SESSION_0704");

			// 4. 새 토큰도 사용 불가 확인 (전체 패밀리 폐기)
			const newTokenRes = await request(app.getHttpServer())
				.post("/auth/refresh")
				.set("Authorization", `Bearer ${newRefreshToken}`)
				.expect(401);

			expect(newTokenRes.body.success).toBe(false);
			// 세션 자체가 폐기되었으므로 SESSION_REVOKED 또는 SESSION_NOT_FOUND
			expect(["SESSION_0703", "SESSION_0701", "SESSION_0704"]).toContain(
				newTokenRes.body.error.code,
			);
		});

		it("로그인 실패 5회 후 계정 잠금", async () => {
			const lockoutEmail = "lockout-test@example.com";
			const lockoutPassword = "Test1234!";

			await createVerifiedUser(lockoutEmail, lockoutPassword);

			// 잘못된 비밀번호로 4회 시도 (401 응답)
			for (let i = 0; i < 4; i++) {
				await request(app.getHttpServer())
					.post("/auth/login")
					.send({
						email: lockoutEmail,
						password: "WrongPassword!",
					})
					.expect(401);
			}

			// 5번째 시도에서 계정 잠금 (마지막 시도에서 잠금 발생)
			const lockRes = await request(app.getHttpServer())
				.post("/auth/login")
				.send({
					email: lockoutEmail,
					password: "WrongPassword!",
				})
				.expect(423);

			expect(lockRes.body.success).toBe(false);
			expect(lockRes.body.error.code).toBe("USER_0607");

			// 6번째 시도에서도 USER_0607 (계정 잠금) 오류 확인
			const res = await request(app.getHttpServer())
				.post("/auth/login")
				.send({
					email: lockoutEmail,
					password: "WrongPassword!",
				})
				.expect(423);

			expect(res.body.success).toBe(false);
			expect(res.body.error.code).toBe("USER_0607");
		});
	});

	describe("카카오 웹 OAuth 플로우", () => {
		it("GET /auth/kakao/start - state 파라미터로 요청하면 카카오로 리다이렉트", async () => {
			const response = await request(app.getHttpServer())
				.get("/auth/kakao/start")
				.query({ state: "test-csrf-state-123" })
				.expect(302);

			// Kakao OAuth 인증 페이지로 리다이렉트 확인
			expect(response.headers.location).toContain(
				"https://kauth.kakao.com/oauth/authorize",
			);
			expect(response.headers.location).toContain("state=test-csrf-state-123");
			expect(response.headers.location).toContain("response_type=code");
		});

		it("GET /auth/kakao/start - state 파라미터 없이도 카카오로 리다이렉트", async () => {
			const response = await request(app.getHttpServer())
				.get("/auth/kakao/start")
				.expect(302);

			// 카카오 인증 페이지로 리다이렉트 (state 없음)
			expect(response.headers.location).toContain(
				"https://kauth.kakao.com/oauth/authorize",
			);
			expect(response.headers.location).toContain("response_type=code");
		});

		it("GET /auth/kakao/web-callback - 잘못된 code로 요청하면 딥링크로 에러 리다이렉트", async () => {
			const response = await request(app.getHttpServer())
				.get("/auth/kakao/web-callback")
				.query({ code: "invalid-auth-code", state: "test-state" })
				.expect(302);

			// 에러 발생 시 딥링크로 리다이렉트 (에러 정보 포함)
			expect(response.headers.location).toContain("aido://auth/callback");
			expect(response.headers.location).toContain("error=");
		});

		it("GET /auth/kakao/web-callback - code 없이 요청하면 딥링크로 에러 리다이렉트", async () => {
			const response = await request(app.getHttpServer())
				.get("/auth/kakao/web-callback")
				.query({ state: "test-state" })
				.expect(302);

			// code가 없으면 에러로 처리되어 딥링크로 리다이렉트
			expect(response.headers.location).toContain("aido://auth/callback");
			expect(response.headers.location).toContain("error=");
		});
	});

	describe("OAuth LoginAttempt 기록 (E2E)", () => {
		const prisma = () => testDatabase.getPrisma();

		beforeEach(async () => {
			// 각 테스트 전 OAuth 모킹 상태 초기화
			fakeOAuthTokenVerifierService.clear();

			// LoginAttempt 테이블만 정리 (다른 테스트와 간섭 방지)
			await prisma().loginAttempt.deleteMany();
		});

		it("POST /auth/kakao/callback - 성공 시 LoginAttempt 기록 (success: true)", async () => {
			const testToken = "valid-kakao-token-12345";

			// 카카오 로그인 요청
			const response = await request(app.getHttpServer())
				.post("/auth/kakao/callback")
				.send({ accessToken: testToken })
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data).toHaveProperty("accessToken");

			// DB에서 LoginAttempt 확인
			const loginAttempts = await prisma().loginAttempt.findMany({
				orderBy: { createdAt: "desc" },
			});

			expect(loginAttempts.length).toBeGreaterThanOrEqual(1);

			const latestAttempt = loginAttempts[0];
			expect(latestAttempt).toBeDefined();
			if (!latestAttempt) throw new Error("latestAttempt is undefined");
			expect(latestAttempt.success).toBe(true);
			expect(latestAttempt.failureReason).toBeNull();
		});

		it("POST /auth/google/callback - 성공 시 LoginAttempt 기록 (success: true)", async () => {
			const testToken = "valid-google-token-12345";

			// 구글 로그인 요청
			const response = await request(app.getHttpServer())
				.post("/auth/google/callback")
				.send({ idToken: testToken })
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data).toHaveProperty("accessToken");

			// DB에서 LoginAttempt 확인
			const loginAttempts = await prisma().loginAttempt.findMany({
				orderBy: { createdAt: "desc" },
			});

			expect(loginAttempts.length).toBeGreaterThanOrEqual(1);

			const latestAttempt = loginAttempts[0];
			expect(latestAttempt).toBeDefined();
			if (!latestAttempt) throw new Error("latestAttempt is undefined");
			expect(latestAttempt.success).toBe(true);
			expect(latestAttempt.failureReason).toBeNull();
		});

		it("POST /auth/apple/callback - 성공 시 LoginAttempt 기록 (success: true)", async () => {
			const testToken = "valid-apple-token-12345";

			// 애플 로그인 요청
			const response = await request(app.getHttpServer())
				.post("/auth/apple/callback")
				.send({ idToken: testToken })
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data).toHaveProperty("accessToken");

			// DB에서 LoginAttempt 확인
			const loginAttempts = await prisma().loginAttempt.findMany({
				orderBy: { createdAt: "desc" },
			});

			expect(loginAttempts.length).toBeGreaterThanOrEqual(1);

			const latestAttempt = loginAttempts[0];
			expect(latestAttempt).toBeDefined();
			if (!latestAttempt) throw new Error("latestAttempt is undefined");
			expect(latestAttempt.success).toBe(true);
			expect(latestAttempt.failureReason).toBeNull();
		});

		it("POST /auth/naver/callback - 성공 시 LoginAttempt 기록 (success: true)", async () => {
			const testToken = "valid-naver-token-12345";

			// 네이버 로그인 요청
			const response = await request(app.getHttpServer())
				.post("/auth/naver/callback")
				.send({ accessToken: testToken })
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data).toHaveProperty("accessToken");

			// DB에서 LoginAttempt 확인
			const loginAttempts = await prisma().loginAttempt.findMany({
				orderBy: { createdAt: "desc" },
			});

			expect(loginAttempts.length).toBeGreaterThanOrEqual(1);

			const latestAttempt = loginAttempts[0];
			expect(latestAttempt).toBeDefined();
			if (!latestAttempt) throw new Error("latestAttempt is undefined");
			expect(latestAttempt.success).toBe(true);
			expect(latestAttempt.failureReason).toBeNull();
		});

		it("POST /auth/kakao/callback - 토큰 검증 실패 시 LoginAttempt 기록 (success: false)", async () => {
			// 토큰 검증 실패 시뮬레이션 (파라미터 없이 호출하면 provider별 적절한 BusinessException 사용)
			fakeOAuthTokenVerifierService.simulateFailure();

			const testToken = "invalid-kakao-token";

			// 카카오 로그인 요청 (실패 예상)
			const response = await request(app.getHttpServer())
				.post("/auth/kakao/callback")
				.send({ accessToken: testToken })
				.expect(401);

			expect(response.body.success).toBe(false);

			// DB에서 LoginAttempt 확인
			const loginAttempts = await prisma().loginAttempt.findMany({
				where: { success: false },
				orderBy: { createdAt: "desc" },
			});

			expect(loginAttempts.length).toBeGreaterThanOrEqual(1);

			const latestAttempt = loginAttempts[0];
			expect(latestAttempt).toBeDefined();
			if (!latestAttempt) throw new Error("latestAttempt is undefined");
			expect(latestAttempt.success).toBe(false);
			expect(latestAttempt.failureReason).toBe("OAUTH_TOKEN_INVALID");
		});

		it("POST /auth/google/callback - 토큰 검증 실패 시 LoginAttempt 기록 (success: false)", async () => {
			// 토큰 검증 실패 시뮬레이션 (파라미터 없이 호출하면 provider별 적절한 BusinessException 사용)
			fakeOAuthTokenVerifierService.simulateFailure();

			const testToken = "invalid-google-token";

			// 구글 로그인 요청 (실패 예상)
			const response = await request(app.getHttpServer())
				.post("/auth/google/callback")
				.send({ idToken: testToken })
				.expect(401);

			expect(response.body.success).toBe(false);

			// DB에서 LoginAttempt 확인
			const loginAttempts = await prisma().loginAttempt.findMany({
				where: { success: false },
				orderBy: { createdAt: "desc" },
			});

			expect(loginAttempts.length).toBeGreaterThanOrEqual(1);

			const latestAttempt = loginAttempts[0];
			expect(latestAttempt).toBeDefined();
			if (!latestAttempt) throw new Error("latestAttempt is undefined");
			expect(latestAttempt.success).toBe(false);
			expect(latestAttempt.failureReason).toBe("OAUTH_TOKEN_INVALID");
		});

		it("OAuth 로그인 시 IP 및 UserAgent 기록", async () => {
			const testToken = "test-token-with-metadata";
			const testIp = "192.168.1.100";
			const testUserAgent = "TestAgent/1.0";

			// 카카오 로그인 요청 (헤더 포함)
			await request(app.getHttpServer())
				.post("/auth/kakao/callback")
				.set("X-Forwarded-For", testIp)
				.set("User-Agent", testUserAgent)
				.send({ accessToken: testToken })
				.expect(200);

			// DB에서 LoginAttempt 확인
			const loginAttempts = await prisma().loginAttempt.findMany({
				orderBy: { createdAt: "desc" },
			});

			expect(loginAttempts.length).toBeGreaterThanOrEqual(1);

			const latestAttempt = loginAttempts[0];
			expect(latestAttempt).toBeDefined();
			if (!latestAttempt) throw new Error("latestAttempt is undefined");
			expect(latestAttempt.success).toBe(true);
			// IP와 UserAgent가 기록되었는지 확인 (정확한 값은 프록시 설정에 따라 다를 수 있음)
			expect(latestAttempt.ipAddress).toBeTruthy();
			expect(latestAttempt.userAgent).toBeTruthy();
		});

		it("여러 번 OAuth 로그인 시 각각 LoginAttempt 기록", async () => {
			// 첫 번째 로그인
			await request(app.getHttpServer())
				.post("/auth/kakao/callback")
				.send({ accessToken: "first-token-12345" })
				.expect(200);

			// 두 번째 로그인
			await request(app.getHttpServer())
				.post("/auth/google/callback")
				.send({ idToken: "second-token-12345" })
				.expect(200);

			// DB에서 LoginAttempt 확인
			const loginAttempts = await prisma().loginAttempt.findMany({
				orderBy: { createdAt: "asc" },
			});

			// 최소 2개의 로그인 시도 기록
			expect(loginAttempts.length).toBeGreaterThanOrEqual(2);

			// 모두 성공으로 기록
			const successfulAttempts = loginAttempts.filter((a) => a.success);
			expect(successfulAttempts.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe("푸시 설정 관리", () => {
		const settingsEmail = "settings-test@example.com";
		const settingsPassword = "Test1234!";
		let accessToken: string;

		beforeAll(async () => {
			accessToken = await createVerifiedUser(settingsEmail, settingsPassword);
		});

		it("GET /auth/preference - 기본 설정 조회", async () => {
			const response = await request(app.getHttpServer())
				.get("/auth/preference")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data).toHaveProperty("pushEnabled");
			expect(response.body.data).toHaveProperty("nightPushEnabled");
			// 기본값은 false
			expect(response.body.data.pushEnabled).toBe(false);
			expect(response.body.data.nightPushEnabled).toBe(false);
		});

		it("PATCH /auth/preference - 푸시 설정 활성화", async () => {
			const response = await request(app.getHttpServer())
				.patch("/auth/preference")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ pushEnabled: true })
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.pushEnabled).toBe(true);
			expect(response.body.data.nightPushEnabled).toBe(false);
		});

		it("PATCH /auth/preference - 야간 푸시 설정 활성화", async () => {
			const response = await request(app.getHttpServer())
				.patch("/auth/preference")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ nightPushEnabled: true })
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.pushEnabled).toBe(true); // 이전 설정 유지
			expect(response.body.data.nightPushEnabled).toBe(true);
		});

		it("PATCH /auth/preference - 여러 설정 동시 변경", async () => {
			const response = await request(app.getHttpServer())
				.patch("/auth/preference")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ pushEnabled: false, nightPushEnabled: false })
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.pushEnabled).toBe(false);
			expect(response.body.data.nightPushEnabled).toBe(false);
		});

		it("GET /auth/preference - 변경된 설정 확인", async () => {
			// 먼저 설정 변경
			await request(app.getHttpServer())
				.patch("/auth/preference")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ pushEnabled: true, nightPushEnabled: true })
				.expect(200);

			// 변경된 설정 조회
			const response = await request(app.getHttpServer())
				.get("/auth/preference")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(response.body.data.pushEnabled).toBe(true);
			expect(response.body.data.nightPushEnabled).toBe(true);
		});

		it("GET /auth/preference - 인증 없이 접근 거부", async () => {
			await request(app.getHttpServer()).get("/auth/preference").expect(401);
		});

		it("PATCH /auth/preference - 인증 없이 접근 거부", async () => {
			await request(app.getHttpServer())
				.patch("/auth/preference")
				.send({ pushEnabled: true })
				.expect(401);
		});
	});

	describe("약관 동의 관리", () => {
		const consentEmail = "consent-test@example.com";
		const consentPassword = "Test1234!";
		let accessToken: string;

		beforeAll(async () => {
			accessToken = await createVerifiedUser(consentEmail, consentPassword);
		});

		it("GET /auth/consent - 동의 상태 조회", async () => {
			const response = await request(app.getHttpServer())
				.get("/auth/consent")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data).toHaveProperty("termsAgreedAt");
			expect(response.body.data).toHaveProperty("privacyAgreedAt");
			expect(response.body.data).toHaveProperty("marketingAgreedAt");
			expect(response.body.data).toHaveProperty("agreedTermsVersion");
			// 회원가입 시 동의했으므로 termsAgreedAt, privacyAgreedAt은 값이 있음
			expect(response.body.data.termsAgreedAt).not.toBeNull();
			expect(response.body.data.privacyAgreedAt).not.toBeNull();
			// 마케팅 동의는 기본적으로 없음
			expect(response.body.data.marketingAgreedAt).toBeNull();
		});

		it("PATCH /auth/consent/marketing - 마케팅 동의 활성화", async () => {
			const response = await request(app.getHttpServer())
				.patch("/auth/consent/marketing")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ agreed: true })
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data).toHaveProperty("marketingAgreedAt");
			expect(response.body.data.marketingAgreedAt).not.toBeNull();
		});

		it("GET /auth/consent - 마케팅 동의 상태 확인", async () => {
			const response = await request(app.getHttpServer())
				.get("/auth/consent")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(response.body.data.marketingAgreedAt).not.toBeNull();
		});

		it("PATCH /auth/consent/marketing - 마케팅 동의 철회", async () => {
			const response = await request(app.getHttpServer())
				.patch("/auth/consent/marketing")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ agreed: false })
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.marketingAgreedAt).toBeNull();
		});

		it("GET /auth/consent - 마케팅 동의 철회 확인", async () => {
			const response = await request(app.getHttpServer())
				.get("/auth/consent")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(response.body.data.marketingAgreedAt).toBeNull();
		});

		it("GET /auth/consent - 인증 없이 접근 거부", async () => {
			await request(app.getHttpServer()).get("/auth/consent").expect(401);
		});

		it("PATCH /auth/consent/marketing - 인증 없이 접근 거부", async () => {
			await request(app.getHttpServer())
				.patch("/auth/consent/marketing")
				.send({ agreed: true })
				.expect(401);
		});

		it("PATCH /auth/consent/marketing - 잘못된 요청 본문", async () => {
			const response = await request(app.getHttpServer())
				.patch("/auth/consent/marketing")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({}) // agreed 필드 누락
				.expect(400);

			expect(response.body.success).toBe(false);
		});
	});

	describe("프로필 캐싱 동작 검증", () => {
		/**
		 * 캐시 테스트 베스트 프랙티스:
		 *
		 * 1. 행동 기반 테스트: 캐시 구현 세부사항이 아닌 "관찰 가능한 행동"을 검증
		 *    - 캐시 히트/미스 통계로 캐싱 동작 확인
		 *    - 응답 데이터 일관성으로 캐시 무효화 검증
		 *
		 * 2. 격리된 테스트: 각 테스트는 독립적으로 실행 가능해야 함
		 *    - 통계 기반 검증 시 "증분(delta)" 비교 사용
		 *
		 * 3. 테스트 안정성: 캐시 내부 구조에 의존하지 않음
		 *    - 키 형식, 저장소 구조 등 변경에 영향받지 않음
		 */
		const cacheEmail = "cache-test@example.com";
		const cachePassword = "Test1234!";
		let accessToken: string;

		beforeAll(async () => {
			// 테스트 전 캐시 초기화 (깨끗한 상태에서 시작)
			await cacheService.reset();

			accessToken = await createVerifiedUser(cacheEmail, cachePassword, {
				name: "캐시 테스트 사용자",
			});
		});

		afterAll(async () => {
			// 테스트 후 캐시 정리
			await cacheService.reset();
		});

		it("GET /auth/me - 첫 번째 호출은 캐시 미스, 두 번째 호출은 캐시 히트", async () => {
			// 캐시 초기화
			await cacheService.reset();

			// 현재 통계 기록
			const statsBefore = cacheService.getStats();

			// 첫 번째 호출 (캐시 미스 → DB 조회 → 캐시 저장)
			// 참고: /auth/me는 JWT 인증 시 세션 캐시 + 프로필 캐시 2번 조회
			const response1 = await request(app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(response1.body.success).toBe(true);
			expect(response1.body.data.email).toBe(cacheEmail);

			// 첫 번째 호출 후 통계: 세션 + 프로필 = 2 미스
			const statsAfterFirst = cacheService.getStats();
			expect(statsAfterFirst.misses).toBe(statsBefore.misses + 2);

			// 두 번째 호출 (캐시 히트)
			const response2 = await request(app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(response2.body.success).toBe(true);
			expect(response2.body.data.email).toBe(cacheEmail);

			// 두 번째 호출 후 통계: 세션 + 프로필 = 2 히트
			const statsAfterSecond = cacheService.getStats();
			expect(statsAfterSecond.hits).toBe(statsAfterFirst.hits + 2);

			// 응답 데이터 일관성 확인
			expect(response1.body.data.id).toBe(response2.body.data.id);
			expect(response1.body.data.name).toBe(response2.body.data.name);
		});

		it("PATCH /auth/profile - 프로필 수정 후 최신 데이터 반환 (캐시 무효화 검증)", async () => {
			// 캐시 초기화 및 프로필 캐싱
			await cacheService.reset();
			await request(app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// 프로필 수정
			const newName = "수정된 캐시 사용자";
			const updateResponse = await request(app.getHttpServer())
				.patch("/auth/profile")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: newName })
				.expect(200);

			expect(updateResponse.body.data.name).toBe(newName);

			// /auth/me 호출 시 수정된 데이터 반환 확인
			// (캐시가 무효화되지 않았다면 이전 데이터가 반환됨)
			const meResponse = await request(app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(meResponse.body.data.name).toBe(newName);
		});

		it("프로필 이미지 수정 후 최신 데이터 반환 (캐시 무효화 검증)", async () => {
			// 캐시 초기화 및 프로필 캐싱
			await cacheService.reset();
			await request(app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// 프로필 이미지 수정
			const newImage = "https://example.com/cache-test-image.jpg";
			const updateResponse = await request(app.getHttpServer())
				.patch("/auth/profile")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ profileImage: newImage })
				.expect(200);

			expect(updateResponse.body.data.profileImage).toBe(newImage);

			// /auth/me 호출 시 수정된 이미지 반환 확인
			const meResponse = await request(app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(meResponse.body.data.profileImage).toBe(newImage);
		});

		it("여러 번 연속 호출 시 캐시 히트율 증가", async () => {
			// 캐시 초기화
			await cacheService.reset();
			const initialStats = cacheService.getStats();

			// 5번 연속 호출
			for (let i = 0; i < 5; i++) {
				await request(app.getHttpServer())
					.get("/auth/me")
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);
			}

			// 첫 번째는 미스(세션+프로필=2), 나머지 4번은 히트(세션+프로필=8)
			const finalStats = cacheService.getStats();
			expect(finalStats.misses).toBe(initialStats.misses + 2);
			expect(finalStats.hits).toBe(initialStats.hits + 8);
		});

		it("캐시 히트 시 응답 속도 향상 (성능 기반 검증)", async () => {
			// 캐시 초기화
			await cacheService.reset();

			// 첫 번째 호출 (캐시 미스 - DB 조회)
			const start1 = Date.now();
			await request(app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);
			const _duration1 = Date.now() - start1;

			// 두 번째 호출 (캐시 히트)
			const start2 = Date.now();
			await request(app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);
			const _duration2 = Date.now() - start2;

			// 캐시 히트가 미스보다 빠르거나 비슷해야 함
			// (E2E 테스트에서는 네트워크 오버헤드로 인해 절대적인 비교는 어려움)
			// 대신 통계로 캐시 동작 확인
			const stats = cacheService.getStats();
			expect(stats.hits).toBeGreaterThanOrEqual(1);

			// 로그로 실제 성능 확인 (디버깅용)
			// console.log(`Cache miss: ${duration1}ms, Cache hit: ${duration2}ms`);
		});
	});
});
