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

import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import {
  GenerationGuardedCache,
  type GenerationGuardedCacheKey,
} from "#api/platform/cache/generation-guarded-cache";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantToDate } from "#api/shared/domain/time/instant";

import type {
  CachedUserProfile,
  UserProfileCachePort,
} from "../../application/ports/user-profile-cache.port.js";
import type { UserProfileInvalidatorPort } from "../../application/ports/user-profile-invalidator.port.js";
import {
  USER_PROFILE_CACHE_TTL_MS,
  UserProfileCacheKey,
  userProfileTtlMs,
} from "../cache/user-profile-cache.keyspace.js";

const CACHED_USER_PROFILE_SCHEMA = z.looseObject({
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
}) satisfies z.ZodType<CachedUserProfile>;

function userProfileKey(userId: UserId): GenerationGuardedCacheKey {
  return {
    valueKey: UserProfileCacheKey.userProfile(userId.value),
    generationKey: UserProfileCacheKey.userProfileGeneration(userId.value),
  };
}

@Injectable()
export class UserProfileCacheAdapter implements UserProfileCachePort, UserProfileInvalidatorPort {
  readonly #userProfiles: GenerationGuardedCache;
  readonly #clock: ClockPort;

  constructor(cacheService: CacheStorePort, clock: ClockPort) {
    this.#userProfiles = new GenerationGuardedCache(cacheService, USER_PROFILE_CACHE_TTL_MS);
    this.#clock = clock;
  }

  invalidateUserProfile(userId: UserId): Promise<void> {
    return this.#userProfiles.invalidate(userProfileKey(userId));
  }

  async wrapUserProfile(
    userId: UserId,
    factory: () => Promise<CachedUserProfile | null>,
  ): Promise<CachedUserProfile | null> {
    const profile = await this.#userProfiles.wrap(
      userProfileKey(userId),
      CACHED_USER_PROFILE_SCHEMA.optional(),
      async () => (await factory()) ?? undefined,
      (cached) => userProfileTtlMs(cached ?? null, instantToDate(this.#clock.now())),
    );
    return profile ?? null;
  }
}
