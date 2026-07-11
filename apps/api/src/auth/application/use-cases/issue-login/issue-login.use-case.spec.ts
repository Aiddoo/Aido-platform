import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { asMock } from "@test/mocks";
import { SECURITY_EVENT } from "@/auth/domain/constants/auth.constants";
import { LoginAttemptRepository } from "@/auth/infrastructure/persistence/login-attempt.repository";
import { SecurityLogRepository } from "@/auth/infrastructure/persistence/security-log.repository";
import { UserRepository } from "@/auth/infrastructure/persistence/user.repository";
import { SessionService } from "../../services/session.service";
import {
	type IssueLoginInput,
	IssueLoginUseCase,
} from "./issue-login.use-case";

describe("IssueLoginUseCase — 로그인 발급 수렴 시퀀스", () => {
	let useCase: IssueLoginUseCase;
	let sessionService: Mocked<SessionService>;
	let loginAttemptRepo: Mocked<LoginAttemptRepository>;
	let securityLogRepo: Mocked<SecurityLogRepository>;
	let userRepo: Mocked<UserRepository>;

	const baseInput: IssueLoginInput = {
		userId: "user-1",
		email: "user@example.com",
		role: "USER",
		provider: "CREDENTIAL",
		ip: "1.2.3.4",
		userAgent: "agent/1.0",
		deviceFingerprint: "device-1",
	};

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(IssueLoginUseCase).compile();
		useCase = unit;
		sessionService = unitRef.get(SessionService);
		loginAttemptRepo = unitRef.get(LoginAttemptRepository);
		securityLogRepo = unitRef.get(SecurityLogRepository);
		userRepo = unitRef.get(UserRepository);

		sessionService.createSessionWithTokens.mockResolvedValue({
			sessionId: "session-1",
			tokens: {
				accessToken: "access-1",
				refreshToken: "refresh-1",
				expiresIn: 900,
			},
			tokenFamily: "family-1",
		});
		asMock(userRepo.findByIdWithProfile).mockResolvedValue({
			userTag: "TAG#1234",
			profile: { name: "홍길동", profileImage: "https://img/1.png" },
		});
	});

	it("세션+토큰 발급 → 로그인시도 → 보안로그 → 프로필 조회 순서로 실행하고 결과를 매핑한다", async () => {
		const outcome = await useCase.execute(baseInput);

		expect(sessionService.createSessionWithTokens).toHaveBeenCalledWith({
			userId: "user-1",
			email: "user@example.com",
			role: "USER",
			deviceFingerprint: "device-1",
			userAgent: "agent/1.0",
			ipAddress: "1.2.3.4",
		});
		expect(loginAttemptRepo.create).toHaveBeenCalledWith({
			email: "user@example.com",
			provider: "CREDENTIAL",
			ipAddress: "1.2.3.4",
			userAgent: "agent/1.0",
			success: true,
		});
		expect(outcome).toEqual({
			sessionId: "session-1",
			tokens: {
				accessToken: "access-1",
				refreshToken: "refresh-1",
				expiresIn: 900,
			},
			userTag: "TAG#1234",
			name: "홍길동",
			profileImage: "https://img/1.png",
		});
	});

	it("securityMetadata가 없으면 보안로그에 metadata 키를 넣지 않는다(크레덴셜)", async () => {
		await useCase.execute(baseInput);

		expect(securityLogRepo.create).toHaveBeenCalledWith({
			userId: "user-1",
			event: SECURITY_EVENT.LOGIN_SUCCESS,
			ipAddress: "1.2.3.4",
			userAgent: "agent/1.0",
		});
	});

	it("securityMetadata가 있으면 보안로그에 metadata를 남긴다(소셜)", async () => {
		await useCase.execute({
			...baseInput,
			provider: "GOOGLE",
			securityMetadata: { provider: "GOOGLE" },
		});

		expect(securityLogRepo.create).toHaveBeenCalledWith({
			userId: "user-1",
			event: SECURITY_EVENT.LOGIN_SUCCESS,
			ipAddress: "1.2.3.4",
			userAgent: "agent/1.0",
			metadata: { provider: "GOOGLE" },
		});
	});

	it("프로필이 없으면 userTag는 빈 문자열, name·profileImage는 null이다", async () => {
		userRepo.findByIdWithProfile.mockResolvedValue(null);

		const outcome = await useCase.execute(baseInput);

		expect(outcome.userTag).toBe("");
		expect(outcome.name).toBeNull();
		expect(outcome.profileImage).toBeNull();
	});
});
