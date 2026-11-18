import type { PasswordHasherPort } from "#api/modules/identity/linked-accounts/application/ports/password-hasher.port";
import type { RetentionEnrollerPort } from "#api/modules/identity/users/application/ports/retention-enroller.port";
import type {
  CachedUserProfile,
  UserProfileCachePort,
} from "#api/modules/identity/users/application/ports/user-profile-cache.port";
import type { UserProvisioningSeederPort } from "#api/modules/identity/users/application/ports/user-provisioning-seeder.port";
import type {
  UserRegistrationNotifierPort,
  UserRegisteredNotification,
} from "#api/modules/identity/users/application/ports/user-registration-notifier.port";
import type { VerificationCodeSecurityPort } from "#api/modules/identity/verifications/application/ports/verification-code-security.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  StubAccountLifecycleCache,
  StubAccountPasswordVerifier,
} from "#test/doubles/identity/stub-account-lifecycle";

/** 계정이 없을 때 StubPasswordHasher가 비교하는 hash. 어떤 비밀번호와도 맞지 않는다 */
export const STUB_DUMMY_HASH = "dummy-hash";

export class StubPasswordHasher extends StubAccountPasswordVerifier implements PasswordHasherPort {
  readonly hashes: string[] = [];
  readonly outdatedHashes = new Set<string>();

  async hash(password: string): Promise<string> {
    this.hashes.push(password);
    return `digest:${password}`;
  }

  async verifyAgainstDummyHash(password: string): Promise<void> {
    await this.verify(STUB_DUMMY_HASH, password);
  }

  needsRehash(hash: string): boolean {
    return this.outdatedHashes.has(hash);
  }
}

export class StubUserProfileCache
  extends StubAccountLifecycleCache
  implements Pick<UserProfileCachePort, "wrapUserProfile">
{
  readonly profiles = new Map<string, CachedUserProfile>();

  override async invalidateUserProfile(userId: UserId): Promise<void> {
    await super.invalidateUserProfile(userId);
    this.profiles.delete(userId.value);
  }

  async wrapUserProfile(
    userId: UserId,
    factory: () => Promise<CachedUserProfile | null>,
  ): Promise<CachedUserProfile | null> {
    const cached = this.profiles.get(userId.value);
    if (cached !== undefined) {
      return cached;
    }
    const profile = await factory();
    if (profile != null) {
      this.profiles.set(userId.value, profile);
      this.userIds.add(userId.value);
    }
    return profile;
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

export class StubUserRegistrationNotifier implements UserRegistrationNotifierPort {
  readonly notifications: UserRegisteredNotification[] = [];
  notifyUserRegistered(notification: UserRegisteredNotification): void {
    this.notifications.push(notification);
  }
}

export class StubRetentionEnroller implements RetentionEnrollerPort {
  readonly enrollments: { userId: string; activated: boolean }[] = [];
  readonly activatedUserIds: string[] = [];
  async enrollNewUser(userId: UserId, activated: boolean): Promise<void> {
    this.enrollments.push({ userId: userId.value, activated });
  }
  async activateNewUser(userId: UserId): Promise<void> {
    this.activatedUserIds.push(userId.value);
  }
}

export class StubUserProvisioningSeeder implements UserProvisioningSeederPort {
  readonly settings: {
    userId: string;
    consent: Parameters<UserProvisioningSeederPort["seedDefaultSettings"]>[1];
  }[] = [];
  readonly categoryUserIds: string[] = [];
  readonly categoryLocales: Parameters<UserProvisioningSeederPort["seedDefaultCategories"]>[1][] =
    [];
  async seedDefaultSettings(
    userId: UserId,
    consent: Parameters<UserProvisioningSeederPort["seedDefaultSettings"]>[1],
  ): Promise<void> {
    this.settings.push({ userId: userId.value, consent });
  }
  async seedDefaultCategories(
    userId: UserId,
    locale: Parameters<UserProvisioningSeederPort["seedDefaultCategories"]>[1],
  ): Promise<void> {
    this.categoryUserIds.push(userId.value);
    this.categoryLocales.push(locale);
  }
}
