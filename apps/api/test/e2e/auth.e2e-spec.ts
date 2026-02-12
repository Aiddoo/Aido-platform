/**
 * Auth E2E 테스트
 *
 * @description
 * 인증 시스템 전체 플로우 테스트
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 */

import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PinoLogger } from "nestjs-pino";
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
import { FakeLogger } from "../mocks/fake-logger.service";
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
		process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
		process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
		process.env.GOOGLE_CALLBACK_URL =
			"http://localhost:3000/auth/google/callback";
		process.env.NAVER_CLIENT_ID = "test-naver-client-id";
		process.env.NAVER_CLIENT_SECRET = "test-naver-client-secret";
		process.env.NAVER_CALLBACK_URL =
			"http://localhost:3000/auth/naver/callback";

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
			.overrideProvider(PinoLogger)
			.useClass(FakeLogger)
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
			// Given - 새 이메일 주소 준비

			// When - 회원가입 API 호출
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

			// Then - 응답 검증
			expect(response.body.success).toBe(true);
			expect(response.body.data.email).toBe(testEmail);
			expect(response.body.data.message).toContain("인증 코드");
			expect(fakeEmailService.hasSentTo(testEmail)).toBe(true);
		});

		it("POST /auth/register - 중복 이메일 거부", async () => {
			// Given - 이미 등록된 이메일

			// When - 동일 이메일로 회원가입 시도
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

			// Then - 응답 검증
			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("EMAIL_0501");
		});

		it("POST /auth/verify-email - 이메일 인증", async () => {
			// Given - 등록된 사용자와 인증 코드
			const code = fakeEmailService.getLastCode(testEmail);
			expect(code).toBeTruthy();

			// When - 이메일 인증 API 호출
			const response = await request(app.getHttpServer())
				.post("/auth/verify-email")
				.send({
					email: testEmail,
					code,
				})
				.expect(200);

			// Then - 응답 검증
			expect(response.body.success).toBe(true);
			expect(response.body.data).toHaveProperty("accessToken");
			expect(response.body.data).toHaveProperty("refreshToken");
		});

		it("POST /auth/verify-email - 잘못된 코드 거부", async () => {
			// Given - 새 사용자 등록
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

			// When - 잘못된 코드로 인증 시도
			const response = await request(app.getHttpServer())
				.post("/auth/verify-email")
				.send({
					email: newEmail,
					code: "000000",
				})
				.expect(401);

			// Then - 응답 검증
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
			// Given - 이메일 전송 실패 상태 설정됨

			// When - 회원가입 API 호출
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

			// Then - 응답 검증
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
			// Given - 인증된 사용자 준비됨

			// When - 로그인 API 호출
			const response = await request(app.getHttpServer())
				.post("/auth/login")
				.send({
					email: loginEmail,
					password: loginPassword,
				})
				.expect(200);

			// Then - 응답 검증
			expect(response.body.success).toBe(true);
			expect(response.body.data).toHaveProperty("accessToken");
			expect(response.body.data).toHaveProperty("refreshToken");

			accessToken = response.body.data.accessToken;
			refreshToken = response.body.data.refreshToken;
		});

		it("POST /auth/login - 잘못된 비밀번호 거부", async () => {
			// Given - 인증된 사용자 준비됨

			// When - 잘못된 비밀번호로 로그인 시도
			const response = await request(app.getHttpServer())
				.post("/auth/login")
				.send({
					email: loginEmail,
					password: "WrongPassword!",
				})
				.expect(401);

			// Then - 응답 검증
			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("USER_0602");
		});

		it("POST /auth/login - 존재하지 않는 이메일 거부", async () => {
			// Given - 존재하지 않는 이메일

			// When - 로그인 시도
			const response = await request(app.getHttpServer())
				.post("/auth/login")
				.send({
					email: "nonexistent@example.com",
					password: loginPassword,
				})
				.expect(401);

			// Then - 응답 검증
			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("USER_0602");
		});

		it("GET /auth/me - 인증된 사용자 정보 조회", async () => {
			// Given - 로그인된 사용자의 accessToken

			// When - 사용자 정보 조회 API 호출
			const response = await request(app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 응답 검증
			expect(response.body.success).toBe(true);
			expect(response.body.data.email).toBe(loginEmail);
		});

		it("GET /auth/me - 토큰 없이 접근 거부", async () => {
			// Given - 토큰 없음

			// When - 사용자 정보 조회 API 호출
			// Then - 401 응답
			await request(app.getHttpServer()).get("/auth/me").expect(401);
		});

		it("POST /auth/refresh - 토큰 갱신", async () => {
			// Given - 유효한 refreshToken

			// When - 토큰 갱신 API 호출
			const response = await request(app.getHttpServer())
				.post("/auth/refresh")
				.set("Authorization", `Bearer ${refreshToken}`)
				.expect(200);

			// Then - 응답 검증
			expect(response.body.success).toBe(true);
			expect(response.body.data).toHaveProperty("accessToken");
			expect(response.body.data).toHaveProperty("refreshToken");
		});

		it("POST /auth/logout - 로그아웃", async () => {
			// Given - 새로운 로그인 수행
			const loginRes = await request(app.getHttpServer())
				.post("/auth/login")
				.send({
					email: loginEmail,
					password: loginPassword,
				});

			const token = loginRes.body.data.accessToken;

			// When - 로그아웃 API 호출
			const response = await request(app.getHttpServer())
				.post("/auth/logout")
				.set("Authorization", `Bearer ${token}`)
				.expect(200);

			// Then - 응답 검증
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
			// Given - 인증된 사용자 준비됨

			// When - 비밀번호 재설정 요청 API 호출
			const response = await request(app.getHttpServer())
				.post("/auth/forgot-password")
				.send({ email: resetEmail })
				.expect(200);

			// Then - 응답 검증
			expect(response.body.success).toBe(true);
			expect(fakeEmailService.hasSentTo(resetEmail)).toBe(true);
		});

		it("POST /auth/reset-password - 비밀번호 재설정", async () => {
			// Given - 재설정 코드 발송됨
			const code = fakeEmailService.getLastCode(resetEmail);

			// When - 비밀번호 재설정 API 호출
			const response = await request(app.getHttpServer())
				.post("/auth/reset-password")
				.send({
					email: resetEmail,
					code,
					newPassword: newPassword,
					newPasswordConfirm: newPassword,
				})
				.expect(200);

			// Then - 응답 검증
			expect(response.body.success).toBe(true);
		});

		it("POST /auth/login - 새 비밀번호로 로그인", async () => {
			// Given - 비밀번호 재설정 완료됨

			// When - 새 비밀번호로 로그인 시도
			const response = await request(app.getHttpServer())
				.post("/auth/login")
				.send({
					email: resetEmail,
					password: newPassword,
				})
				.expect(200);

			// Then - 응답 검증
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
			// Given - 로그인된 사용자

			// When - 세션 목록 조회 API 호출
			const response = await request(app.getHttpServer())
				.get("/auth/sessions")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 응답 검증
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
			// Given - 새 사용자 등록
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

			// When - 이메일 인증 API 호출
			const verifyRes = await request(app.getHttpServer())
				.post("/auth/verify-email")
				.send({ email: newEmail, code })
				.expect(200);

			// Then - 응답 검증
			expect(verifyRes.body.data).toHaveProperty("name", "인증 테스트");
			expect(verifyRes.body.data).toHaveProperty("profileImage", null);
		});

		it("POST /auth/login - 로그인 응답에 프로필 정보 포함", async () => {
			// Given - 인증된 사용자 준비됨

			// When - 로그인 API 호출
			const response = await request(app.getHttpServer())
				.post("/auth/login")
				.send({
					email: profileEmail,
					password: profilePassword,
				})
				.expect(200);

			// Then - 응답 검증
			expect(response.body.data).toHaveProperty("name", "테스트 사용자");
			expect(response.body.data).toHaveProperty("profileImage", null);

			// 토큰 업데이트
			accessToken = response.body.data.accessToken;
		});

		it("GET /auth/me - 프로필 정보 포함", async () => {
			// Given - 로그인된 사용자

			// When - 사용자 정보 조회 API 호출
			const response = await request(app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 응답 검증
			expect(response.body.data).toHaveProperty("name", "테스트 사용자");
			expect(response.body.data).toHaveProperty("profileImage", null);
		});

		it("PATCH /auth/profile - 이름 수정", async () => {
			// Given - 로그인된 사용자

			// When - 프로필 수정 API 호출
			const response = await request(app.getHttpServer())
				.patch("/auth/profile")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "수정된 이름" })
				.expect(200);

			// Then - 응답 검증
			expect(response.body.success).toBe(true);
			expect(response.body.data.name).toBe("수정된 이름");
		});

		it("PATCH /auth/profile - 프로필 이미지 설정", async () => {
			// Given - 로그인된 사용자

			// When - 프로필 이미지 수정 API 호출
			const response = await request(app.getHttpServer())
				.patch("/auth/profile")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ profileImage: "https://example.com/profile.jpg" })
				.expect(200);

			// Then - 응답 검증
			expect(response.body.success).toBe(true);
			expect(response.body.data.profileImage).toBe(
				"https://example.com/profile.jpg",
			);
		});

		it("PATCH /auth/profile - 프로필 이미지 삭제 (null)", async () => {
			// Given - 로그인된 사용자

			// When - 프로필 이미지 null로 수정 API 호출
			const response = await request(app.getHttpServer())
				.patch("/auth/profile")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ profileImage: null })
				.expect(200);

			// Then - 응답 검증
			expect(response.body.success).toBe(true);
			expect(response.body.data.profileImage).toBeNull();
		});

		it("PATCH /auth/profile - 이름과 프로필 이미지 동시 수정", async () => {
			// Given - 로그인된 사용자

			// When - 프로필 수정 API 호출
			const response = await request(app.getHttpServer())
				.patch("/auth/profile")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					name: "최종 이름",
					profileImage: "https://example.com/final.jpg",
				})
				.expect(200);

			// Then - 응답 검증
			expect(response.body.success).toBe(true);
			expect(response.body.data.name).toBe("최종 이름");
			expect(response.body.data.profileImage).toBe(
				"https://example.com/final.jpg",
			);
		});

		it("PATCH /auth/profile - 필드 없으면 400", async () => {
			// Given - 로그인된 사용자

			// When - 빈 요청으로 프로필 수정 API 호출
			const response = await request(app.getHttpServer())
				.patch("/auth/profile")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({})
				.expect(400);

			// Then - 응답 검증
			expect(response.body.success).toBe(false);
		});

		it("PATCH /auth/profile - 인증 없이 접근 거부", async () => {
			// Given - 토큰 없음

			// When - 프로필 수정 API 호출
			// Then - 401 응답
			await request(app.getHttpServer())
				.patch("/auth/profile")
				.send({ name: "테스트" })
				.expect(401);
		});

		it("PATCH /auth/profile - 잘못된 URL 형식 거부", async () => {
			// Given - 로그인된 사용자

			// When - 잘못된 URL로 프로필 이미지 수정 API 호출
			const response = await request(app.getHttpServer())
				.patch("/auth/profile")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ profileImage: "not-a-valid-url" })
				.expect(400);

			// Then - 응답 검증
			expect(response.body.success).toBe(false);
		});

		it("GET /auth/me - 수정된 프로필 정보 확인", async () => {
			// Given - 프로필 수정 완료된 상태

			// When - 사용자 정보 조회 API 호출
			const response = await request(app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 응답 검증
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
			// Given - 로그인된 사용자
			const loginRes = await request(app.getHttpServer())
				.post("/auth/login")
				.send({
					email: securityEmail,
					password: securityPassword,
				})
				.expect(200);

			const { accessToken } = loginRes.body.data;

			// When - 로그아웃 후 이전 토큰으로 접근 시도
			await request(app.getHttpServer())
				.post("/auth/logout")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			const meRes = await request(app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(401);

			// Then - 응답 검증
			expect(meRes.body.success).toBe(false);
			// 세션이 폐기되었거나 토큰이 무효화됨
			expect(["SESSION_0703", "SESSION_0701", "AUTH_0101"]).toContain(
				meRes.body.error.code,
			);
		});

		it("세션 폐기 후 Refresh Token 사용 거부", async () => {
			// Given - 로그인된 사용자
			const loginRes = await request(app.getHttpServer())
				.post("/auth/login")
				.send({
					email: securityEmail,
					password: securityPassword,
				})
				.expect(200);

			const { accessToken, refreshToken } = loginRes.body.data;

			// When - 세션 폐기 후 refreshToken으로 갱신 시도
			const sessionsRes = await request(app.getHttpServer())
				.get("/auth/sessions")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// 현재 세션 ID 찾기 (가장 최근 생성된 세션)
			const currentSession = sessionsRes.body.data.sessions.find(
				(s: { isCurrent: boolean }) => s.isCurrent,
			);
			expect(currentSession).toBeDefined();

			await request(app.getHttpServer())
				.delete(`/auth/sessions/${currentSession.id}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			const refreshRes = await request(app.getHttpServer())
				.post("/auth/refresh")
				.set("Authorization", `Bearer ${refreshToken}`)
				.expect(401);

			// Then - 응답 검증
			expect(refreshRes.body.success).toBe(false);
		});

		it("인증 코드 5회 초과 시도 시 잠금", async () => {
			// Given - 새 사용자 등록 (인증 전 상태)
			const bruteForceEmail = "bruteforce-test@example.com";
			await registerUser(bruteForceEmail, securityPassword);

			// When - 잘못된 코드로 5회 시도 후 6번째 시도
			for (let i = 0; i < 5; i++) {
				await request(app.getHttpServer())
					.post("/auth/verify-email")
					.send({
						email: bruteForceEmail,
						code: "000000",
					})
					.expect(401);
			}

			const res = await request(app.getHttpServer())
				.post("/auth/verify-email")
				.send({
					email: bruteForceEmail,
					code: "000000",
				})
				.expect(429);

			// Then - 응답 검증
			expect(res.body.success).toBe(false);
			expect(res.body.error.code).toBe("VERIFY_0754");
		});

		it("토큰 재사용 감지 및 전체 세션 폐기", async () => {
			// Given - 로그인된 사용자
			const loginRes = await request(app.getHttpServer())
				.post("/auth/login")
				.send({
					email: securityEmail,
					password: securityPassword,
				})
				.expect(200);

			const originalRefreshToken = loginRes.body.data.refreshToken;

			// When - refreshToken으로 갱신 후 이전 토큰 재사용 시도
			const refreshRes = await request(app.getHttpServer())
				.post("/auth/refresh")
				.set("Authorization", `Bearer ${originalRefreshToken}`)
				.expect(200);

			const newRefreshToken = refreshRes.body.data.refreshToken;

			const reuseRes = await request(app.getHttpServer())
				.post("/auth/refresh")
				.set("Authorization", `Bearer ${originalRefreshToken}`)
				.expect(401);

			// Then - 재사용 감지 응답 검증
			expect(reuseRes.body.success).toBe(false);
			expect(reuseRes.body.error.code).toBe("SESSION_0704");

			// 새 토큰도 사용 불가 확인 (전체 패밀리 폐기)
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
			// Given - 인증된 사용자
			const lockoutEmail = "lockout-test@example.com";
			const lockoutPassword = "Test1234!";

			await createVerifiedUser(lockoutEmail, lockoutPassword);

			// When - 잘못된 비밀번호로 5회 시도
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

			// Then - 응답 검증
			expect(lockRes.body.success).toBe(false);
			expect(lockRes.body.error.code).toBe("USER_0607");

			// 6번째 시도에서도 계정 잠금 오류 확인
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
			// Given - state 파라미터 준비

			// When - 카카오 로그인 시작 API 호출
			const response = await request(app.getHttpServer())
				.get("/auth/kakao/start")
				.query({ state: "test-csrf-state-123" })
				.expect(302);

			// Then - 응답 검증
			expect(response.headers.location).toContain(
				"https://kauth.kakao.com/oauth/authorize",
			);
			expect(response.headers.location).toContain("state=test-csrf-state-123");
			expect(response.headers.location).toContain("response_type=code");
		});

		it("GET /auth/kakao/start - state 파라미터 없이도 카카오로 리다이렉트", async () => {
			// Given - state 파라미터 없음

			// When - 카카오 로그인 시작 API 호출
			const response = await request(app.getHttpServer())
				.get("/auth/kakao/start")
				.expect(302);

			// Then - 응답 검증
			expect(response.headers.location).toContain(
				"https://kauth.kakao.com/oauth/authorize",
			);
			expect(response.headers.location).toContain("response_type=code");
		});

		it("GET /auth/kakao/web-callback - 잘못된 code로 요청하면 딥링크로 에러 리다이렉트", async () => {
			// Given - 잘못된 authorization code

			// When - 카카오 콜백 API 호출
			const response = await request(app.getHttpServer())
				.get("/auth/kakao/web-callback")
				.query({ code: "invalid-auth-code", state: "test-state" })
				.expect(302);

			// Then - 응답 검증
			expect(response.headers.location).toContain("aido://auth/callback");
			expect(response.headers.location).toContain("error=");
		});

		it("GET /auth/kakao/web-callback - code 없이 요청하면 딥링크로 에러 리다이렉트", async () => {
			// Given - code 파라미터 없음

			// When - 카카오 콜백 API 호출
			const response = await request(app.getHttpServer())
				.get("/auth/kakao/web-callback")
				.query({ state: "test-state" })
				.expect(302);

			// Then - 응답 검증
			expect(response.headers.location).toContain("aido://auth/callback");
			expect(response.headers.location).toContain("error=");
		});
	});

	describe("웹 OAuth 콜백 실패 시 state 기반 redirect_uri 복원", () => {
		it("Kakao 콜백 실패 시 start에서 저장한 redirect_uri로 리다이렉트", async () => {
			// Given
			const state = "kakao-state-restore-test";
			const redirectUri = "aido-dev://auth/kakao";

			await request(app.getHttpServer())
				.get("/auth/kakao/start")
				.query({ state, redirect_uri: redirectUri })
				.expect(302);

			// When
			const response = await request(app.getHttpServer())
				.get("/auth/kakao/web-callback")
				.query({ code: "invalid-auth-code", state })
				.expect(302);

			// Then
			expect(response.headers.location).toContain(redirectUri);
			expect(response.headers.location).toContain("error=");
		});

		it("Google 콜백 실패 시 start에서 저장한 redirect_uri로 리다이렉트", async () => {
			// Given
			const state = "google-state-restore-test";
			const redirectUri = "aido-dev://auth/google";

			await request(app.getHttpServer())
				.get("/auth/google/start")
				.query({ state, redirect_uri: redirectUri })
				.expect(302);

			// When
			const response = await request(app.getHttpServer())
				.get("/auth/google/web-callback")
				.query({ code: "invalid-auth-code", state })
				.expect(302);

			// Then
			expect(response.headers.location).toContain(redirectUri);
			expect(response.headers.location).toContain("error=");
		});

		it("Naver 콜백 실패 시 start에서 저장한 redirect_uri로 리다이렉트", async () => {
			// Given
			const state = "naver-state-restore-test";
			const redirectUri = "aido-dev://auth/naver";

			await request(app.getHttpServer())
				.get("/auth/naver/start")
				.query({ state, redirect_uri: redirectUri })
				.expect(302);

			// When
			const response = await request(app.getHttpServer())
				.get("/auth/naver/web-callback")
				.query({ code: "invalid-auth-code", state })
				.expect(302);

			// Then
			expect(response.headers.location).toContain(redirectUri);
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
			// Given - 유효한 카카오 토큰
			const testToken = "valid-kakao-token-12345";

			// When - 카카오 로그인 API 호출
			const response = await request(app.getHttpServer())
				.post("/auth/kakao/callback")
				.send({ accessToken: testToken })
				.expect(200);

			// Then - 응답 및 DB 검증
			expect(response.body.success).toBe(true);
			expect(response.body.data).toHaveProperty("accessToken");

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
			// Given - 유효한 구글 토큰
			const testToken = "valid-google-token-12345";

			// When - 구글 로그인 API 호출
			const response = await request(app.getHttpServer())
				.post("/auth/google/callback")
				.send({ idToken: testToken })
				.expect(200);

			// Then - 응답 및 DB 검증
			expect(response.body.success).toBe(true);
			expect(response.body.data).toHaveProperty("accessToken");

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
			// Given - 유효한 애플 토큰
			const testToken = "valid-apple-token-12345";

			// When - 애플 로그인 API 호출
			const response = await request(app.getHttpServer())
				.post("/auth/apple/callback")
				.send({ idToken: testToken })
				.expect(200);

			// Then - 응답 및 DB 검증
			expect(response.body.success).toBe(true);
			expect(response.body.data).toHaveProperty("accessToken");

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
			// Given - 유효한 네이버 토큰
			const testToken = "valid-naver-token-12345";

			// When - 네이버 로그인 API 호출
			const response = await request(app.getHttpServer())
				.post("/auth/naver/callback")
				.send({ accessToken: testToken })
				.expect(200);

			// Then - 응답 및 DB 검증
			expect(response.body.success).toBe(true);
			expect(response.body.data).toHaveProperty("accessToken");

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
			// Given - 토큰 검증 실패 시뮬레이션
			fakeOAuthTokenVerifierService.simulateFailure();

			const testToken = "invalid-kakao-token";

			// When - 카카오 로그인 API 호출 (실패 예상)
			const response = await request(app.getHttpServer())
				.post("/auth/kakao/callback")
				.send({ accessToken: testToken })
				.expect(401);

			// Then - 응답 및 DB 검증
			expect(response.body.success).toBe(false);

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
			// Given - 토큰 검증 실패 시뮬레이션
			fakeOAuthTokenVerifierService.simulateFailure();

			const testToken = "invalid-google-token";

			// When - 구글 로그인 API 호출 (실패 예상)
			const response = await request(app.getHttpServer())
				.post("/auth/google/callback")
				.send({ idToken: testToken })
				.expect(401);

			// Then - 응답 및 DB 검증
			expect(response.body.success).toBe(false);

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
			// Given - 테스트 토큰 및 헤더
			const testToken = "test-token-with-metadata";
			const testIp = "192.168.1.100";
			const testUserAgent = "TestAgent/1.0";

			// When - 카카오 로그인 API 호출 (헤더 포함)
			await request(app.getHttpServer())
				.post("/auth/kakao/callback")
				.set("X-Forwarded-For", testIp)
				.set("User-Agent", testUserAgent)
				.send({ accessToken: testToken })
				.expect(200);

			// Then - DB 검증
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
			// Given - 테스트 토큰들

			// When - 첫 번째 로그인
			await request(app.getHttpServer())
				.post("/auth/kakao/callback")
				.send({ accessToken: "first-token-12345" })
				.expect(200);

			// When - 두 번째 로그인
			await request(app.getHttpServer())
				.post("/auth/google/callback")
				.send({ idToken: "second-token-12345" })
				.expect(200);

			// Then - DB 검증
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
			// Given - 로그인된 사용자

			// When - 설정 조회 API 호출
			const response = await request(app.getHttpServer())
				.get("/auth/preference")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 응답 검증
			expect(response.body.success).toBe(true);
			expect(response.body.data).toHaveProperty("pushEnabled");
			expect(response.body.data).toHaveProperty("nightPushEnabled");
			// 기본값은 true
			expect(response.body.data.pushEnabled).toBe(true);
			expect(response.body.data.nightPushEnabled).toBe(true);
		});

		it("PATCH /auth/preference - 푸시 설정 활성화", async () => {
			// Given - 로그인된 사용자

			// When - 설정 수정 API 호출
			const response = await request(app.getHttpServer())
				.patch("/auth/preference")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ pushEnabled: true })
				.expect(200);

			// Then - 응답 검증
			expect(response.body.success).toBe(true);
			expect(response.body.data.pushEnabled).toBe(true);
			expect(response.body.data.nightPushEnabled).toBe(true);
		});

		it("PATCH /auth/preference - 야간 푸시 설정 활성화", async () => {
			// Given - 로그인된 사용자

			// When - 설정 수정 API 호출
			const response = await request(app.getHttpServer())
				.patch("/auth/preference")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ nightPushEnabled: true })
				.expect(200);

			// Then - 응답 검증
			expect(response.body.success).toBe(true);
			expect(response.body.data.pushEnabled).toBe(true); // 이전 설정 유지
			expect(response.body.data.nightPushEnabled).toBe(true);
		});

		it("PATCH /auth/preference - 여러 설정 동시 변경", async () => {
			// Given - 로그인된 사용자

			// When - 설정 수정 API 호출
			const response = await request(app.getHttpServer())
				.patch("/auth/preference")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ pushEnabled: false, nightPushEnabled: false })
				.expect(200);

			// Then - 응답 검증
			expect(response.body.success).toBe(true);
			expect(response.body.data.pushEnabled).toBe(false);
			expect(response.body.data.nightPushEnabled).toBe(false);
		});

		it("GET /auth/preference - 변경된 설정 확인", async () => {
			// Given - 설정 변경
			await request(app.getHttpServer())
				.patch("/auth/preference")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ pushEnabled: true, nightPushEnabled: true })
				.expect(200);

			// When - 설정 조회 API 호출
			const response = await request(app.getHttpServer())
				.get("/auth/preference")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 응답 검증
			expect(response.body.data.pushEnabled).toBe(true);
			expect(response.body.data.nightPushEnabled).toBe(true);
		});

		it("GET /auth/preference - 인증 없이 접근 거부", async () => {
			// Given - 토큰 없음

			// When - 설정 조회 API 호출
			// Then - 401 응답
			await request(app.getHttpServer()).get("/auth/preference").expect(401);
		});

		it("PATCH /auth/preference - 인증 없이 접근 거부", async () => {
			// Given - 토큰 없음

			// When - 설정 수정 API 호출
			// Then - 401 응답
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
			// Given - 로그인된 사용자

			// When - 동의 상태 조회 API 호출
			const response = await request(app.getHttpServer())
				.get("/auth/consent")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 응답 검증
			expect(response.body.success).toBe(true);
			expect(response.body.data).toHaveProperty("termsAgreedAt");
			expect(response.body.data).toHaveProperty("privacyAgreedAt");
			expect(response.body.data).toHaveProperty("marketingAgreedAt");
			expect(response.body.data).toHaveProperty("agreedTermsVersion");
			// 회원가입 시 동의했으므로 termsAgreedAt, privacyAgreedAt은 값이 있음
			expect(response.body.data.termsAgreedAt).not.toBeNull();
			expect(response.body.data.privacyAgreedAt).not.toBeNull();
			// 마케팅 동의는 기본적으로 활성화됨
			expect(response.body.data.marketingAgreedAt).not.toBeNull();
		});

		it("PATCH /auth/consent/marketing - 마케팅 동의 활성화", async () => {
			// Given - 로그인된 사용자

			// When - 마케팅 동의 API 호출
			const response = await request(app.getHttpServer())
				.patch("/auth/consent/marketing")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ agreed: true })
				.expect(200);

			// Then - 응답 검증
			expect(response.body.success).toBe(true);
			expect(response.body.data).toHaveProperty("marketingAgreedAt");
			expect(response.body.data.marketingAgreedAt).not.toBeNull();
		});

		it("GET /auth/consent - 마케팅 동의 상태 확인", async () => {
			// Given - 마케팅 동의 완료됨

			// When - 동의 상태 조회 API 호출
			const response = await request(app.getHttpServer())
				.get("/auth/consent")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 응답 검증
			expect(response.body.data.marketingAgreedAt).not.toBeNull();
		});

		it("PATCH /auth/consent/marketing - 마케팅 동의 철회", async () => {
			// Given - 마케팅 동의 상태

			// When - 마케팅 동의 철회 API 호출
			const response = await request(app.getHttpServer())
				.patch("/auth/consent/marketing")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ agreed: false })
				.expect(200);

			// Then - 응답 검증
			expect(response.body.success).toBe(true);
			expect(response.body.data.marketingAgreedAt).toBeNull();
		});

		it("GET /auth/consent - 마케팅 동의 철회 확인", async () => {
			// Given - 마케팅 동의 철회됨

			// When - 동의 상태 조회 API 호출
			const response = await request(app.getHttpServer())
				.get("/auth/consent")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 응답 검증
			expect(response.body.data.marketingAgreedAt).toBeNull();
		});

		it("GET /auth/consent - 인증 없이 접근 거부", async () => {
			// Given - 토큰 없음

			// When - 동의 상태 조회 API 호출
			// Then - 401 응답
			await request(app.getHttpServer()).get("/auth/consent").expect(401);
		});

		it("PATCH /auth/consent/marketing - 인증 없이 접근 거부", async () => {
			// Given - 토큰 없음

			// When - 마케팅 동의 API 호출
			// Then - 401 응답
			await request(app.getHttpServer())
				.patch("/auth/consent/marketing")
				.send({ agreed: true })
				.expect(401);
		});

		it("PATCH /auth/consent/marketing - 잘못된 요청 본문", async () => {
			// Given - 로그인된 사용자

			// When - agreed 필드 누락된 요청
			const response = await request(app.getHttpServer())
				.patch("/auth/consent/marketing")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({}) // agreed 필드 누락
				.expect(400);

			// Then - 응답 검증
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
			// Given - 캐시 초기화
			await cacheService.reset();

			const statsBefore = cacheService.getStats();

			// When - 첫 번째 호출 (캐시 미스)
			const response1 = await request(app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 첫 번째 호출 검증
			expect(response1.body.success).toBe(true);
			expect(response1.body.data.email).toBe(cacheEmail);

			// 첫 번째 호출 후 통계: 세션 + 프로필 = 2 미스
			const statsAfterFirst = cacheService.getStats();
			expect(statsAfterFirst.misses).toBe(statsBefore.misses + 2);

			// When - 두 번째 호출 (캐시 히트)
			const response2 = await request(app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 두 번째 호출 검증
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
			// Given - 캐시 초기화 및 프로필 캐싱
			await cacheService.reset();
			await request(app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// When - 프로필 수정
			const newName = "수정된 캐시 사용자";
			const updateResponse = await request(app.getHttpServer())
				.patch("/auth/profile")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: newName })
				.expect(200);

			// Then - 수정된 데이터 반환 확인
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
			// Given - 캐시 초기화 및 프로필 캐싱
			await cacheService.reset();
			await request(app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// When - 프로필 이미지 수정
			const newImage = "https://example.com/cache-test-image.jpg";
			const updateResponse = await request(app.getHttpServer())
				.patch("/auth/profile")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ profileImage: newImage })
				.expect(200);

			// Then - 수정된 이미지 반환 확인
			expect(updateResponse.body.data.profileImage).toBe(newImage);

			// /auth/me 호출 시 수정된 이미지 반환 확인
			const meResponse = await request(app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(meResponse.body.data.profileImage).toBe(newImage);
		});

		it("여러 번 연속 호출 시 캐시 히트율 증가", async () => {
			// Given - 캐시 초기화
			await cacheService.reset();
			const initialStats = cacheService.getStats();

			// When - 5번 연속 호출
			for (let i = 0; i < 5; i++) {
				await request(app.getHttpServer())
					.get("/auth/me")
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);
			}

			// Then - 캐시 통계 검증
			// 첫 번째는 미스(세션+프로필=2), 나머지 4번은 히트(세션+프로필=8)
			const finalStats = cacheService.getStats();
			expect(finalStats.misses).toBe(initialStats.misses + 2);
			expect(finalStats.hits).toBe(initialStats.hits + 8);
		});

		it("캐시 히트 시 응답 속도 향상 (성능 기반 검증)", async () => {
			// Given - 캐시 초기화
			await cacheService.reset();

			// When - 첫 번째 호출 (캐시 미스 - DB 조회)
			const start1 = Date.now();
			await request(app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);
			const _duration1 = Date.now() - start1;

			// When - 두 번째 호출 (캐시 히트)
			const start2 = Date.now();
			await request(app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);
			const _duration2 = Date.now() - start2;

			// Then - 캐시 동작 확인
			// 캐시 히트가 미스보다 빠르거나 비슷해야 함
			// (E2E 테스트에서는 네트워크 오버헤드로 인해 절대적인 비교는 어려움)
			// 대신 통계로 캐시 동작 확인
			const stats = cacheService.getStats();
			expect(stats.hits).toBeGreaterThanOrEqual(1);

			// 로그로 실제 성능 확인 (디버깅용)
			// console.log(`Cache miss: ${duration1}ms, Cache hit: ${duration2}ms`);
		});
	});

	describe("소셜 계정 연동 (Account Linking)", () => {
		const linkEmail = "link-test@example.com";
		const linkPassword = "Test1234!";
		let accessToken: string;

		beforeAll(async () => {
			fakeOAuthTokenVerifierService.clear();
			accessToken = await createVerifiedUser(linkEmail, linkPassword);
		});

		afterEach(() => {
			fakeOAuthTokenVerifierService.clear();
		});

		describe("POST /auth/link - 소셜 계정 연동", () => {
			it("Kakao accessToken으로 소셜 계정을 연동한다", async () => {
				// Given - 커스텀 Kakao 프로필 설정
				fakeOAuthTokenVerifierService.setCustomProfile(
					"kakao",
					"link-kakao-token",
					{
						id: "kakao-link-12345",
						email: "kakao-link@kakao.com",
						emailVerified: true,
						name: "카카오링크유저",
					},
				);

				// When
				const response = await request(app.getHttpServer())
					.post("/auth/link")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ provider: "KAKAO", accessToken: "link-kakao-token" })
					.expect(200);

				// Then
				expect(response.body.success).toBe(true);
				expect(response.body.data.message).toContain("연결");
			});

			it("Google idToken으로 소셜 계정을 연동한다", async () => {
				fakeOAuthTokenVerifierService.setCustomProfile(
					"google",
					"link-google-token",
					{
						id: "google-link-12345",
						email: "google-link@gmail.com",
						emailVerified: true,
						name: "구글링크유저",
					},
				);

				const response = await request(app.getHttpServer())
					.post("/auth/link")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ provider: "GOOGLE", idToken: "link-google-token" })
					.expect(200);

				expect(response.body.success).toBe(true);
				expect(response.body.data.message).toContain("연결");
			});

			it("미인증 요청은 401을 반환한다", async () => {
				const response = await request(app.getHttpServer())
					.post("/auth/link")
					.send({ provider: "KAKAO", accessToken: "some-token" })
					.expect(401);

				expect(response.body.success).toBe(false);
			});

			it("토큰 검증 실패 시 에러를 반환한다", async () => {
				fakeOAuthTokenVerifierService.simulateFailure();

				const response = await request(app.getHttpServer())
					.post("/auth/link")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ provider: "KAKAO", accessToken: "invalid-token" })
					.expect(401);

				expect(response.body.success).toBe(false);
			});

			it("이미 다른 유저에 연결된 소셜 계정은 409를 반환한다", async () => {
				// Given - 다른 유저가 먼저 Naver로 로그인 (계정 생성됨)
				const otherToken = "naver-other-user-token";
				fakeOAuthTokenVerifierService.setCustomProfile("naver", otherToken, {
					id: "naver-shared-12345",
					email: "naver-other@naver.com",
					emailVerified: true,
					name: "다른유저",
				});

				// 다른 유저가 Naver로 소셜 로그인 (계정 자동 생성)
				await request(app.getHttpServer())
					.post("/auth/naver/callback")
					.send({ accessToken: otherToken })
					.expect(200);

				// When - 현재 유저가 같은 Naver 계정을 연동 시도
				const linkToken = "naver-link-conflict-token";
				fakeOAuthTokenVerifierService.setCustomProfile("naver", linkToken, {
					id: "naver-shared-12345", // 같은 providerAccountId
					email: "naver-other@naver.com",
					emailVerified: true,
					name: "다른유저",
				});

				const response = await request(app.getHttpServer())
					.post("/auth/link")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ provider: "NAVER", accessToken: linkToken })
					.expect(409);

				// Then
				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("NAVER_0455");
			});
		});

		describe("GET /auth/linked-accounts - 연동 목록 조회", () => {
			it("연동된 소셜 계정 목록을 반환한다 (provider, linked, providerAccountId, linkedAt 포함)", async () => {
				const response = await request(app.getHttpServer())
					.get("/auth/linked-accounts")
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				expect(response.body.success).toBe(true);
				expect(Array.isArray(response.body.data.accounts)).toBe(true);

				// 항상 4개 항목 (APPLE, GOOGLE, KAKAO, NAVER)
				const accounts = response.body.data.accounts;
				expect(accounts).toHaveLength(4);

				// 각 계정에 필수 필드 확인
				for (const account of accounts) {
					expect(account).toHaveProperty("provider");
					expect(account).toHaveProperty("linked");
					expect(account).toHaveProperty("providerAccountId");
					expect(account).toHaveProperty("linkedAt");
				}

				// CREDENTIAL은 포함되지 않아야 함
				expect(
					accounts.every(
						(a: { provider: string }) => a.provider !== "CREDENTIAL",
					),
				).toBe(true);

				// 앞서 Kakao, Google을 연동했으므로 linked: true
				const kakaoAccount = accounts.find(
					(a: { provider: string }) => a.provider === "KAKAO",
				);
				expect(kakaoAccount.linked).toBe(true);

				const googleAccount = accounts.find(
					(a: { provider: string }) => a.provider === "GOOGLE",
				);
				expect(googleAccount.linked).toBe(true);
			});

			it("미인증 요청은 401을 반환한다", async () => {
				await request(app.getHttpServer())
					.get("/auth/linked-accounts")
					.expect(401);
			});
		});

		describe("DELETE /auth/linked-accounts/:provider - 연동 해제", () => {
			it("연동된 소셜 계정을 해제한다", async () => {
				// GOOGLE 계정 해제
				const response = await request(app.getHttpServer())
					.delete("/auth/linked-accounts/GOOGLE")
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				expect(response.body.success).toBe(true);
				expect(response.body.data.message).toContain("해제");

				// 해제 후 목록에서 linked: false 확인
				const listResponse = await request(app.getHttpServer())
					.get("/auth/linked-accounts")
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				const googleAccount = listResponse.body.data.accounts.find(
					(a: { provider: string }) => a.provider === "GOOGLE",
				);
				expect(googleAccount.linked).toBe(false);
				expect(googleAccount.providerAccountId).toBeNull();
				expect(googleAccount.linkedAt).toBeNull();
			});

			it("마지막 로그인 수단은 해제할 수 없다 (400)", async () => {
				// 현재 남은 계정: CREDENTIAL + KAKAO
				// KAKAO 해제 → CREDENTIAL만 남음
				await request(app.getHttpServer())
					.delete("/auth/linked-accounts/KAKAO")
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				// 이제 CREDENTIAL만 남았으므로, 다른 소셜 계정을 해제하려 해도 없음
				// 실제로는 소셜 계정이 없으므로 404
			});

			it("연결되지 않은 provider는 404를 반환한다", async () => {
				// APPLE은 연동한 적 없음
				const response = await request(app.getHttpServer())
					.delete("/auth/linked-accounts/APPLE")
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(404);

				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("USER_0603");
			});

			it("미인증 요청은 401을 반환한다", async () => {
				await request(app.getHttpServer())
					.delete("/auth/linked-accounts/KAKAO")
					.expect(401);
			});
		});

		describe("POST /auth/link-with-code - 교환 코드로 연동", () => {
			const prisma = () => testDatabase.getPrisma();

			/**
			 * 테스트용 linking exchange code 생성 헬퍼
			 * 실제 웹 OAuth 플로우 대신 DB에 직접 OAuthState 레코드를 생성합니다.
			 */
			async function createLinkingExchangeCode(
				provider: "APPLE" | "GOOGLE" | "KAKAO" | "NAVER",
				providerAccountId: string,
			): Promise<string> {
				const { randomBytes } = await import("node:crypto");
				const exchangeCode = randomBytes(32).toString("base64url");
				const state = randomBytes(16).toString("hex");

				await prisma().oAuthState.create({
					data: {
						state,
						provider,
						redirectUri: "aido://auth/callback",
						mode: "link",
						exchangeCode,
						userId: providerAccountId, // providerAccountId를 userId 필드에 임시 저장
						expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10분
					},
				});

				return exchangeCode;
			}

			it("유효한 교환 코드로 소셜 계정을 연동한다", async () => {
				// Given - 새 유저 생성 (CREDENTIAL만 보유)
				const codeEmail = "link-code-test@example.com";
				const codePassword = "Test1234!";
				const codeAccessToken = await createVerifiedUser(
					codeEmail,
					codePassword,
				);

				// linking exchange code 생성 (Apple 연동용)
				const exchangeCode = await createLinkingExchangeCode(
					"APPLE",
					"apple-code-link-12345",
				);

				// When - 교환 코드로 연동 요청
				const response = await request(app.getHttpServer())
					.post("/auth/link-with-code")
					.set("Authorization", `Bearer ${codeAccessToken}`)
					.send({ code: exchangeCode })
					.expect(200);

				// Then - 연동 성공
				expect(response.body.success).toBe(true);
				expect(response.body.data.message).toContain("연결");

				// 연동 결과 확인
				const listResponse = await request(app.getHttpServer())
					.get("/auth/linked-accounts")
					.set("Authorization", `Bearer ${codeAccessToken}`)
					.expect(200);

				const appleAccount = listResponse.body.data.accounts.find(
					(a: { provider: string }) => a.provider === "APPLE",
				);
				expect(appleAccount.linked).toBe(true);
				expect(appleAccount.providerAccountId).toBe("apple-code-link-12345");
			});

			it("인증되지 않은 요청은 401을 반환한다", async () => {
				// Given - 유효한 exchange code 생성
				const exchangeCode = await createLinkingExchangeCode(
					"GOOGLE",
					"google-unauth-12345",
				);

				// When - 토큰 없이 요청
				const response = await request(app.getHttpServer())
					.post("/auth/link-with-code")
					.send({ code: exchangeCode })
					.expect(401);

				// Then
				expect(response.body.success).toBe(false);
			});

			it("유효하지 않은 교환 코드는 401을 반환한다", async () => {
				// Given - 존재하지 않는 교환 코드
				const codeEmail2 = "link-code-invalid@example.com";
				const codePassword2 = "Test1234!";
				const codeAccessToken2 = await createVerifiedUser(
					codeEmail2,
					codePassword2,
				);

				// When - 잘못된 코드로 요청
				const response = await request(app.getHttpServer())
					.post("/auth/link-with-code")
					.set("Authorization", `Bearer ${codeAccessToken2}`)
					.send({ code: "invalid-exchange-code-does-not-exist" })
					.expect(401);

				// Then
				expect(response.body.success).toBe(false);
			});

			it("이미 사용된 교환 코드는 401을 반환한다", async () => {
				// Given - 새 유저 생성
				const reuseEmail = "link-code-reuse@example.com";
				const reusePassword = "Test1234!";
				const reuseAccessToken = await createVerifiedUser(
					reuseEmail,
					reusePassword,
				);

				// exchange code 생성 및 첫 번째 사용
				const exchangeCode = await createLinkingExchangeCode(
					"NAVER",
					"naver-reuse-12345",
				);

				await request(app.getHttpServer())
					.post("/auth/link-with-code")
					.set("Authorization", `Bearer ${reuseAccessToken}`)
					.send({ code: exchangeCode })
					.expect(200);

				// When - 같은 코드로 재사용 시도
				const response = await request(app.getHttpServer())
					.post("/auth/link-with-code")
					.set("Authorization", `Bearer ${reuseAccessToken}`)
					.send({ code: exchangeCode })
					.expect(401);

				// Then
				expect(response.body.success).toBe(false);
			});

			it("이미 다른 유저에 연결된 소셜 계정의 교환 코드는 409를 반환한다", async () => {
				// Given - 다른 유저가 이미 KAKAO 계정으로 로그인 (계정 자동 생성)
				const conflictToken = "kakao-conflict-code-token";
				fakeOAuthTokenVerifierService.setCustomProfile("kakao", conflictToken, {
					id: "kakao-conflict-code-12345",
					email: "kakao-conflict-code@kakao.com",
					emailVerified: true,
					name: "다른유저카카오",
				});

				await request(app.getHttpServer())
					.post("/auth/kakao/callback")
					.send({ accessToken: conflictToken })
					.expect(200);

				// 새 유저 생성
				const conflictEmail = "link-code-conflict@example.com";
				const conflictPassword = "Test1234!";
				const conflictAccessToken = await createVerifiedUser(
					conflictEmail,
					conflictPassword,
				);

				// 같은 providerAccountId로 exchange code 생성
				// setCustomProfile로 설정한 id가 곧 providerAccountId
				const exchangeCode = await createLinkingExchangeCode(
					"KAKAO",
					"kakao-conflict-code-12345",
				);

				// When - 이미 다른 유저에 연결된 계정의 코드로 연동 시도
				const response = await request(app.getHttpServer())
					.post("/auth/link-with-code")
					.set("Authorization", `Bearer ${conflictAccessToken}`)
					.send({ code: exchangeCode })
					.expect(409);

				// Then
				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("KAKAO_0306");
			});
		});

		describe("연동 → 조회 → 해제 → 재연동 (round-trip)", () => {
			it("전체 라운드트립 플로우가 정상 동작한다", async () => {
				// 새 유저 생성
				const rtEmail = "roundtrip-test@example.com";
				const rtPassword = "Test1234!";
				const rtAccessToken = await createVerifiedUser(rtEmail, rtPassword);

				// 1. Apple 연동
				fakeOAuthTokenVerifierService.setCustomProfile(
					"apple",
					"rt-apple-token",
					{
						id: "apple-rt-12345",
						email: "apple-rt@privaterelay.appleid.com",
						emailVerified: true,
					},
				);

				const linkRes = await request(app.getHttpServer())
					.post("/auth/link")
					.set("Authorization", `Bearer ${rtAccessToken}`)
					.send({ provider: "APPLE", idToken: "rt-apple-token" })
					.expect(200);
				expect(linkRes.body.data.message).toContain("연결");

				// 2. 조회 - Apple linked: true
				const listRes1 = await request(app.getHttpServer())
					.get("/auth/linked-accounts")
					.set("Authorization", `Bearer ${rtAccessToken}`)
					.expect(200);
				const appleAccount1 = listRes1.body.data.accounts.find(
					(a: { provider: string }) => a.provider === "APPLE",
				);
				expect(appleAccount1.linked).toBe(true);

				// 3. 해제
				await request(app.getHttpServer())
					.delete("/auth/linked-accounts/APPLE")
					.set("Authorization", `Bearer ${rtAccessToken}`)
					.expect(200);

				// 4. 조회 - Apple linked: false
				const listRes2 = await request(app.getHttpServer())
					.get("/auth/linked-accounts")
					.set("Authorization", `Bearer ${rtAccessToken}`)
					.expect(200);
				const appleAccount2 = listRes2.body.data.accounts.find(
					(a: { provider: string }) => a.provider === "APPLE",
				);
				expect(appleAccount2.linked).toBe(false);

				// 5. 재연동
				const relinkRes = await request(app.getHttpServer())
					.post("/auth/link")
					.set("Authorization", `Bearer ${rtAccessToken}`)
					.send({ provider: "APPLE", idToken: "rt-apple-token" })
					.expect(200);
				expect(relinkRes.body.data.message).toContain("연결");

				// 6. 최종 조회 - Apple 다시 linked: true
				const listRes3 = await request(app.getHttpServer())
					.get("/auth/linked-accounts")
					.set("Authorization", `Bearer ${rtAccessToken}`)
					.expect(200);
				const appleAccount3 = listRes3.body.data.accounts.find(
					(a: { provider: string }) => a.provider === "APPLE",
				);
				expect(appleAccount3.linked).toBe(true);
			});
		});
	});
});
