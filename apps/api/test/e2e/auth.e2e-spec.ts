/**
 * Auth E2E 테스트
 *
 * @description
 * 인증 시스템 전체 플로우 테스트
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 */

import request from "supertest";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import {
	CACHE_SERVICE,
	type ICacheService,
} from "@/shared/infrastructure/cache/interfaces/cache.interface";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";

describe("인증 E2E", () => {
	let ctx: E2eTestContext;
	let cacheService: CacheService;
	let _cacheAdapter: ICacheService;

	beforeAll(async () => {
		ctx = await createE2eApp();

		// CacheService 인스턴스 가져오기
		cacheService = ctx.module.get<CacheService>(CacheService);
		_cacheAdapter = ctx.module.get<ICacheService>(CACHE_SERVICE);
	}, 60000);

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	beforeEach(async () => {
		await ctx.reset();
	});

	describe("회원가입 플로우", () => {
		const testEmail = "test@example.com";
		const testPassword = "Test1234!";

		it("POST /auth/register - 새 사용자 등록", async () => {
			// Given - 새 이메일 주소 준비

			// When - 회원가입 API 호출
			const response = await request(ctx.app.getHttpServer())
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
			expect(ctx.fakeEmailService.hasSentTo(testEmail)).toBe(true);
		});

		it("POST /auth/register - 중복 이메일 거부", async () => {
			// Given - 이미 등록된 이메일
			await request(ctx.app.getHttpServer())
				.post("/auth/register")
				.send({
					email: testEmail,
					password: testPassword,
					passwordConfirm: testPassword,
					termsAgreed: true,
					privacyAgreed: true,
				})
				.expect(201);

			// When - 동일 이메일로 회원가입 시도
			const response = await request(ctx.app.getHttpServer())
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
			await request(ctx.app.getHttpServer())
				.post("/auth/register")
				.send({
					email: testEmail,
					password: testPassword,
					passwordConfirm: testPassword,
					termsAgreed: true,
					privacyAgreed: true,
				})
				.expect(201);

			const code = ctx.fakeEmailService.getLastCode(testEmail);
			expect(code).toBeTruthy();

			// When - 이메일 인증 API 호출
			const response = await request(ctx.app.getHttpServer())
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
			await request(ctx.app.getHttpServer())
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
			const response = await request(ctx.app.getHttpServer())
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

		it("이메일 전송 실패해도 회원가입은 성공한다", async () => {
			// Given - 이메일 전송 실패 상태 설정
			ctx.fakeEmailService.simulateFailures(999);

			// When - 회원가입 API 호출
			const response = await request(ctx.app.getHttpServer())
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
			expect(response.body.data.message).toContain("인증 코드");

			// 정상 상태로 복구
			ctx.fakeEmailService.simulateFailures(0);
		});
	});

	describe("로그인 플로우", () => {
		const loginEmail = "login-test@example.com";
		const loginPassword = "Test1234!";

		it("POST /auth/login - 올바른 자격증명으로 로그인", async () => {
			// Given - 인증된 사용자
			await ctx.helpers.createVerifiedUser(loginEmail, loginPassword);

			// When - 로그인 API 호출
			const response = await request(ctx.app.getHttpServer())
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
		});

		it("POST /auth/login - 잘못된 비밀번호 거부", async () => {
			// Given - 인증된 사용자
			await ctx.helpers.createVerifiedUser(
				"login-wrongpw@example.com",
				loginPassword,
			);

			// When - 잘못된 비밀번호로 로그인 시도
			const response = await request(ctx.app.getHttpServer())
				.post("/auth/login")
				.send({
					email: "login-wrongpw@example.com",
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
			const response = await request(ctx.app.getHttpServer())
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
			// Given - 로그인된 사용자
			await ctx.helpers.createVerifiedUser(
				"me-test@example.com",
				loginPassword,
			);
			const { accessToken } = await ctx.helpers.loginUser(
				"me-test@example.com",
				loginPassword,
			);

			// When - 사용자 정보 조회 API 호출
			const response = await request(ctx.app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 응답 검증
			expect(response.body.success).toBe(true);
			expect(response.body.data.email).toBe("me-test@example.com");
			expect(response.body.data.providers).toContain("CREDENTIAL");
		});

		it("GET /auth/me - 토큰 없이 접근 거부", async () => {
			// Given - 토큰 없음

			// When - 사용자 정보 조회 API 호출
			// Then - 401 응답
			await request(ctx.app.getHttpServer()).get("/auth/me").expect(401);
		});

		it("POST /auth/refresh - 토큰 갱신", async () => {
			// Given - 유효한 refreshToken
			await ctx.helpers.createVerifiedUser(
				"refresh-test@example.com",
				loginPassword,
			);
			const { refreshToken } = await ctx.helpers.loginUser(
				"refresh-test@example.com",
				loginPassword,
			);

			// When - 토큰 갱신 API 호출
			const response = await request(ctx.app.getHttpServer())
				.post("/auth/refresh")
				.set("Authorization", `Bearer ${refreshToken}`)
				.expect(200);

			// Then - 응답 검증
			expect(response.body.success).toBe(true);
			expect(response.body.data).toHaveProperty("accessToken");
			expect(response.body.data).toHaveProperty("refreshToken");
		});

		it("POST /auth/logout - 로그아웃", async () => {
			// Given - 로그인된 사용자
			await ctx.helpers.createVerifiedUser(
				"logout-test@example.com",
				loginPassword,
			);
			const { accessToken } = await ctx.helpers.loginUser(
				"logout-test@example.com",
				loginPassword,
			);

			// When - 로그아웃 API 호출
			const response = await request(ctx.app.getHttpServer())
				.post("/auth/logout")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 응답 검증
			expect(response.body.success).toBe(true);
		});
	});

	describe("비밀번호 재설정 플로우", () => {
		const resetPassword = "Test1234!";
		const newPassword = "NewTest5678!";

		it("비밀번호 재설정 코드 발송 → 재설정 → 새 비밀번호 로그인 → 이전 비밀번호 실패", async () => {
			// Given - 인증된 사용자
			const resetEmail = "reset-test@example.com";
			await ctx.helpers.createVerifiedUser(resetEmail, resetPassword);

			// When - 비밀번호 재설정 요청 API 호출
			const forgotResponse = await request(ctx.app.getHttpServer())
				.post("/auth/forgot-password")
				.send({ email: resetEmail })
				.expect(200);

			// Then - 응답 검증
			expect(forgotResponse.body.success).toBe(true);
			expect(ctx.fakeEmailService.hasSentTo(resetEmail)).toBe(true);

			// When - 비밀번호 재설정 API 호출
			const code = ctx.fakeEmailService.getLastCode(resetEmail);
			const resetResponse = await request(ctx.app.getHttpServer())
				.post("/auth/reset-password")
				.send({
					email: resetEmail,
					code,
					newPassword: newPassword,
					newPasswordConfirm: newPassword,
				})
				.expect(200);

			// Then - 응답 검증
			expect(resetResponse.body.success).toBe(true);

			// When - 새 비밀번호로 로그인 시도
			const loginResponse = await request(ctx.app.getHttpServer())
				.post("/auth/login")
				.send({ email: resetEmail, password: newPassword })
				.expect(200);

			// Then - 응답 검증
			expect(loginResponse.body.success).toBe(true);

			// When - 이전 비밀번호로 로그인 시도
			const oldLoginResponse = await request(ctx.app.getHttpServer())
				.post("/auth/login")
				.send({ email: resetEmail, password: resetPassword })
				.expect(401);

			// Then
			expect(oldLoginResponse.body.success).toBe(false);
		});

		it("POST /auth/forgot-password - 존재하지 않는 이메일도 200 (보안)", async () => {
			// When - 미등록 이메일로 재설정 요청
			const response = await request(ctx.app.getHttpServer())
				.post("/auth/forgot-password")
				.send({ email: "nonexistent-reset@example.com" })
				.expect(200);

			// Then - 동일한 성공 응답 + 이메일 미발송
			expect(response.body.success).toBe(true);
			expect(
				ctx.fakeEmailService.hasSentTo("nonexistent-reset@example.com"),
			).toBe(false);
		});

		it("재설정 후 기존 세션 토큰이 무효화된다", async () => {
			// Given - 새 사용자 생성 후 로그인
			const sessionResetEmail = "session-reset-test@example.com";
			const sessionResetPassword = "Test1234!";
			await ctx.helpers.createVerifiedUser(
				sessionResetEmail,
				sessionResetPassword,
			);
			const { accessToken } = await ctx.helpers.loginUser(
				sessionResetEmail,
				sessionResetPassword,
			);

			// 비밀번호 재설정
			await request(ctx.app.getHttpServer())
				.post("/auth/forgot-password")
				.send({ email: sessionResetEmail })
				.expect(200);

			const code = ctx.fakeEmailService.getLastCode(sessionResetEmail);
			await request(ctx.app.getHttpServer())
				.post("/auth/reset-password")
				.send({
					email: sessionResetEmail,
					code,
					newPassword: "ResetNew5678!",
					newPasswordConfirm: "ResetNew5678!",
				})
				.expect(200);

			// When - 기존 세션의 토큰으로 /auth/me 접근
			const meRes = await request(ctx.app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(401);

			// Then
			expect(meRes.body.success).toBe(false);
		});
	});

	describe("세션 관리", () => {
		it("GET /auth/sessions - 활성 세션 목록 조회", async () => {
			// Given - 로그인된 사용자
			await ctx.helpers.createVerifiedUser(
				"session-test@example.com",
				"Test1234!",
			);
			const { accessToken } = await ctx.helpers.loginUser(
				"session-test@example.com",
				"Test1234!",
			);

			// When - 세션 목록 조회 API 호출
			const response = await request(ctx.app.getHttpServer())
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
		const profilePassword = "Test1234!";

		it("POST /auth/verify-email - 이메일 인증 응답에 프로필 정보 포함", async () => {
			// Given - 새 사용자 등록
			const newEmail = "profile-verify-test@example.com";

			await request(ctx.app.getHttpServer())
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

			const code = ctx.fakeEmailService.getLastCode(newEmail);

			// When - 이메일 인증 API 호출
			const verifyRes = await request(ctx.app.getHttpServer())
				.post("/auth/verify-email")
				.send({ email: newEmail, code })
				.expect(200);

			// Then - 응답 검증
			expect(verifyRes.body.data).toHaveProperty("name", "인증 테스트");
			expect(verifyRes.body.data).toHaveProperty("profileImage", null);
		});

		it("POST /auth/login - 로그인 응답에 프로필 정보 포함", async () => {
			// Given - 인증된 사용자
			await ctx.helpers.createVerifiedUser(
				"profile-login@example.com",
				profilePassword,
				{
					name: "테스트 사용자",
				},
			);

			// When - 로그인 API 호출
			const response = await request(ctx.app.getHttpServer())
				.post("/auth/login")
				.send({
					email: "profile-login@example.com",
					password: profilePassword,
				})
				.expect(200);

			// Then - 응답 검증
			expect(response.body.data).toHaveProperty("name", "테스트 사용자");
			expect(response.body.data).toHaveProperty("profileImage", null);
		});

		it("GET /auth/me - 프로필 정보 포함", async () => {
			// Given - 로그인된 사용자
			const { accessToken } = await ctx.helpers.createVerifiedUser(
				"profile-me@example.com",
				profilePassword,
				{
					name: "테스트 사용자",
				},
			);

			// When - 사용자 정보 조회 API 호출
			const response = await request(ctx.app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 응답 검증
			expect(response.body.data).toHaveProperty("name", "테스트 사용자");
			expect(response.body.data).toHaveProperty("profileImage", null);
			expect(response.body.data.providers).toContain("CREDENTIAL");
		});

		it("프로필 수정 전체 플로우 (이름, 이미지, 아이콘 키)", async () => {
			// Given - 로그인된 사용자
			const { accessToken } = await ctx.helpers.createVerifiedUser(
				"profile-edit@example.com",
				profilePassword,
				{
					name: "원래 이름",
				},
			);

			// When - 이름 수정
			const nameResponse = await request(ctx.app.getHttpServer())
				.patch("/auth/profile")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "수정된 이름" })
				.expect(200);

			// Then
			expect(nameResponse.body.success).toBe(true);
			expect(nameResponse.body.data.name).toBe("수정된 이름");

			// When - 프로필 이미지 설정
			const imageResponse = await request(ctx.app.getHttpServer())
				.patch("/auth/profile")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ profileImage: "https://example.com/profile.jpg" })
				.expect(200);

			// Then
			expect(imageResponse.body.data.profileImage).toBe(
				"https://example.com/profile.jpg",
			);

			// When - 프로필 이미지 삭제 (null)
			const nullImageResponse = await request(ctx.app.getHttpServer())
				.patch("/auth/profile")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ profileImage: null })
				.expect(200);

			// Then
			expect(nullImageResponse.body.data.profileImage).toBeNull();

			// When - 이름과 프로필 이미지 동시 수정
			const bothResponse = await request(ctx.app.getHttpServer())
				.patch("/auth/profile")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					name: "최종 이름",
					profileImage: "https://example.com/final.jpg",
				})
				.expect(200);

			// Then
			expect(bothResponse.body.data.name).toBe("최종 이름");
			expect(bothResponse.body.data.profileImage).toBe(
				"https://example.com/final.jpg",
			);

			// When - 아이콘 키로 프로필 이미지 설정
			const iconResponse = await request(ctx.app.getHttpServer())
				.patch("/auth/profile")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ profileImage: "scottish_fold" })
				.expect(200);

			// Then
			expect(iconResponse.body.data.profileImage).toBe("scottish_fold");

			// When - /auth/me에서 확인
			const meResponse = await request(ctx.app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then
			expect(meResponse.body.data.name).toBe("최종 이름");
			expect(meResponse.body.data.profileImage).toBe("scottish_fold");
		});

		it("PATCH /auth/profile - 필드 없으면 400", async () => {
			// Given - 로그인된 사용자
			const { accessToken } = await ctx.helpers.createVerifiedUser(
				"profile-empty@example.com",
				profilePassword,
			);

			// When - 빈 요청으로 프로필 수정 API 호출
			const response = await request(ctx.app.getHttpServer())
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
			await request(ctx.app.getHttpServer())
				.patch("/auth/profile")
				.send({ name: "테스트" })
				.expect(401);
		});

		it("PATCH /auth/profile - 잘못된 URL 형식 거부", async () => {
			// Given - 로그인된 사용자
			const { accessToken } = await ctx.helpers.createVerifiedUser(
				"profile-badurl@example.com",
				profilePassword,
			);

			// When - 잘못된 URL로 프로필 이미지 수정 API 호출
			const response = await request(ctx.app.getHttpServer())
				.patch("/auth/profile")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ profileImage: "not-a-valid-url" })
				.expect(400);

			// Then - 응답 검증
			expect(response.body.success).toBe(false);
		});
	});

	describe("보안 시나리오", () => {
		const securityPassword = "Test1234!";

		it("로그아웃 후 Access Token 사용 거부", async () => {
			// Given - 로그인된 사용자
			await ctx.helpers.createVerifiedUser(
				"security-logout@example.com",
				securityPassword,
			);
			const loginRes = await request(ctx.app.getHttpServer())
				.post("/auth/login")
				.send({
					email: "security-logout@example.com",
					password: securityPassword,
				})
				.expect(200);

			const { accessToken } = loginRes.body.data;

			// When - 로그아웃 후 이전 토큰으로 접근 시도
			await request(ctx.app.getHttpServer())
				.post("/auth/logout")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			const meRes = await request(ctx.app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(401);

			// Then - 응답 검증
			expect(meRes.body.success).toBe(false);
			expect(["SESSION_0703", "SESSION_0701", "AUTH_0101"]).toContain(
				meRes.body.error.code,
			);
		});

		it("세션 폐기 후 Refresh Token 사용 거부", async () => {
			// Given - 로그인된 사용자
			await ctx.helpers.createVerifiedUser(
				"security-session@example.com",
				securityPassword,
			);
			const loginRes = await request(ctx.app.getHttpServer())
				.post("/auth/login")
				.send({
					email: "security-session@example.com",
					password: securityPassword,
				})
				.expect(200);

			const { accessToken, refreshToken } = loginRes.body.data;

			// When - 세션 폐기 후 refreshToken으로 갱신 시도
			const sessionsRes = await request(ctx.app.getHttpServer())
				.get("/auth/sessions")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			const currentSession = sessionsRes.body.data.sessions.find(
				(s: { isCurrent: boolean }) => s.isCurrent,
			);
			expect(currentSession).toBeDefined();

			await request(ctx.app.getHttpServer())
				.delete(`/auth/sessions/${currentSession.id}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			const refreshRes = await request(ctx.app.getHttpServer())
				.post("/auth/refresh")
				.set("Authorization", `Bearer ${refreshToken}`)
				.expect(401);

			// Then - 응답 검증
			expect(refreshRes.body.success).toBe(false);
		});

		it("인증 코드 5회 초과 시도 시 잠금", async () => {
			// Given - 새 사용자 등록 (인증 전 상태)
			const bruteForceEmail = "bruteforce-test@example.com";
			await ctx.helpers.registerUser(bruteForceEmail, securityPassword);

			// When - 잘못된 코드로 5회 시도 후 6번째 시도
			for (let i = 0; i < 5; i++) {
				await request(ctx.app.getHttpServer())
					.post("/auth/verify-email")
					.send({
						email: bruteForceEmail,
						code: "000000",
					})
					.expect(401);
			}

			const res = await request(ctx.app.getHttpServer())
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

		it("grace period 내 이전 토큰 재시도는 새 토큰을 발급한다", async () => {
			// Given - 로그인된 사용자
			await ctx.helpers.createVerifiedUser(
				"security-reuse@example.com",
				securityPassword,
			);
			const loginRes = await request(ctx.app.getHttpServer())
				.post("/auth/login")
				.send({
					email: "security-reuse@example.com",
					password: securityPassword,
				})
				.expect(200);

			const originalRefreshToken = loginRes.body.data.refreshToken;

			// When - refreshToken으로 갱신
			await request(ctx.app.getHttpServer())
				.post("/auth/refresh")
				.set("Authorization", `Bearer ${originalRefreshToken}`)
				.expect(200);

			// Grace period(10초) 이내 이전 토큰으로 재시도 → 새 토큰 발급
			const graceRetryRes = await request(ctx.app.getHttpServer())
				.post("/auth/refresh")
				.set("Authorization", `Bearer ${originalRefreshToken}`)
				.expect(200);

			// Then - 새 토큰 발급 확인
			expect(graceRetryRes.body.success).toBe(true);
			expect(graceRetryRes.body.data.accessToken).toBeDefined();
			expect(graceRetryRes.body.data.refreshToken).toBeDefined();

			// Sliding window 방지: 동일 이전 토큰으로 3번째 시도 → 거부
			const slidingWindowRes = await request(ctx.app.getHttpServer())
				.post("/auth/refresh")
				.set("Authorization", `Bearer ${originalRefreshToken}`)
				.expect(401);

			expect(slidingWindowRes.body.success).toBe(false);
		});

		it("로그인 실패 5회 후 계정 잠금", async () => {
			// Given - 인증된 사용자
			const lockoutEmail = "lockout-test@example.com";
			await ctx.helpers.createVerifiedUser(lockoutEmail, securityPassword);

			// When - 잘못된 비밀번호로 5회 시도
			for (let i = 0; i < 4; i++) {
				await request(ctx.app.getHttpServer())
					.post("/auth/login")
					.send({ email: lockoutEmail, password: "WrongPassword!" })
					.expect(401);
			}

			// 5번째 시도에서 계정 잠금
			const lockRes = await request(ctx.app.getHttpServer())
				.post("/auth/login")
				.send({ email: lockoutEmail, password: "WrongPassword!" })
				.expect(423);

			// Then - 응답 검증
			expect(lockRes.body.success).toBe(false);
			expect(lockRes.body.error.code).toBe("USER_0607");

			// 6번째 시도에서도 계정 잠금 오류 확인
			const res = await request(ctx.app.getHttpServer())
				.post("/auth/login")
				.send({ email: lockoutEmail, password: "WrongPassword!" })
				.expect(423);

			expect(res.body.success).toBe(false);
			expect(res.body.error.code).toBe("USER_0607");
		});
	});

	describe("카카오 웹 OAuth 플로우", () => {
		it("GET /auth/kakao/start - state 파라미터로 요청하면 카카오로 리다이렉트", async () => {
			// Given - state 파라미터 준비

			// When - 카카오 로그인 시작 API 호출
			const response = await request(ctx.app.getHttpServer())
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
			const response = await request(ctx.app.getHttpServer())
				.get("/auth/kakao/start")
				.expect(302);

			// Then - 응답 검증
			expect(response.headers.location).toContain(
				"https://kauth.kakao.com/oauth/authorize",
			);
			expect(response.headers.location).toContain("response_type=code");
		});

		it("GET /auth/kakao/web-callback - 테스트 fake로 성공하며 외부 요청을 보내지 않는다", async () => {
			// Given - start 단계에서 state와 redirect_uri를 저장
			const state = "kakao-success-state";
			const authorizationCode = "kakao-success-code";
			const exchangedToken = "kakao-success-token";
			const redirectUri = "aido://auth/kakao-success";
			const fetchSpy = jest.spyOn(global, "fetch");

			ctx.fakeOAuthProviderRegistry.setExchangeToken(
				"KAKAO",
				authorizationCode,
				exchangedToken,
			);
			ctx.fakeOAuthTokenVerifierService.setCustomProfile(
				"kakao",
				exchangedToken,
				{
					id: "kakao-web-success-user",
					email: "kakao-web-success@test.com",
					emailVerified: true,
					name: "웹 OAuth 사용자",
				},
			);

			try {
				await request(ctx.app.getHttpServer())
					.get("/auth/kakao/start")
					.query({ state, redirect_uri: redirectUri })
					.expect(302);

				// When - provider의 실제 token endpoint 대신 fake code exchange 실행
				const response = await request(ctx.app.getHttpServer())
					.get("/auth/kakao/web-callback")
					.query({ code: authorizationCode, state })
					.expect(302);

				// Then - 일회용 교환 코드가 반환되고 외부 fetch는 호출되지 않음
				expect(response.headers.location).toBeDefined();
				const location = new URL(response.headers.location ?? "");
				expect(
					`${location.protocol}//${location.host}${location.pathname}`,
				).toBe(redirectUri);
				expect(location.searchParams.get("code")).toBeTruthy();
				expect(location.searchParams.get("state")).toBe(state);
				expect(fetchSpy).not.toHaveBeenCalled();
			} finally {
				fetchSpy.mockRestore();
			}
		});

		it("GET /auth/kakao/web-callback - 잘못된 code로 요청하면 딥링크로 에러 리다이렉트", async () => {
			// Given - 결정적으로 실패하도록 설정한 authorization code
			ctx.fakeOAuthProviderRegistry.simulateExchangeFailure(
				"KAKAO",
				"invalid-auth-code",
			);

			// When - 카카오 콜백 API 호출
			const response = await request(ctx.app.getHttpServer())
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
			const response = await request(ctx.app.getHttpServer())
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
			const redirectUri = "aido://auth/kakao";

			await request(ctx.app.getHttpServer())
				.get("/auth/kakao/start")
				.query({ state, redirect_uri: redirectUri })
				.expect(302);

			// When
			const response = await request(ctx.app.getHttpServer())
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
			const redirectUri = "aido://auth/google";

			await request(ctx.app.getHttpServer())
				.get("/auth/google/start")
				.query({ state, redirect_uri: redirectUri })
				.expect(302);

			// When
			const response = await request(ctx.app.getHttpServer())
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
			const redirectUri = "aido://auth/naver";

			await request(ctx.app.getHttpServer())
				.get("/auth/naver/start")
				.query({ state, redirect_uri: redirectUri })
				.expect(302);

			// When
			const response = await request(ctx.app.getHttpServer())
				.get("/auth/naver/web-callback")
				.query({ code: "invalid-auth-code", state })
				.expect(302);

			// Then
			expect(response.headers.location).toContain(redirectUri);
			expect(response.headers.location).toContain("error=");
		});
	});

	describe("OAuth LoginAttempt 기록 (E2E)", () => {
		const prisma = () => ctx.testDatabase.getPrisma();

		beforeEach(async () => {
			// 각 테스트 전 OAuth 모킹 상태 초기화
			ctx.fakeOAuthTokenVerifierService.clear();

			// LoginAttempt 테이블만 정리 (다른 테스트와 간섭 방지)
			await prisma().loginAttempt.deleteMany();
		});

		it("POST /auth/kakao/callback - 성공 시 LoginAttempt 기록 (success: true)", async () => {
			// Given - 유효한 카카오 토큰
			const testToken = "valid-kakao-token-12345";

			// When - 카카오 로그인 API 호출
			const response = await request(ctx.app.getHttpServer())
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
			const response = await request(ctx.app.getHttpServer())
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
			const response = await request(ctx.app.getHttpServer())
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
			const response = await request(ctx.app.getHttpServer())
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
			ctx.fakeOAuthTokenVerifierService.simulateFailure();
			const testToken = "invalid-kakao-token";

			// When - 카카오 로그인 API 호출 (실패 예상)
			const response = await request(ctx.app.getHttpServer())
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
			ctx.fakeOAuthTokenVerifierService.simulateFailure();
			const testToken = "invalid-google-token";

			// When - 구글 로그인 API 호출 (실패 예상)
			const response = await request(ctx.app.getHttpServer())
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
			await request(ctx.app.getHttpServer())
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
			expect(latestAttempt.ipAddress).toBeTruthy();
			expect(latestAttempt.userAgent).toBeTruthy();
		});

		it("여러 번 OAuth 로그인 시 각각 LoginAttempt 기록", async () => {
			// Given - 테스트 토큰들

			// When - 첫 번째 로그인
			await request(ctx.app.getHttpServer())
				.post("/auth/kakao/callback")
				.send({ accessToken: "first-token-12345" })
				.expect(200);

			// When - 두 번째 로그인
			await request(ctx.app.getHttpServer())
				.post("/auth/google/callback")
				.send({ idToken: "second-token-12345" })
				.expect(200);

			// Then - DB 검증
			const loginAttempts = await prisma().loginAttempt.findMany({
				orderBy: { createdAt: "asc" },
			});

			expect(loginAttempts.length).toBeGreaterThanOrEqual(2);

			const successfulAttempts = loginAttempts.filter((a) => a.success);
			expect(successfulAttempts.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe("푸시 설정 관리", () => {
		const settingsPassword = "Test1234!";

		it("푸시 설정 전체 플로우 (조회 → 수정 → 확인)", async () => {
			// Given - 로그인된 사용자
			const { accessToken, userId } = await ctx.helpers.createVerifiedUser(
				"settings-test@example.com",
				settingsPassword,
			);

			// When - 기본 설정 조회
			const defaultResponse = await request(ctx.app.getHttpServer())
				.get("/auth/preference")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 기본값 검증
			expect(defaultResponse.body.success).toBe(true);
			expect(defaultResponse.body.data.pushEnabled).toBe(true);
			expect(defaultResponse.body.data.nightPushEnabled).toBe(true);

			// When - 푸시 설정 활성화
			const enableResponse = await request(ctx.app.getHttpServer())
				.patch("/auth/preference")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ pushEnabled: true })
				.expect(200);

			// Then
			expect(enableResponse.body.data.pushEnabled).toBe(true);
			expect(enableResponse.body.data.nightPushEnabled).toBe(true);

			// When - 야간 푸시 설정 활성화
			const nightResponse = await request(ctx.app.getHttpServer())
				.patch("/auth/preference")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ nightPushEnabled: true })
				.expect(200);

			// Then
			expect(nightResponse.body.data.pushEnabled).toBe(true);
			expect(nightResponse.body.data.nightPushEnabled).toBe(true);

			// When - 여러 설정 동시 변경
			const multiResponse = await request(ctx.app.getHttpServer())
				.patch("/auth/preference")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ pushEnabled: false, nightPushEnabled: false })
				.expect(200);

			// Then
			expect(multiResponse.body.data.pushEnabled).toBe(false);
			expect(multiResponse.body.data.nightPushEnabled).toBe(false);

			// When - 변경된 설정 확인
			await request(ctx.app.getHttpServer())
				.patch("/auth/preference")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ pushEnabled: true, nightPushEnabled: true })
				.expect(200);

			const finalResponse = await request(ctx.app.getHttpServer())
				.get("/auth/preference")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then
			expect(finalResponse.body.data.pushEnabled).toBe(true);
			expect(finalResponse.body.data.nightPushEnabled).toBe(true);

			// When - 프리미엄 유저로 전환하여 리마인더 시간 변경 테스트
			const prisma = ctx.module.get(DatabaseService);
			const updatedUser = await prisma.user.update({
				where: { id: userId },
				data: { subscriptionStatus: "ACTIVE" },
			});
			await cacheService.invalidateSubscription(updatedUser.id);

			const morningResponse = await request(ctx.app.getHttpServer())
				.patch("/auth/preference")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ morningReminderHour: 8 })
				.expect(200);

			// Then
			expect(morningResponse.body.data.morningReminderHour).toBe(8);

			const eveningResponse = await request(ctx.app.getHttpServer())
				.patch("/auth/preference")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ eveningReminderHour: 18 })
				.expect(200);

			// Then
			expect(eveningResponse.body.data.eveningReminderHour).toBe(18);
		});

		it("GET /auth/preference - 인증 없이 접근 거부", async () => {
			// Given - 토큰 없음
			await request(ctx.app.getHttpServer())
				.get("/auth/preference")
				.expect(401);
		});

		it("PATCH /auth/preference - 인증 없이 접근 거부", async () => {
			// Given - 토큰 없음
			await request(ctx.app.getHttpServer())
				.patch("/auth/preference")
				.send({ pushEnabled: true })
				.expect(401);
		});

		it("PATCH /auth/preference - morningReminderHour 범위 초과 (12) → 400", async () => {
			// Given - 로그인된 사용자
			const { accessToken } = await ctx.helpers.createVerifiedUser(
				"settings-morning@example.com",
				settingsPassword,
			);

			// When - 오전 리마인더에 오후 시간 설정
			await request(ctx.app.getHttpServer())
				.patch("/auth/preference")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ morningReminderHour: 12 })
				.expect(400);
		});

		it("PATCH /auth/preference - eveningReminderHour 범위 미달 (11) → 400", async () => {
			// Given - 로그인된 사용자
			const { accessToken } = await ctx.helpers.createVerifiedUser(
				"settings-evening@example.com",
				settingsPassword,
			);

			// When - 오후 리마인더에 오전 시간 설정
			await request(ctx.app.getHttpServer())
				.patch("/auth/preference")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ eveningReminderHour: 11 })
				.expect(400);
		});
	});

	describe("약관 동의 관리", () => {
		const consentPassword = "Test1234!";

		it("일반 마케팅과 광고성 푸시 동의를 독립적으로 관리한다", async () => {
			// Given - 로그인된 사용자
			const { accessToken } = await ctx.helpers.createVerifiedUser(
				"consent-test@example.com",
				consentPassword,
			);

			// When - 동의 상태 조회
			const initialResponse = await request(ctx.app.getHttpServer())
				.get("/auth/consent")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then
			expect(initialResponse.body.success).toBe(true);
			expect(initialResponse.body.data).toHaveProperty("termsAgreedAt");
			expect(initialResponse.body.data).toHaveProperty("privacyAgreedAt");
			expect(initialResponse.body.data).toHaveProperty("marketingAgreedAt");
			expect(initialResponse.body.data).toHaveProperty("marketingPushAgreedAt");
			expect(initialResponse.body.data).toHaveProperty("agreedTermsVersion");
			expect(initialResponse.body.data.termsAgreedAt).not.toBeNull();
			expect(initialResponse.body.data.privacyAgreedAt).not.toBeNull();
			expect(initialResponse.body.data.marketingAgreedAt).toBeNull();
			expect(initialResponse.body.data.marketingPushAgreedAt).toBeNull();

			// When - 마케팅 동의 활성화
			const enableResponse = await request(ctx.app.getHttpServer())
				.patch("/auth/consent/marketing")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ agreed: true })
				.expect(200);

			// Then
			expect(enableResponse.body.success).toBe(true);
			expect(enableResponse.body.data.marketingAgreedAt).not.toBeNull();

			// When - 일반 마케팅 동의 상태 확인
			const checkResponse = await request(ctx.app.getHttpServer())
				.get("/auth/consent")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then
			expect(checkResponse.body.data.marketingAgreedAt).not.toBeNull();
			expect(checkResponse.body.data.marketingPushAgreedAt).toBeNull();

			// When - 광고성 푸시 동의 활성화
			const enablePushResponse = await request(ctx.app.getHttpServer())
				.patch("/auth/consent/marketing-push")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ agreed: true })
				.expect(200);

			// Then
			expect(enablePushResponse.body.success).toBe(true);
			expect(enablePushResponse.body.data.marketingPushAgreedAt).not.toBeNull();

			// When - 일반 마케팅 동의만 철회
			const revokeResponse = await request(ctx.app.getHttpServer())
				.patch("/auth/consent/marketing")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ agreed: false })
				.expect(200);

			// Then
			expect(revokeResponse.body.success).toBe(true);
			expect(revokeResponse.body.data.marketingAgreedAt).toBeNull();

			// When - 동의 상태를 다시 조회
			const afterMarketingRevokeResponse = await request(
				ctx.app.getHttpServer(),
			)
				.get("/auth/consent")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 광고성 푸시 동의는 일반 마케팅 철회와 독립적으로 유지된다
			expect(
				afterMarketingRevokeResponse.body.data.marketingAgreedAt,
			).toBeNull();
			expect(
				afterMarketingRevokeResponse.body.data.marketingPushAgreedAt,
			).not.toBeNull();

			// When - 광고성 푸시 동의 철회
			const revokePushResponse = await request(ctx.app.getHttpServer())
				.patch("/auth/consent/marketing-push")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ agreed: false })
				.expect(200);

			// Then
			expect(revokePushResponse.body.success).toBe(true);
			expect(revokePushResponse.body.data.marketingPushAgreedAt).toBeNull();

			const finalResponse = await request(ctx.app.getHttpServer())
				.get("/auth/consent")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(finalResponse.body.data.marketingAgreedAt).toBeNull();
			expect(finalResponse.body.data.marketingPushAgreedAt).toBeNull();
		});

		it("GET /auth/consent - 인증 없이 접근 거부", async () => {
			await request(ctx.app.getHttpServer()).get("/auth/consent").expect(401);
		});

		it("PATCH /auth/consent/marketing - 인증 없이 접근 거부", async () => {
			await request(ctx.app.getHttpServer())
				.patch("/auth/consent/marketing")
				.send({ agreed: true })
				.expect(401);
		});

		it("PATCH /auth/consent/marketing-push - 인증 없이 접근 거부", async () => {
			await request(ctx.app.getHttpServer())
				.patch("/auth/consent/marketing-push")
				.send({ agreed: true })
				.expect(401);
		});

		it("PATCH /auth/consent/marketing - 잘못된 요청 본문", async () => {
			// Given - 로그인된 사용자
			const { accessToken } = await ctx.helpers.createVerifiedUser(
				"consent-bad@example.com",
				consentPassword,
			);

			// When - agreed 필드 누락된 요청
			const response = await request(ctx.app.getHttpServer())
				.patch("/auth/consent/marketing")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({})
				.expect(400);

			// Then - 응답 검증
			expect(response.body.success).toBe(false);
		});

		it("PATCH /auth/consent/marketing-push - 잘못된 요청 본문", async () => {
			// Given - 로그인된 사용자
			const { accessToken } = await ctx.helpers.createVerifiedUser(
				"consent-push-bad@example.com",
				consentPassword,
			);

			// When - agreed 필드가 boolean이 아닌 요청
			const response = await request(ctx.app.getHttpServer())
				.patch("/auth/consent/marketing-push")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ agreed: "true" })
				.expect(400);

			// Then
			expect(response.body.success).toBe(false);
		});
	});

	describe("프로필 캐싱 동작 검증", () => {
		const cachePassword = "Test1234!";

		it("GET /auth/me - 첫 번째 호출은 캐시 미스, 두 번째 호출은 캐시 히트", async () => {
			// Given - 캐시 초기화 및 사용자 생성
			await cacheService.reset();
			const { accessToken } = await ctx.helpers.createVerifiedUser(
				"cache-test@example.com",
				cachePassword,
				{
					name: "캐시 테스트 사용자",
				},
			);

			await cacheService.reset();
			const statsBefore = cacheService.getStats();

			// When - 첫 번째 호출 (캐시 미스)
			const response1 = await request(ctx.app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 첫 번째 호출 검증
			expect(response1.body.success).toBe(true);
			expect(response1.body.data.email).toBe("cache-test@example.com");

			const statsAfterFirst = cacheService.getStats();
			expect(statsAfterFirst.misses).toBe(statsBefore.misses + 2);

			// When - 두 번째 호출 (캐시 히트)
			const response2 = await request(ctx.app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 두 번째 호출 검증
			expect(response2.body.success).toBe(true);
			expect(response2.body.data.email).toBe("cache-test@example.com");

			const statsAfterSecond = cacheService.getStats();
			expect(statsAfterSecond.hits).toBe(statsAfterFirst.hits + 2);

			expect(response1.body.data.id).toBe(response2.body.data.id);
			expect(response1.body.data.name).toBe(response2.body.data.name);
		});

		it("PATCH /auth/profile - 프로필 수정 후 최신 데이터 반환 (캐시 무효화 검증)", async () => {
			// Given - 캐시 초기화 및 사용자 생성, 프로필 캐싱
			await cacheService.reset();
			const { accessToken } = await ctx.helpers.createVerifiedUser(
				"cache-invalidate@example.com",
				cachePassword,
				{
					name: "캐시 무효화 사용자",
				},
			);

			await cacheService.reset();
			await request(ctx.app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// When - 프로필 수정
			const newName = "수정된 캐시 사용자";
			const updateResponse = await request(ctx.app.getHttpServer())
				.patch("/auth/profile")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: newName })
				.expect(200);

			// Then - 수정된 데이터 반환 확인
			expect(updateResponse.body.data.name).toBe(newName);

			const meResponse = await request(ctx.app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(meResponse.body.data.name).toBe(newName);
		});

		it("프로필 이미지 수정 후 최신 데이터 반환 (캐시 무효화 검증)", async () => {
			// Given - 캐시 초기화 및 사용자 생성, 프로필 캐싱
			await cacheService.reset();
			const { accessToken } = await ctx.helpers.createVerifiedUser(
				"cache-image@example.com",
				cachePassword,
			);

			await cacheService.reset();
			await request(ctx.app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// When - 프로필 이미지 수정
			const newImage = "https://example.com/cache-test-image.jpg";
			const updateResponse = await request(ctx.app.getHttpServer())
				.patch("/auth/profile")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ profileImage: newImage })
				.expect(200);

			// Then
			expect(updateResponse.body.data.profileImage).toBe(newImage);

			const meResponse = await request(ctx.app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(meResponse.body.data.profileImage).toBe(newImage);
		});

		it("여러 번 연속 호출 시 캐시 히트율 증가", async () => {
			// Given - 캐시 초기화 및 사용자 생성
			await cacheService.reset();
			const { accessToken } = await ctx.helpers.createVerifiedUser(
				"cache-multi@example.com",
				cachePassword,
			);

			await cacheService.reset();
			const initialStats = cacheService.getStats();

			// When - 5번 연속 호출
			for (let i = 0; i < 5; i++) {
				await request(ctx.app.getHttpServer())
					.get("/auth/me")
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);
			}

			// Then - 캐시 통계 검증
			const finalStats = cacheService.getStats();
			expect(finalStats.misses).toBe(initialStats.misses + 2);
			expect(finalStats.hits).toBe(initialStats.hits + 8);
		});

		it("캐시 히트 시 응답 속도 향상 (성능 기반 검증)", async () => {
			// Given - 캐시 초기화 및 사용자 생성
			await cacheService.reset();
			const { accessToken } = await ctx.helpers.createVerifiedUser(
				"cache-perf@example.com",
				cachePassword,
			);

			await cacheService.reset();

			// When - 첫 번째 호출 (캐시 미스)
			const start1 = Date.now();
			await request(ctx.app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);
			const _duration1 = Date.now() - start1;

			// When - 두 번째 호출 (캐시 히트)
			const start2 = Date.now();
			await request(ctx.app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);
			const _duration2 = Date.now() - start2;

			// Then - 캐시 동작 확인
			const stats = cacheService.getStats();
			expect(stats.hits).toBeGreaterThanOrEqual(1);
		});
	});

	describe("소셜 계정 연동 (Account Linking)", () => {
		const linkPassword = "Test1234!";

		it("소셜 계정 연동 → 조회 → 해제 → 재연동 전체 플로우", async () => {
			// Given - 인증된 사용자
			ctx.fakeOAuthTokenVerifierService.clear();
			const { accessToken } = await ctx.helpers.createVerifiedUser(
				"link-test@example.com",
				linkPassword,
			);

			// When - Kakao 연동
			ctx.fakeOAuthTokenVerifierService.setCustomProfile(
				"kakao",
				"link-kakao-token",
				{
					id: "kakao-link-12345",
					email: "kakao-link@kakao.com",
					emailVerified: true,
					name: "카카오링크유저",
				},
			);

			const kakaoResponse = await request(ctx.app.getHttpServer())
				.post("/auth/link")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ provider: "KAKAO", accessToken: "link-kakao-token" })
				.expect(200);

			expect(kakaoResponse.body.success).toBe(true);
			expect(kakaoResponse.body.data.message).toContain("연결");

			// When - Google 연동
			ctx.fakeOAuthTokenVerifierService.setCustomProfile(
				"google",
				"link-google-token",
				{
					id: "google-link-12345",
					email: "google-link@gmail.com",
					emailVerified: true,
					name: "구글링크유저",
				},
			);

			const googleResponse = await request(ctx.app.getHttpServer())
				.post("/auth/link")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ provider: "GOOGLE", idToken: "link-google-token" })
				.expect(200);

			expect(googleResponse.body.success).toBe(true);

			// When - 연동 목록 조회
			const listResponse = await request(ctx.app.getHttpServer())
				.get("/auth/linked-accounts")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(listResponse.body.success).toBe(true);
			expect(Array.isArray(listResponse.body.data.accounts)).toBe(true);
			expect(listResponse.body.data.accounts).toHaveLength(4);

			for (const account of listResponse.body.data.accounts) {
				expect(account).toHaveProperty("provider");
				expect(account).toHaveProperty("linked");
				expect(account).toHaveProperty("providerAccountId");
				expect(account).toHaveProperty("linkedAt");
			}

			expect(
				listResponse.body.data.accounts.every(
					(a: { provider: string }) => a.provider !== "CREDENTIAL",
				),
			).toBe(true);

			const kakaoAccount = listResponse.body.data.accounts.find(
				(a: { provider: string }) => a.provider === "KAKAO",
			);
			expect(kakaoAccount.linked).toBe(true);

			const googleAccount = listResponse.body.data.accounts.find(
				(a: { provider: string }) => a.provider === "GOOGLE",
			);
			expect(googleAccount.linked).toBe(true);

			// When - GOOGLE 계정 해제
			const unlinkResponse = await request(ctx.app.getHttpServer())
				.delete("/auth/linked-accounts/GOOGLE")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(unlinkResponse.body.success).toBe(true);
			expect(unlinkResponse.body.data.message).toContain("해제");

			// Then - 해제 후 확인
			const afterUnlinkResponse = await request(ctx.app.getHttpServer())
				.get("/auth/linked-accounts")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			const unlinkedGoogle = afterUnlinkResponse.body.data.accounts.find(
				(a: { provider: string }) => a.provider === "GOOGLE",
			);
			expect(unlinkedGoogle.linked).toBe(false);
			expect(unlinkedGoogle.providerAccountId).toBeNull();
			expect(unlinkedGoogle.linkedAt).toBeNull();

			ctx.fakeOAuthTokenVerifierService.clear();
		});

		it("미인증 요청은 401을 반환한다", async () => {
			// Given - 토큰 없음
			await request(ctx.app.getHttpServer())
				.post("/auth/link")
				.send({ provider: "KAKAO", accessToken: "some-token" })
				.expect(401);

			await request(ctx.app.getHttpServer())
				.get("/auth/linked-accounts")
				.expect(401);

			await request(ctx.app.getHttpServer())
				.delete("/auth/linked-accounts/KAKAO")
				.expect(401);
		});

		it("토큰 검증 실패 시 에러를 반환한다", async () => {
			// Given - 인증된 사용자, 토큰 검증 실패 시뮬레이션
			ctx.fakeOAuthTokenVerifierService.clear();
			const { accessToken } = await ctx.helpers.createVerifiedUser(
				"link-fail@example.com",
				linkPassword,
			);
			ctx.fakeOAuthTokenVerifierService.simulateFailure();

			// When
			const response = await request(ctx.app.getHttpServer())
				.post("/auth/link")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ provider: "KAKAO", accessToken: "invalid-token" })
				.expect(401);

			// Then
			expect(response.body.success).toBe(false);

			ctx.fakeOAuthTokenVerifierService.clear();
		});

		it("이미 다른 유저에 연결된 소셜 계정은 409를 반환한다", async () => {
			// Given - 다른 유저가 먼저 Naver로 로그인 (계정 생성됨)
			ctx.fakeOAuthTokenVerifierService.clear();
			const { accessToken } = await ctx.helpers.createVerifiedUser(
				"link-conflict@example.com",
				linkPassword,
			);

			const otherToken = "naver-other-user-token";
			ctx.fakeOAuthTokenVerifierService.setCustomProfile("naver", otherToken, {
				id: "naver-shared-12345",
				email: "naver-other@naver.com",
				emailVerified: true,
				name: "다른유저",
			});

			await request(ctx.app.getHttpServer())
				.post("/auth/naver/callback")
				.send({ accessToken: otherToken })
				.expect(200);

			// When - 현재 유저가 같은 Naver 계정을 연동 시도
			const linkToken = "naver-link-conflict-token";
			ctx.fakeOAuthTokenVerifierService.setCustomProfile("naver", linkToken, {
				id: "naver-shared-12345",
				email: "naver-other@naver.com",
				emailVerified: true,
				name: "다른유저",
			});

			const response = await request(ctx.app.getHttpServer())
				.post("/auth/link")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ provider: "NAVER", accessToken: linkToken })
				.expect(409);

			// Then
			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("NAVER_0455");

			ctx.fakeOAuthTokenVerifierService.clear();
		});

		it("연결되지 않은 provider는 404를 반환한다", async () => {
			// Given - 인증된 사용자 (APPLE은 연동한 적 없음)
			ctx.fakeOAuthTokenVerifierService.clear();
			const { accessToken } = await ctx.helpers.createVerifiedUser(
				"link-notfound@example.com",
				linkPassword,
			);

			// When - APPLE 해제 시도
			const response = await request(ctx.app.getHttpServer())
				.delete("/auth/linked-accounts/APPLE")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(404);

			// Then
			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("USER_0603");
		});
	});

	describe("POST /auth/link-with-code - 교환 코드로 연동", () => {
		const prismaFn = () => ctx.testDatabase.getPrisma();
		const linkPassword = "Test1234!";

		async function createLinkingExchangeCode(
			provider: "APPLE" | "GOOGLE" | "KAKAO" | "NAVER",
			providerAccountId: string,
		): Promise<string> {
			const { randomBytes } = await import("node:crypto");
			const exchangeCode = randomBytes(32).toString("base64url");
			const state = randomBytes(16).toString("hex");

			await prismaFn().oAuthState.create({
				data: {
					state,
					provider,
					redirectUri: "aido://auth/callback",
					mode: "link",
					exchangeCode,
					userId: providerAccountId,
					expiresAt: new Date(Date.now() + 10 * 60 * 1000),
				},
			});

			return exchangeCode;
		}

		it("유효한 교환 코드로 소셜 계정을 연동한다", async () => {
			// Given - 새 유저 생성 + exchange code 생성
			const { accessToken } = await ctx.helpers.createVerifiedUser(
				"link-code-test@example.com",
				linkPassword,
			);
			const exchangeCode = await createLinkingExchangeCode(
				"APPLE",
				"apple-code-link-12345",
			);

			// When - 교환 코드로 연동 요청
			const response = await request(ctx.app.getHttpServer())
				.post("/auth/link-with-code")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ code: exchangeCode })
				.expect(200);

			// Then - 연동 성공
			expect(response.body.success).toBe(true);
			expect(response.body.data.message).toContain("연결");

			const listResponse = await request(ctx.app.getHttpServer())
				.get("/auth/linked-accounts")
				.set("Authorization", `Bearer ${accessToken}`)
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
			const response = await request(ctx.app.getHttpServer())
				.post("/auth/link-with-code")
				.send({ code: exchangeCode })
				.expect(401);

			// Then
			expect(response.body.success).toBe(false);
		});

		it("유효하지 않은 교환 코드는 401을 반환한다", async () => {
			// Given - 인증된 사용자
			const { accessToken } = await ctx.helpers.createVerifiedUser(
				"link-code-invalid@example.com",
				linkPassword,
			);

			// When - 잘못된 코드로 요청
			const response = await request(ctx.app.getHttpServer())
				.post("/auth/link-with-code")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ code: "invalid-exchange-code-does-not-exist" })
				.expect(401);

			// Then
			expect(response.body.success).toBe(false);
		});

		it("이미 사용된 교환 코드는 401을 반환한다", async () => {
			// Given - 새 유저 생성 + exchange code 생성 및 첫 번째 사용
			const { accessToken } = await ctx.helpers.createVerifiedUser(
				"link-code-reuse@example.com",
				linkPassword,
			);
			const exchangeCode = await createLinkingExchangeCode(
				"NAVER",
				"naver-reuse-12345",
			);

			await request(ctx.app.getHttpServer())
				.post("/auth/link-with-code")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ code: exchangeCode })
				.expect(200);

			// When - 같은 코드로 재사용 시도
			const response = await request(ctx.app.getHttpServer())
				.post("/auth/link-with-code")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ code: exchangeCode })
				.expect(401);

			// Then
			expect(response.body.success).toBe(false);
		});

		it("이미 다른 유저에 연결된 소셜 계정의 교환 코드는 409를 반환한다", async () => {
			// Given - 다른 유저가 이미 KAKAO 계정으로 로그인
			ctx.fakeOAuthTokenVerifierService.clear();
			const conflictToken = "kakao-conflict-code-token";
			ctx.fakeOAuthTokenVerifierService.setCustomProfile(
				"kakao",
				conflictToken,
				{
					id: "kakao-conflict-code-12345",
					email: "kakao-conflict-code@kakao.com",
					emailVerified: true,
					name: "다른유저카카오",
				},
			);

			await request(ctx.app.getHttpServer())
				.post("/auth/kakao/callback")
				.send({ accessToken: conflictToken })
				.expect(200);

			// 새 유저 생성
			const { accessToken } = await ctx.helpers.createVerifiedUser(
				"link-code-conflict@example.com",
				linkPassword,
			);

			const exchangeCode = await createLinkingExchangeCode(
				"KAKAO",
				"kakao-conflict-code-12345",
			);

			// When - 이미 다른 유저에 연결된 계정의 코드로 연동 시도
			const response = await request(ctx.app.getHttpServer())
				.post("/auth/link-with-code")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ code: exchangeCode })
				.expect(409);

			// Then
			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("KAKAO_0306");

			ctx.fakeOAuthTokenVerifierService.clear();
		});
	});

	describe("연동 → 조회 → 해제 → 재연동 (round-trip)", () => {
		it("전체 라운드트립 플로우가 정상 동작한다", async () => {
			// Given - 새 유저 생성
			ctx.fakeOAuthTokenVerifierService.clear();
			const { accessToken } = await ctx.helpers.createVerifiedUser(
				"roundtrip-test@example.com",
				"Test1234!",
			);

			// When - 1. Apple 연동
			ctx.fakeOAuthTokenVerifierService.setCustomProfile(
				"apple",
				"rt-apple-token",
				{
					id: "apple-rt-12345",
					email: "apple-rt@privaterelay.appleid.com",
					emailVerified: true,
				},
			);

			const linkRes = await request(ctx.app.getHttpServer())
				.post("/auth/link")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ provider: "APPLE", idToken: "rt-apple-token" })
				.expect(200);
			expect(linkRes.body.data.message).toContain("연결");

			// 2. 조회 - Apple linked: true
			const listRes1 = await request(ctx.app.getHttpServer())
				.get("/auth/linked-accounts")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);
			const appleAccount1 = listRes1.body.data.accounts.find(
				(a: { provider: string }) => a.provider === "APPLE",
			);
			expect(appleAccount1.linked).toBe(true);

			// 3. 해제
			await request(ctx.app.getHttpServer())
				.delete("/auth/linked-accounts/APPLE")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// 4. 조회 - Apple linked: false
			const listRes2 = await request(ctx.app.getHttpServer())
				.get("/auth/linked-accounts")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);
			const appleAccount2 = listRes2.body.data.accounts.find(
				(a: { provider: string }) => a.provider === "APPLE",
			);
			expect(appleAccount2.linked).toBe(false);

			// 5. 재연동
			const relinkRes = await request(ctx.app.getHttpServer())
				.post("/auth/link")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ provider: "APPLE", idToken: "rt-apple-token" })
				.expect(200);
			expect(relinkRes.body.data.message).toContain("연결");

			// Then - 6. 최종 조회 - Apple 다시 linked: true
			const listRes3 = await request(ctx.app.getHttpServer())
				.get("/auth/linked-accounts")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);
			const appleAccount3 = listRes3.body.data.accounts.find(
				(a: { provider: string }) => a.provider === "APPLE",
			);
			expect(appleAccount3.linked).toBe(true);

			ctx.fakeOAuthTokenVerifierService.clear();
		});
	});

	describe("회원 탈퇴 플로우", () => {
		it("이메일 계정 탈퇴 → 유예 기간 내 복구 → 유예 기간 초과 차단", async () => {
			// Given - 인증된 사용자
			const deleteEmail = "delete-test@example.com";
			const deletePassword = "Test1234!";
			const { accessToken } = await ctx.helpers.createVerifiedUser(
				deleteEmail,
				deletePassword,
			);

			// When - 탈퇴 API 호출
			const deleteResponse = await request(ctx.app.getHttpServer())
				.delete("/auth/account")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ password: deletePassword })
				.expect(200);

			// Then
			expect(deleteResponse.body.success).toBe(true);
			expect(deleteResponse.body.data.gracePeriodDays).toBe(30);
			expect(deleteResponse.body.data.deletedAt).toBeDefined();

			// When - 탈퇴 후 유예 기간 내 로그인 시 자동 복구
			const restoreResponse = await request(ctx.app.getHttpServer())
				.post("/auth/login")
				.send({ email: deleteEmail, password: deletePassword })
				.expect(200);

			// Then
			expect(restoreResponse.body.success).toBe(true);
			expect(restoreResponse.body.data.accessToken).toBeDefined();
			expect(restoreResponse.body.data.accountRestored).toBe(true);

			// When - 다시 탈퇴 처리 후 유예 기간 초과
			const loginForDelete = await request(ctx.app.getHttpServer())
				.post("/auth/login")
				.send({ email: deleteEmail, password: deletePassword });

			const tokenForDelete = loginForDelete.body.data.accessToken;
			await request(ctx.app.getHttpServer())
				.delete("/auth/account")
				.set("Authorization", `Bearer ${tokenForDelete}`)
				.send({ password: deletePassword })
				.expect(200);

			const prisma = ctx.module.get(DatabaseService);
			await prisma.user.updateMany({
				where: { email: deleteEmail },
				data: {
					deletedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
				},
			});

			// When - 유예 기간 초과 후 로그인 시도
			const expiredResponse = await request(ctx.app.getHttpServer())
				.post("/auth/login")
				.send({ email: deleteEmail, password: deletePassword })
				.expect(410);

			// Then
			expect(expiredResponse.body.error.code).toBe("USER_0606");

			// When - 탈퇴 후 토큰으로 접근 불가
			await request(ctx.app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(401);
		});

		it("DELETE /auth/account - 비밀번호 없이 요청 시 400", async () => {
			// Given - 인증된 사용자
			const { accessToken } = await ctx.helpers.createVerifiedUser(
				"no-pass-delete@example.com",
				"Test1234!",
			);

			// When - 비밀번호 없이 탈퇴 요청
			const response = await request(ctx.app.getHttpServer())
				.delete("/auth/account")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({})
				.expect(400);

			// Then
			expect(response.body.error.code).toBe("USER_0612");
		});

		it("DELETE /auth/account - 잘못된 비밀번호 시 401", async () => {
			// Given - 인증된 사용자
			const { accessToken } = await ctx.helpers.createVerifiedUser(
				"wrong-pass-delete@example.com",
				"Test1234!",
			);

			// When - 잘못된 비밀번호로 탈퇴 요청
			const response = await request(ctx.app.getHttpServer())
				.delete("/auth/account")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ password: "WrongPassword1!" })
				.expect(401);

			// Then
			expect(response.body.error.code).toBe("USER_0602");
		});

		it("DELETE /auth/account - 소셜 전용 계정은 비밀번호 없이 탈퇴", async () => {
			// Given - OAuth로 사용자 생성
			ctx.fakeOAuthTokenVerifierService.clear();
			ctx.fakeOAuthTokenVerifierService.setCustomProfile(
				"google",
				"social-delete-token",
				{
					id: "google-delete-user-123",
					email: "social-delete@example.com",
					emailVerified: true,
					name: "Social Delete User",
				},
			);

			const loginResponse = await request(ctx.app.getHttpServer())
				.post("/auth/google/callback")
				.send({ idToken: "social-delete-token" })
				.expect(200);

			const socialAccessToken = loginResponse.body.data.accessToken;

			// When - 비밀번호 없이 탈퇴
			const deleteResponse = await request(ctx.app.getHttpServer())
				.delete("/auth/account")
				.set("Authorization", `Bearer ${socialAccessToken}`)
				.send({})
				.expect(200);

			// Then
			expect(deleteResponse.body.data.gracePeriodDays).toBe(30);

			ctx.fakeOAuthTokenVerifierService.clear();
		});
	});

	describe("비밀번호 변경 후 세션 폐기", () => {
		it("비밀번호 변경 후 다른 세션의 토큰은 무효화된다", async () => {
			// Given - 사용자 생성 후 두 번 로그인 (두 세션)
			const changePwEmail = "change-pw-session@example.com";
			const changePwPassword = "Test1234!";
			const newPwPassword = "NewTest5678!";

			await ctx.helpers.createVerifiedUser(changePwEmail, changePwPassword);
			const session1 = await ctx.helpers.loginUser(
				changePwEmail,
				changePwPassword,
			);
			const session2 = await ctx.helpers.loginUser(
				changePwEmail,
				changePwPassword,
			);

			// When - session1에서 비밀번호 변경
			await request(ctx.app.getHttpServer())
				.patch("/auth/password")
				.set("Authorization", `Bearer ${session1.accessToken}`)
				.send({
					currentPassword: changePwPassword,
					newPassword: newPwPassword,
					newPasswordConfirm: newPwPassword,
				})
				.expect(200);

			// Then - session2 토큰으로 refresh 시도 시 실패
			await request(ctx.app.getHttpServer())
				.post("/auth/refresh")
				.send({ refreshToken: session2.refreshToken })
				.expect(401);

			// session1은 여전히 유효
			await request(ctx.app.getHttpServer())
				.get("/auth/me")
				.set("Authorization", `Bearer ${session1.accessToken}`)
				.expect(200);
		});

		it("잘못된 현재 비밀번호로 변경 시 에러를 반환한다", async () => {
			// Given - 인증된 사용자
			await ctx.helpers.createVerifiedUser(
				"wrong-current-pw@example.com",
				"Test1234!",
			);
			const { accessToken } = await ctx.helpers.loginUser(
				"wrong-current-pw@example.com",
				"Test1234!",
			);

			// When - 잘못된 현재 비밀번호
			const response = await request(ctx.app.getHttpServer())
				.patch("/auth/password")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					currentPassword: "WrongPassword999!",
					newPassword: "NewTest5678!",
					newPasswordConfirm: "NewTest5678!",
				})
				.expect(401);

			// Then
			expect(response.body.success).toBe(false);
		});

		it("변경 후 새 비밀번호로 로그인할 수 있다", async () => {
			// Given - 비밀번호 변경 완료
			const newLoginEmail = "change-new-login@example.com";
			const originalPw = "Test1234!";
			const changedPw = "Changed5678!";
			await ctx.helpers.createVerifiedUser(newLoginEmail, originalPw);
			const { accessToken } = await ctx.helpers.loginUser(
				newLoginEmail,
				originalPw,
			);

			await request(ctx.app.getHttpServer())
				.patch("/auth/password")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					currentPassword: originalPw,
					newPassword: changedPw,
					newPasswordConfirm: changedPw,
				})
				.expect(200);

			// When - 새 비밀번호로 로그인
			const loginResponse = await request(ctx.app.getHttpServer())
				.post("/auth/login")
				.send({ email: newLoginEmail, password: changedPw })
				.expect(200);

			// Then
			expect(loginResponse.body.success).toBe(true);
			expect(loginResponse.body.data.accessToken).toBeDefined();
		});
	});

	describe("비밀번호 설정 (소셜 사용자)", () => {
		/**
		 * 소셜 전용 사용자 생성 헬퍼
		 */
		async function createSocialUser(
			tokenSuffix: string,
		): Promise<{ accessToken: string; email: string }> {
			const token = `social-setup-${tokenSuffix}`;
			const email = `social-setup-${tokenSuffix}@example.com`;

			ctx.fakeOAuthTokenVerifierService.setCustomProfile("google", token, {
				id: `google-setup-${tokenSuffix}`,
				email,
				emailVerified: true,
				name: "소셜유저",
			});

			const response = await request(ctx.app.getHttpServer())
				.post("/auth/google/callback")
				.send({ idToken: token })
				.expect(200);

			return {
				accessToken: response.body.data.accessToken,
				email,
			};
		}

		it("POST /auth/password/setup-code - 인증 코드 요청 성공", async () => {
			// Given - 소셜 전용 사용자 (비밀번호 미설정)
			ctx.fakeOAuthTokenVerifierService.clear();
			const { accessToken, email } = await createSocialUser(
				`code-${Date.now()}`,
			);

			// When - 비밀번호 설정 코드 요청
			const response = await request(ctx.app.getHttpServer())
				.post("/auth/password/setup-code")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then
			expect(response.body.success).toBe(true);
			expect(response.body.data.message).toBeDefined();
			expect(ctx.fakeEmailService.hasSentTo(email)).toBe(true);
		});

		it("POST /auth/password - 비밀번호 설정 성공", async () => {
			// Given - 소셜 전용 사용자 + 인증 코드 발송
			ctx.fakeOAuthTokenVerifierService.clear();
			const { accessToken, email } = await createSocialUser(
				`set-${Date.now()}`,
			);

			await request(ctx.app.getHttpServer())
				.post("/auth/password/setup-code")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			const code = ctx.fakeEmailService.getLastCode(email);
			expect(code).toBeTruthy();

			// When - 비밀번호 설정
			const response = await request(ctx.app.getHttpServer())
				.post("/auth/password")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					code,
					newPassword: "NewPassword1",
					newPasswordConfirm: "NewPassword1",
				})
				.expect(200);

			// Then
			expect(response.body.success).toBe(true);
			expect(response.body.data.message).toBeDefined();
		});

		it("비밀번호 설정 후 이메일 로그인 가능", async () => {
			// Given - 소셜 사용자 비밀번호 설정 완료
			ctx.fakeOAuthTokenVerifierService.clear();
			const { accessToken, email } = await createSocialUser(
				`login-${Date.now()}`,
			);

			await request(ctx.app.getHttpServer())
				.post("/auth/password/setup-code")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			const code = ctx.fakeEmailService.getLastCode(email);

			await request(ctx.app.getHttpServer())
				.post("/auth/password")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					code,
					newPassword: "NewPassword1",
					newPasswordConfirm: "NewPassword1",
				})
				.expect(200);

			// When - 이메일/비밀번호로 로그인 시도
			const loginResponse = await request(ctx.app.getHttpServer())
				.post("/auth/login")
				.send({ email, password: "NewPassword1" })
				.expect(200);

			// Then
			expect(loginResponse.body.success).toBe(true);
			expect(loginResponse.body.data.accessToken).toBeDefined();
			expect(loginResponse.body.data.refreshToken).toBeDefined();
		});

		it("이미 비밀번호가 있는 계정은 409 반환", async () => {
			// Given - 소셜 사용자 비밀번호 설정 완료
			ctx.fakeOAuthTokenVerifierService.clear();
			const { accessToken, email } = await createSocialUser(
				`dup-${Date.now()}`,
			);

			await request(ctx.app.getHttpServer())
				.post("/auth/password/setup-code")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			const code = ctx.fakeEmailService.getLastCode(email);

			await request(ctx.app.getHttpServer())
				.post("/auth/password")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					code,
					newPassword: "NewPassword1",
					newPasswordConfirm: "NewPassword1",
				})
				.expect(200);

			// When - 비밀번호 설정 코드 재요청
			const response = await request(ctx.app.getHttpServer())
				.post("/auth/password/setup-code")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(409);

			// Then
			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("USER_0614");
		});

		it("잘못된 인증 코드는 401 반환", async () => {
			// Given - 소셜 전용 사용자 + 인증 코드 발송
			ctx.fakeOAuthTokenVerifierService.clear();
			const { accessToken } = await createSocialUser(`badcode-${Date.now()}`);

			await request(ctx.app.getHttpServer())
				.post("/auth/password/setup-code")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// When - 잘못된 코드로 비밀번호 설정 시도
			const response = await request(ctx.app.getHttpServer())
				.post("/auth/password")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					code: "000000",
					newPassword: "NewPassword1",
					newPasswordConfirm: "NewPassword1",
				})
				.expect(401);

			// Then
			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("VERIFY_0751");
		});

		it("인증되지 않은 요청은 401 반환", async () => {
			// Given - 토큰 없음

			// When & Then - 비밀번호 설정 코드 요청 시 401
			await request(ctx.app.getHttpServer())
				.post("/auth/password/setup-code")
				.expect(401);

			// When & Then - 비밀번호 설정 요청 시 401
			await request(ctx.app.getHttpServer())
				.post("/auth/password")
				.send({
					code: "123456",
					newPassword: "NewPassword1",
					newPasswordConfirm: "NewPassword1",
				})
				.expect(401);
		});
	});
});
