import {
  accountProviderSchema,
  premiumSourceSchema,
  subscriptionPlanTypeSchema,
  subscriptionStatusSchema,
  userRoleSchema,
  userStatusSchema,
} from "@aido/api/contracts/auth";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { UserProfileInvalidatorPort } from "#api/modules/identity/users/application/ports/user-profile-invalidator.port";
import { CacheService } from "#api/platform/cache/cache.service";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantToDate } from "#api/shared/domain/time/instant";

import type {
  AuthCachedSession,
  AuthCachedUserProfile,
  AuthCachePort,
} from "../../application/ports/auth-collaboration.port.js";
import type { SessionId } from "../../domain/session-id.vo.js";
import {
  IDENTITY_CACHE_TTL_MS,
  IdentityCacheKey,
  userProfileTtlMs,
} from "../cache/identity-cache.keyspace.js";

/** in-memory는 Date, Redis는 ISO 문자열을 돌려주므로 둘 다 받는다(포트 타입과 같다). */
const CACHED_TIMESTAMP_SCHEMA = z.union([z.date(), z.string()]);

const AUTH_CACHED_SESSION_SCHEMA = z.looseObject({
  userId: z.string(),
  expiresAt: CACHED_TIMESTAMP_SCHEMA,
  revokedAt: CACHED_TIMESTAMP_SCHEMA.nullable(),
  userStatus: z.string().optional(),
  userDeletedAt: z.string().nullable().optional(),
}) satisfies z.ZodType<AuthCachedSession>;

const AUTH_CACHED_USER_PROFILE_SCHEMA = z.looseObject({
  id: z.string(),
  email: z.string(),
  userTag: z.string(),
  role: userRoleSchema,
  status: userStatusSchema,
  emailVerifiedAt: z.string().nullable(),
  subscriptionStatus: subscriptionStatusSchema,
  subscriptionExpiresAt: z.string().nullable(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
  createdAt: z.string(),
  providers: z.array(accountProviderSchema),
  premiumSource: premiumSourceSchema.nullable().optional(),
  premiumEndsAt: z.string().nullable().optional(),
  premiumPeriodEndsAt: z.string().nullable().optional(),
  willRenew: z.boolean().optional(),
  bankedPremiumDays: z.number().optional(),
  premiumGrantEndedAt: z.string().nullable().optional(),
  premiumIsTrial: z.boolean().optional(),
  premiumPlanType: subscriptionPlanTypeSchema.nullable().optional(),
}) satisfies z.ZodType<AuthCachedUserProfile>;

@Injectable()
// 사용자 프로필 무효화 포트로도 같은 인스턴스를 쓴다(useExisting)
export class AuthCacheAdapter implements AuthCachePort, UserProfileInvalidatorPort {
  readonly #cacheService: CacheService;
  readonly #clock: ClockPort;

  constructor(cacheService: CacheService, clock: ClockPort) {
    this.#cacheService = cacheService;
    this.#clock = clock;
  }

  getSession(sessionId: SessionId): Promise<AuthCachedSession | undefined> {
    return this.#cacheService.get(
      IdentityCacheKey.session(sessionId.value),
      AUTH_CACHED_SESSION_SCHEMA,
    );
  }

  setSession(sessionId: SessionId, session: AuthCachedSession): Promise<void> {
    return this.#cacheService.set(
      IdentityCacheKey.session(sessionId.value),
      session,
      IDENTITY_CACHE_TTL_MS.SESSION,
    );
  }

  invalidateSession(sessionId: SessionId): Promise<void> {
    return this.#cacheService.del(IdentityCacheKey.session(sessionId.value));
  }

  invalidateUserProfile(userId: UserId): Promise<void> {
    return this.#cacheService.del(IdentityCacheKey.userProfile(userId.value));
  }

  wrapUserProfile(
    userId: UserId,
    factory: () => Promise<AuthCachedUserProfile | undefined>,
  ): Promise<AuthCachedUserProfile | undefined> {
    return this.#cacheService.wrap(
      IdentityCacheKey.userProfile(userId.value),
      AUTH_CACHED_USER_PROFILE_SCHEMA.optional(),
      factory,
      (profile) => userProfileTtlMs(profile, instantToDate(this.#clock.now())),
    );
  }
}
