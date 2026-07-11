import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { AccountRepository } from "@/auth/infrastructure/persistence/account.repository";
import { UserRepository } from "@/auth/infrastructure/persistence/user.repository";
import type { User } from "@/generated/prisma/client";
import { DEFAULT_CATEGORIES, TodoCategoryRepository } from "@/todo-category";
import {
	UserConsentRepository,
	UserPreferenceRepository,
} from "@/user-settings";
import {
	type ProvisionUserInput,
	ProvisionUserUseCase,
} from "./provision-user.use-case";

describe("ProvisionUserUseCase — 신규 사용자 프로비저닝 수렴 시퀀스", () => {
	let useCase: ProvisionUserUseCase;
	let userRepo: Mocked<UserRepository>;
	let accountRepo: Mocked<AccountRepository>;
	let consentRepo: Mocked<UserConsentRepository>;
	let preferenceRepo: Mocked<UserPreferenceRepository>;
	let categoryRepo: Mocked<TodoCategoryRepository>;

	const createdUser = { id: "user-1", email: "user@example.com" } as User;

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(ProvisionUserUseCase).compile();
		useCase = unit;
		userRepo = unitRef.get(UserRepository);
		accountRepo = unitRef.get(AccountRepository);
		consentRepo = unitRef.get(UserConsentRepository);
		preferenceRepo = unitRef.get(UserPreferenceRepository);
		categoryRepo = unitRef.get(TodoCategoryRepository);

		userRepo.create.mockResolvedValue(createdUser);
	});

	const credentialInput: ProvisionUserInput = {
		email: "user@example.com",
		status: "PENDING_VERIFY",
		account: { kind: "credential", hashedPassword: "hashed-pw" },
		profile: { name: "홍길동" },
		consent: { termsAgreedAt: new Date("2026-01-01T00:00:00Z") },
	};

	it("크레덴셜: 유저→크레덴셜계정→프로필→동의→설정→카테고리 순서로 생성하고 유저를 반환한다", async () => {
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
		expect(consentRepo.create).toHaveBeenCalledWith("user-1", {
			termsAgreedAt: new Date("2026-01-01T00:00:00Z"),
		});
		expect(preferenceRepo.create).toHaveBeenCalledWith("user-1", {
			pushEnabled: true,
			nightPushEnabled: true,
		});
		expect(categoryRepo.createMany).toHaveBeenCalledWith(
			DEFAULT_CATEGORIES.map((category) => ({
				userId: "user-1",
				name: category.name,
				color: category.color,
				sortOrder: category.sortOrder,
			})),
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
