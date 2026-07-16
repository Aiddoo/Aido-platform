import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { mockOf } from "@test/mocks";
import {
	AUTH_ACCOUNT_REPOSITORY,
	AUTH_USER_REPOSITORY,
	type AuthAccountRepositoryPort,
	type AuthUserRecord,
	type AuthUserRepositoryPort,
} from "../../ports/auth-persistence.port";
import {
	RETENTION_ENROLLER,
	type RetentionEnrollerPort,
} from "../../ports/retention-enroller.port";
import {
	USER_PROVISIONING_SEEDER,
	type UserProvisioningSeederPort,
} from "../../ports/user-provisioning-seeder.port";
import {
	type ProvisionUserInput,
	ProvisionUserUseCase,
} from "./provision-user.use-case";

describe("ProvisionUserUseCase — 신규 사용자 프로비저닝 수렴 시퀀스", () => {
	let useCase: ProvisionUserUseCase;
	let userRepo: Mocked<AuthUserRepositoryPort>;
	let accountRepo: Mocked<AuthAccountRepositoryPort>;
	let seeder: Mocked<UserProvisioningSeederPort>;
	let retentionEnroller: Mocked<RetentionEnrollerPort>;

	const createdUser = mockOf<AuthUserRecord>({
		id: "user-1",
		email: "user@example.com",
	});

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(ProvisionUserUseCase).compile();
		useCase = unit;
		userRepo = unitRef.get(AUTH_USER_REPOSITORY);
		accountRepo = unitRef.get(AUTH_ACCOUNT_REPOSITORY);
		seeder = unitRef.get(USER_PROVISIONING_SEEDER);
		retentionEnroller = unitRef.get(RETENTION_ENROLLER);

		userRepo.create.mockResolvedValue(createdUser);
	});

	const credentialInput: ProvisionUserInput = {
		email: "user@example.com",
		status: "PENDING_VERIFY",
		account: { kind: "credential", hashedPassword: "hashed-pw" },
		profile: { name: "홍길동" },
		consent: { termsAgreedAt: new Date("2026-01-01T00:00:00Z") },
	};

	it("크레덴셜: 유저→크레덴셜계정→프로필→기본값 시딩 순서로 생성하고 유저를 반환한다", async () => {
		const result = await useCase.execute(credentialInput);

		expect(userRepo.create).toHaveBeenCalledWith({
			email: "user@example.com",
			status: "PENDING_VERIFY",
			emailVerifiedAt: undefined,
		});
		expect(accountRepo.createCredentialAccount).toHaveBeenCalledWith(
			"user-1",
			"hashed-pw",
		);
		expect(accountRepo.createOAuthAccount).not.toHaveBeenCalled();
		expect(userRepo.createProfile).toHaveBeenCalledWith("user-1", {
			name: "홍길동",
		});
		expect(seeder.seedDefaultSettings).toHaveBeenCalledWith("user-1", {
			termsAgreedAt: new Date("2026-01-01T00:00:00Z"),
		});
		expect(seeder.seedDefaultCategories).toHaveBeenCalledWith("user-1");
		expect(retentionEnroller.enrollNewUser).toHaveBeenCalledWith(
			"user-1",
			false,
		);
		expect(result).toBe(createdUser);
	});

	it("OAuth: OAuth 계정을 연결하고 emailVerifiedAt·profileImage를 전달한다", async () => {
		const verifiedAt = new Date("2026-02-02T00:00:00Z");
		const oauthInput: ProvisionUserInput = {
			email: "social@example.com",
			status: "ACTIVE",
			emailVerifiedAt: verifiedAt,
			account: {
				kind: "oauth",
				provider: "GOOGLE",
				providerAccountId: "google-123",
				refreshToken: "refresh-token",
			},
			profile: { name: "랜덤이름", profileImage: "https://img/1.png" },
			consent: {
				termsAgreedAt: verifiedAt,
				privacyAgreedAt: verifiedAt,
				marketingAgreedAt: verifiedAt,
			},
		};

		await useCase.execute(oauthInput);

		expect(userRepo.create).toHaveBeenCalledWith({
			email: "social@example.com",
			status: "ACTIVE",
			emailVerifiedAt: verifiedAt,
		});
		expect(accountRepo.createOAuthAccount).toHaveBeenCalledWith({
			userId: "user-1",
			provider: "GOOGLE",
			providerAccountId: "google-123",
			refreshToken: "refresh-token",
		});
		expect(accountRepo.createCredentialAccount).not.toHaveBeenCalled();
		expect(userRepo.createProfile).toHaveBeenCalledWith("user-1", {
			name: "랜덤이름",
			profileImage: "https://img/1.png",
		});
	});
});
