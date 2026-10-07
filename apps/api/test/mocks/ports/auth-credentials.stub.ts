import type {
  AuthCachedUserProfile,
  AuthCachePort,
  AuthRegistrationNotifierPort,
  AuthUserRegisteredNotification,
} from "#api/modules/identity/application/ports/auth/auth-collaboration.port";
import type { AuthPasswordHasherPort } from "#api/modules/identity/application/ports/auth/auth-crypto.port";
import type {
  AuthLoginAttemptRepositoryPort,
  AuthAccountRecord,
  AuthUserProfileRecord,
  AuthUserRecord,
  AuthUserRepositoryPort,
  AuthVerificationRecord,
  AuthVerificationRepositoryPort,
} from "#api/modules/identity/application/ports/auth/auth-persistence.port";
import type { RetentionEnrollerPort } from "#api/modules/identity/application/ports/auth/retention-enroller.port";
import type { UserProvisioningSeederPort } from "#api/modules/identity/application/ports/auth/user-provisioning-seeder.port";
import type { VerificationCodeSecurityPort } from "#api/modules/identity/application/ports/auth/verification-code-security.port";
import { UserFixture, VerificationFixture } from "#test/fixtures/index";

import {
  StubAccountLifecycleCache,
  StubAccountLifecycleRepository,
  StubAccountPasswordVerifier,
} from "./account-lifecycle.stub.js";

export class StubAuthUserRepository
  extends StubAccountLifecycleRepository
  implements
    Pick<
      AuthUserRepositoryPort,
      | "findByEmail"
      | "findById"
      | "findByIdWithProfile"
      | "create"
      | "createProfile"
      | "markEmailVerified"
      | "updateProfile"
      | "restore"
    >
{
  readonly profiles = new Map<string, AuthUserProfileRecord["profile"]>();
  readonly providers = new Map<string, AuthUserProfileRecord["accounts"]>();

  constructor(
    users: readonly AuthUserRecord[] = [],
    readonly accounts: readonly AuthAccountRecord[] = [],
  ) {
    super(users);
  }

  async findByEmail(email: string): Promise<AuthUserRecord | null> {
    const user = [...this.users.values()].find((user) => user.email === email);
    return user === undefined ? null : { ...user };
  }

  async findByIdWithProfile(id: string): Promise<AuthUserProfileRecord | null> {
    const user = this.users.get(id);
    if (user === undefined) return null;
    return {
      ...user,
      profile: this.profiles.get(id) ?? null,
      accounts:
        this.providers.get(id) ??
        this.accounts
          .filter((account) => account.userId === id)
          .map(({ provider }) => ({ provider })),
    };
  }

  async create(input: Parameters<AuthUserRepositoryPort["create"]>[0]): Promise<AuthUserRecord> {
    const user = UserFixture.create({ ...input, emailVerifiedAt: input.emailVerifiedAt ?? null });
    this.users.set(user.id, user);
    return user;
  }

  async createProfile(
    userId: string,
    input: Parameters<AuthUserRepositoryPort["createProfile"]>[1],
  ): Promise<void> {
    this.profiles.set(userId, {
      name: input.name ?? null,
      profileImage: input.profileImage ?? null,
    });
  }

  async markEmailVerified(id: string): Promise<void> {
    const user = await this.findById(id);
    if (user === null) throw new Error(`사용자가 없습니다: ${id}`);
    this.users.set(id, { ...user, status: "ACTIVE", emailVerifiedAt: new Date() });
  }

  async updateProfile(
    userId: string,
    input: Parameters<AuthUserRepositoryPort["updateProfile"]>[1],
  ): Promise<NonNullable<AuthUserProfileRecord["profile"]>> {
    const prior = this.profiles.get(userId) ?? { name: null, profileImage: null };
    const profile = {
      name: input.name === undefined ? prior.name : input.name,
      profileImage: input.profileImage === undefined ? prior.profileImage : input.profileImage,
    };
    this.profiles.set(userId, profile);
    return profile;
  }
}

export class StubAuthPasswordHasher
  extends StubAccountPasswordVerifier
  implements AuthPasswordHasherPort
{
  readonly hashes: string[] = [];
  readonly outdatedHashes = new Set<string>();

  async hash(password: string): Promise<string> {
    this.hashes.push(password);
    return `digest:${password}`;
  }

  needsRehash(hash: string): boolean {
    return this.outdatedHashes.has(hash);
  }
}

export class StubAuthLoginAttemptRepository implements AuthLoginAttemptRepositoryPort {
  readonly attempts: (Parameters<AuthLoginAttemptRepositoryPort["create"]>[0] & { at: Date })[] =
    [];

  async create(input: Parameters<AuthLoginAttemptRepositoryPort["create"]>[0]): Promise<void> {
    this.attempts.push({ ...input, at: new Date() });
  }

  async countRecentFailuresByEmail(email: string, since: Date): Promise<number> {
    return this.attempts.filter(
      (attempt) => attempt.email === email && !attempt.success && attempt.at >= since,
    ).length;
  }
}

export class StubAuthProfileCache
  extends StubAccountLifecycleCache
  implements Pick<AuthCachePort, "wrapUserProfile">
{
  readonly profiles = new Map<string, AuthCachedUserProfile>();

  override async invalidateUserProfile(userId: string): Promise<void> {
    await super.invalidateUserProfile(userId);
    this.profiles.delete(userId);
  }

  async wrapUserProfile(
    userId: string,
    factory: () => Promise<AuthCachedUserProfile | undefined>,
  ): Promise<AuthCachedUserProfile | undefined> {
    const cached = this.profiles.get(userId);
    if (cached !== undefined) return cached;
    const profile = await factory();
    if (profile !== undefined) {
      this.profiles.set(userId, profile);
      this.userIds.add(userId);
    }
    return profile;
  }
}

export class StubAuthVerificationRepository implements AuthVerificationRepositoryPort {
  readonly verifications: Map<number, AuthVerificationRecord>;

  constructor(verifications: readonly AuthVerificationRecord[] = []) {
    this.verifications = new Map(
      verifications.map((verification) => [verification.id, { ...verification }]),
    );
  }

  async create(input: Parameters<AuthVerificationRepositoryPort["create"]>[0]): Promise<void> {
    const verification = VerificationFixture.create(input);
    this.verifications.set(verification.id, verification);
  }

  async findValidByUserIdAndType(
    userId: string,
    type: AuthVerificationRecord["type"],
    at = new Date(),
  ): Promise<AuthVerificationRecord | null> {
    const verification = [...this.verifications.values()]
      .filter(
        (verification) =>
          verification.userId === userId &&
          verification.type === type &&
          verification.usedAt === null &&
          verification.expiresAt > at,
      )
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime() || right.id - left.id,
      )[0];
    return verification === undefined ? null : { ...verification };
  }

  async consume(input: {
    id: number;
    userId: string;
    type: AuthVerificationRecord["type"];
    tokenHash: string;
    maxAttempts: number;
    at: Date;
  }): Promise<boolean> {
    const verification = this.verifications.get(input.id);
    if (
      verification === undefined ||
      verification.userId !== input.userId ||
      verification.type !== input.type ||
      verification.token !== input.tokenHash ||
      verification.usedAt !== null ||
      verification.expiresAt <= input.at ||
      verification.attempts >= input.maxAttempts
    )
      return false;
    this.verifications.set(input.id, { ...verification, usedAt: new Date(input.at) });
    return true;
  }

  async incrementAttempts(id: number): Promise<void> {
    const verification = this.verifications.get(id);
    if (verification === undefined) throw new Error(`인증 코드가 없습니다: ${id}`);
    this.verifications.set(id, { ...verification, attempts: verification.attempts + 1 });
  }

  async invalidateAllByUserIdAndType(
    userId: string,
    type: AuthVerificationRecord["type"],
  ): Promise<number> {
    let count = 0;
    for (const [id, verification] of this.verifications) {
      if (
        verification.userId !== userId ||
        verification.type !== type ||
        verification.usedAt !== null ||
        verification.expiresAt.getTime() <= Date.now()
      )
        continue;
      this.verifications.set(id, { ...verification, expiresAt: new Date() });
      count += 1;
    }
    return count;
  }

  async countRecentByUserIdAndType(
    userId: string,
    type: AuthVerificationRecord["type"],
    since: Date,
  ): Promise<number> {
    return [...this.verifications.values()].filter(
      (verification) =>
        verification.userId === userId &&
        verification.type === type &&
        verification.createdAt >= since,
    ).length;
  }
}

export class StubVerificationCodeSecurity implements VerificationCodeSecurityPort {
  #sequence = 123_455;

  generate() {
    const plaintext = String(++this.#sequence);
    return { plaintext, digest: this.hash(plaintext) };
  }

  hash(plaintext: string): string {
    return `digest:${plaintext}`;
  }
}

export class StubAuthRegistrationNotifier implements AuthRegistrationNotifierPort {
  readonly notifications: AuthUserRegisteredNotification[] = [];
  notifyUserRegistered(notification: AuthUserRegisteredNotification): void {
    this.notifications.push(notification);
  }
}

export class StubAuthRetentionEnroller implements RetentionEnrollerPort {
  readonly enrollments: { userId: string; activated: boolean }[] = [];
  readonly activatedUserIds: string[] = [];
  async enrollNewUser(userId: string, activated: boolean): Promise<void> {
    this.enrollments.push({ userId, activated });
  }
  async activateNewUser(userId: string): Promise<void> {
    this.activatedUserIds.push(userId);
  }
}

export class StubAuthProvisioningSeeder implements UserProvisioningSeederPort {
  readonly settings: {
    userId: string;
    consent: Parameters<UserProvisioningSeederPort["seedDefaultSettings"]>[1];
  }[] = [];
  readonly categoryUserIds: string[] = [];
  async seedDefaultSettings(
    userId: string,
    consent: Parameters<UserProvisioningSeederPort["seedDefaultSettings"]>[1],
  ): Promise<void> {
    this.settings.push({ userId, consent });
  }
  async seedDefaultCategories(userId: string): Promise<void> {
    this.categoryUserIds.push(userId);
  }
}
