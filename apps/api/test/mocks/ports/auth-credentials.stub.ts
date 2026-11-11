import type {
  AuthCachedUserProfile,
  AuthCachePort,
  AuthRegistrationNotifierPort,
  AuthUserRegisteredNotification,
} from "#api/modules/identity/auth/application/ports/auth-collaboration.port";
import type { AuthPasswordHasherPort } from "#api/modules/identity/auth/application/ports/auth-crypto.port";
import type { RetentionEnrollerPort } from "#api/modules/identity/auth/application/ports/retention-enroller.port";
import type { UserProvisioningSeederPort } from "#api/modules/identity/auth/application/ports/user-provisioning-seeder.port";
import type { VerificationCodeSecurityPort } from "#api/modules/identity/auth/application/ports/verification-code-security.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  StubAccountLifecycleCache,
  StubAccountPasswordVerifier,
} from "./account-lifecycle.stub.js";

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

export class StubAuthProfileCache
  extends StubAccountLifecycleCache
  implements Pick<AuthCachePort, "wrapUserProfile">
{
  readonly profiles = new Map<string, AuthCachedUserProfile>();

  override async invalidateUserProfile(userId: UserId): Promise<void> {
    await super.invalidateUserProfile(userId);
    this.profiles.delete(userId.value);
  }

  async wrapUserProfile(
    userId: UserId,
    factory: () => Promise<AuthCachedUserProfile | undefined>,
  ): Promise<AuthCachedUserProfile | undefined> {
    const cached = this.profiles.get(userId.value);
    if (cached !== undefined) {
      return cached;
    }
    const profile = await factory();
    if (profile !== undefined) {
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

export class StubAuthRegistrationNotifier implements AuthRegistrationNotifierPort {
  readonly notifications: AuthUserRegisteredNotification[] = [];
  notifyUserRegistered(notification: AuthUserRegisteredNotification): void {
    this.notifications.push(notification);
  }
}

export class StubAuthRetentionEnroller implements RetentionEnrollerPort {
  readonly enrollments: { userId: string; activated: boolean }[] = [];
  readonly activatedUserIds: string[] = [];
  async enrollNewUser(userId: UserId, activated: boolean): Promise<void> {
    this.enrollments.push({ userId: userId.value, activated });
  }
  async activateNewUser(userId: UserId): Promise<void> {
    this.activatedUserIds.push(userId.value);
  }
}

export class StubAuthProvisioningSeeder implements UserProvisioningSeederPort {
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
    locale?: Parameters<UserProvisioningSeederPort["seedDefaultCategories"]>[1],
  ): Promise<void> {
    this.categoryUserIds.push(userId.value);
    this.categoryLocales.push(locale);
  }
}
