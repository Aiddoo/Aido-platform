/**
 * User 테스트 Fixture
 *
 * 타입 안전한 User 및 관련 엔티티 테스트 데이터 생성
 */
import type {
	Account,
	AccountProvider,
	SubscriptionStatus,
	User,
	UserPreference,
	UserProfile,
	UserRole,
	UserStatus,
} from "@/generated/prisma/client";

let userCounter = 0;

/**
 * User Fixture 팩토리
 *
 * @example
 * ```typescript
 * // 기본 User 생성
 * const user = UserFixture.create();
 *
 * // 커스텀 속성으로 생성
 * const user = UserFixture.create({ email: 'custom@example.com' });
 *
 * // User + Profile 함께 생성
 * const { user, profile } = UserFixture.createWithProfile();
 * ```
 */
export const UserFixture = {
	/**
	 * User 엔티티 생성
	 */
	create: (overrides: Partial<User> = {}): User => {
		const id = ++userCounter;
		const now = new Date();

		return {
			id: overrides.id ?? `user-${id}`,
			email: overrides.email ?? `test-${id}@example.com`,
			userTag: overrides.userTag ?? `USR${String(id).padStart(5, "0")}`,
			role: overrides.role ?? ("USER" as UserRole),
			status: overrides.status ?? ("ACTIVE" as UserStatus),
			emailVerifiedAt: overrides.emailVerifiedAt ?? now,
			twoFactorEnabled: overrides.twoFactorEnabled ?? false,
			twoFactorSecret: overrides.twoFactorSecret ?? null,
			subscriptionStatus:
				overrides.subscriptionStatus ?? ("FREE" as SubscriptionStatus),
			subscriptionExpiresAt: overrides.subscriptionExpiresAt ?? null,
			revenueCatUserId: overrides.revenueCatUserId ?? null,
			aiUsageCount: overrides.aiUsageCount ?? 0,
			aiUsageResetAt: overrides.aiUsageResetAt ?? now,
			createdAt: overrides.createdAt ?? now,
			updatedAt: overrides.updatedAt ?? now,
			lastLoginAt: overrides.lastLoginAt ?? null,
			deletedAt: overrides.deletedAt ?? null,
		};
	},

	/**
	 * User + Profile 함께 생성
	 */
	createWithProfile: (
		userOverrides: Partial<User> = {},
		profileOverrides: Partial<UserProfile> = {},
	): { user: User; profile: UserProfile } => {
		const user = UserFixture.create(userOverrides);

		const profile: UserProfile = {
			id: profileOverrides.id ?? `profile-${userCounter}`,
			userId: user.id,
			name: profileOverrides.name ?? `User ${userCounter}`,
			profileImage: profileOverrides.profileImage ?? null,
		};

		return { user, profile };
	},

	/**
	 * User + Profile + Preference 함께 생성
	 */
	createFull: (
		userOverrides: Partial<User> = {},
		profileOverrides: Partial<UserProfile> = {},
		preferenceOverrides: Partial<UserPreference> = {},
	): { user: User; profile: UserProfile; preference: UserPreference } => {
		const { user, profile } = UserFixture.createWithProfile(
			userOverrides,
			profileOverrides,
		);

		const preference: UserPreference = {
			id: preferenceOverrides.id ?? `pref-${userCounter}`,
			userId: user.id,
			pushEnabled: preferenceOverrides.pushEnabled ?? true,
			nightPushEnabled: preferenceOverrides.nightPushEnabled ?? false,
		};

		return { user, profile, preference };
	},

	/**
	 * 카운터 리셋 (테스트 간 격리)
	 */
	reset: (): void => {
		userCounter = 0;
	},
};

/**
 * Account Fixture 팩토리
 */
let accountCounter = 0;

export const AccountFixture = {
	/**
	 * Account 엔티티 생성
	 */
	create: (overrides: Partial<Account> = {}): Account => {
		const id = ++accountCounter;
		const now = new Date();

		return {
			id: overrides.id ?? id,
			userId: overrides.userId ?? `user-${id}`,
			provider: overrides.provider ?? ("CREDENTIAL" as AccountProvider),
			providerAccountId: overrides.providerAccountId ?? `provider-${id}`,
			password: overrides.password ?? null,
			accessToken: overrides.accessToken ?? null,
			accessTokenExpiresAt: overrides.accessTokenExpiresAt ?? null,
			refreshToken: overrides.refreshToken ?? null,
			scope: overrides.scope ?? null,
			createdAt: overrides.createdAt ?? now,
			updatedAt: overrides.updatedAt ?? now,
		};
	},

	/**
	 * OAuth Account 생성
	 */
	createOAuth: (
		provider: AccountProvider,
		overrides: Partial<Account> = {},
	): Account => {
		return AccountFixture.create({
			provider,
			accessToken: `${provider.toLowerCase()}-access-token`,
			...overrides,
		});
	},

	/**
	 * 카운터 리셋
	 */
	reset: (): void => {
		accountCounter = 0;
	},
};
