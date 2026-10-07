import { Injectable } from "@nestjs/common";

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

@Injectable()
export class AuthCacheAdapter implements AuthCachePort {
  constructor(private readonly cacheService: CacheService) {}

  getSession(sessionId: string): Promise<AuthCachedSession | undefined> {
    return this.cacheService.get(IdentityCacheKey.session(sessionId));
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
      factory,
      IDENTITY_CACHE_TTL_MS.USER_PROFILE,
    );
  }
}
