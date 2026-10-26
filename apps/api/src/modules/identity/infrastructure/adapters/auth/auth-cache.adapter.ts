import {
  accountProviderSchema,
  premiumSourceSchema,
  subscriptionStatusSchema,
  userRoleSchema,
  userStatusSchema,
} from "@aido/api";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { CacheService } from "#api/platform/cache/cache.service";

import type {
  AuthCachedSession,
  AuthCachedUserProfile,
  AuthCachePort,
} from "../../../application/ports/auth/auth-collaboration.port.js";
import {
  IDENTITY_CACHE_TTL_MS,
  IdentityCacheKey,
} from "../../cache/auth/identity-cache.keyspace.js";

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
}) satisfies z.ZodType<AuthCachedUserProfile>;

@Injectable()
export class AuthCacheAdapter implements AuthCachePort {
  constructor(private readonly cacheService: CacheService) {}

  getSession(sessionId: string): Promise<AuthCachedSession | undefined> {
    return this.cacheService.get(IdentityCacheKey.session(sessionId), AUTH_CACHED_SESSION_SCHEMA);
  }

  setSession(sessionId: string, session: AuthCachedSession): Promise<void> {
    return this.cacheService.set(
      IdentityCacheKey.session(sessionId),
      session,
      IDENTITY_CACHE_TTL_MS.SESSION,
    );
  }

  invalidateSession(sessionId: string): Promise<void> {
    return this.cacheService.del(IdentityCacheKey.session(sessionId));
  }

  invalidateUserProfile(userId: string): Promise<void> {
    return this.cacheService.del(IdentityCacheKey.userProfile(userId));
  }

  wrapUserProfile(
    userId: string,
    factory: () => Promise<AuthCachedUserProfile | undefined>,
  ): Promise<AuthCachedUserProfile | undefined> {
    return this.cacheService.wrap(
      IdentityCacheKey.userProfile(userId),
      AUTH_CACHED_USER_PROFILE_SCHEMA.optional(),
      factory,
      IDENTITY_CACHE_TTL_MS.USER_PROFILE,
    );
  }
}
