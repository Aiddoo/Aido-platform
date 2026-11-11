import { AuthPersistenceConflict } from "#api/modules/identity/auth/application/auth.errors";
import type { AuthAccountRepositoryPort } from "#api/modules/identity/auth/application/ports/auth-account.repository.port";
import {
  type AuthUserProfileRecord,
  AuthUserRepositoryPort,
} from "#api/modules/identity/auth/application/ports/auth-user.repository.port";
import type { UserStatus } from "#api/modules/identity/auth/domain/auth.constants";
import {
  IdentityUser,
  type IdentityUserPrimitives,
} from "#api/modules/identity/users/domain/identity-user.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

const IN_MEMORY_USER_CREATED_AT = Temporal.Instant.from("2026-11-10T00:00:00Z");

type UserProfile = NonNullable<AuthUserProfileRecord["profile"]>;

export class InMemoryAuthUserRepository extends AuthUserRepositoryPort {
  readonly #users = new Map<string, IdentityUserPrimitives>();
  readonly #profiles = new Map<string, UserProfile>();
  // 프로필 조회의 연결 계정 목록은 Account 테이블에서 오므로 같은 시나리오의 계정 저장소를 읽는다
  readonly #accounts: Pick<AuthAccountRepositoryPort, "findAllByUserId"> | null;
  #sequence = 0;

  constructor(
    users: readonly IdentityUser[] = [],
    options: {
      readonly accounts?: Pick<AuthAccountRepositoryPort, "findAllByUserId">;
      readonly profiles?: ReadonlyMap<string, UserProfile>;
    } = {},
  ) {
    super();
    for (const user of users) {
      this.#users.set(user.id.value, user.toPrimitives());
    }
    for (const [userId, profile] of options.profiles ?? []) {
      this.#profiles.set(userId, profile);
    }
    this.#accounts = options.accounts ?? null;
  }

  get all(): readonly IdentityUserPrimitives[] {
    return [...this.#users.values()];
  }

  stored(userId: string): IdentityUserPrimitives | undefined {
    return this.#users.get(userId);
  }

  profileOf(userId: string): UserProfile | undefined {
    return this.#profiles.get(userId);
  }

  async findByEmail(email: string): Promise<IdentityUser | null> {
    const found = this.all.find((user) => user.email === email);
    return found == null ? null : IdentityUser.reconstitute(found);
  }

  async findById(id: UserId): Promise<IdentityUser | null> {
    const found = this.#users.get(id.value);
    return found == null ? null : IdentityUser.reconstitute(found);
  }

  async findByIdForUpdate(id: UserId): Promise<IdentityUser | null> {
    return this.findById(id);
  }

  async findByIdWithProfile(id: UserId): Promise<AuthUserProfileRecord | null> {
    const user = this.#users.get(id.value);
    if (user == null) {
      return null;
    }
    const accounts = this.#accounts == null ? [] : await this.#accounts.findAllByUserId(id);
    return {
      id: user.id,
      email: user.email,
      userTag: user.userTag,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      createdAt: user.createdAt,
      deletedAt: user.deletedAt,
      profile: this.#profiles.get(id.value) ?? null,
      accounts: accounts.map((account) => ({ provider: account.provider })),
    };
  }

  async create(data: {
    readonly email: string;
    readonly status: UserStatus;
    readonly emailVerifiedAt?: Temporal.Instant;
  }): Promise<IdentityUser> {
    if (this.all.some((user) => user.email === data.email)) {
      throw new AuthPersistenceConflict("EMAIL_ALREADY_EXISTS");
    }
    this.#sequence += 1;
    const created: IdentityUserPrimitives = {
      id: `user-${this.#sequence}`,
      email: data.email,
      userTag: `MEM${String(this.#sequence).padStart(5, "0")}`,
      role: "USER",
      status: data.status,
      emailVerifiedAt: data.emailVerifiedAt ?? null,
      subscriptionStatus: "FREE",
      subscriptionExpiresAt: null,
      createdAt: IN_MEMORY_USER_CREATED_AT,
      deletedAt: null,
    };
    this.#users.set(created.id, created);
    return IdentityUser.reconstitute(created);
  }

  async createProfile(
    userId: UserId,
    data: { name?: string; profileImage?: string },
  ): Promise<void> {
    this.#profiles.set(userId.value, {
      name: data.name ?? null,
      profileImage: data.profileImage ?? null,
    });
  }

  async markEmailVerified(id: UserId, now: Temporal.Instant): Promise<void> {
    const user = this.#require(id.value);
    this.#users.set(id.value, { ...user, status: "ACTIVE", emailVerifiedAt: now });
  }

  async updateProfile(
    userId: UserId,
    data: { name?: string | null; profileImage?: string | null },
  ): Promise<UserProfile> {
    const prior = this.#profiles.get(userId.value) ?? { name: null, profileImage: null };
    // nullish-strict: PATCH라 undefined는 그대로 두고 null은 비운다
    const profile = {
      name: data.name === undefined ? prior.name : data.name,
      profileImage: data.profileImage === undefined ? prior.profileImage : data.profileImage,
    };
    this.#profiles.set(userId.value, profile);
    return profile;
  }

  async saveAccountStatus(user: IdentityUser): Promise<void> {
    const stored = this.#require(user.id.value);
    const { status, deletedAt } = user.toPrimitives();
    this.#users.set(stored.id, { ...stored, status, deletedAt });
  }

  async listPurgeEligible(now: Temporal.Instant): Promise<IdentityUser[]> {
    return this.all
      .map((user) => IdentityUser.reconstitute(user))
      .filter((user) => user.isPurgeEligibleAt(now));
  }

  async hardDelete(id: UserId): Promise<void> {
    this.#require(id.value);
    this.#users.delete(id.value);
    this.#profiles.delete(id.value);
  }

  // Drizzle 저장소는 없는 사용자를 바꾸면 requireRecord가 던진다
  #require(id: string): IdentityUserPrimitives {
    const user = this.#users.get(id);
    if (user == null) {
      throw new Error(`존재하지 않는 사용자: ${id}`);
    }
    return user;
  }
}
