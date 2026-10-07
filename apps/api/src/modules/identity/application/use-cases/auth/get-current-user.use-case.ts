import { ErrorCode } from "@aido/api/errors";

import type { CurrentUserResult } from "#api/modules/identity/application/types/auth/index";
import { toISOString, toISOStringOrNull } from "#api/shared/domain/date/utils/format";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type { AuthCachePort } from "../../ports/auth/auth-collaboration.port.js";
import type { AuthUserRepositoryPort } from "../../ports/auth/auth-persistence.port.js";

export interface GetCurrentUserInput {
  readonly userId: string;
  readonly sessionId: string;
}

interface GetCurrentUserDependencies {
  readonly userRepository: Pick<AuthUserRepositoryPort, "findByIdWithProfile">;
  readonly cacheService: Pick<AuthCachePort, "wrapUserProfile">;
}

export class GetCurrentUser {
  readonly #dependencies: GetCurrentUserDependencies;

  constructor(dependencies: GetCurrentUserDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetCurrentUserInput): Promise<CurrentUserResult> {
    const { userId, sessionId } = input;
    const cachedProfile = await this.#dependencies.cacheService.wrapUserProfile(
      userId,
      async () => {
        const user = await this.#dependencies.userRepository.findByIdWithProfile(userId);
        if (user === null) {
          return undefined;
        }
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          userTag: user.userTag,
          status: user.status,
          emailVerifiedAt: toISOStringOrNull(user.emailVerifiedAt),
          subscriptionStatus: user.subscriptionStatus,
          subscriptionExpiresAt: toISOStringOrNull(user.subscriptionExpiresAt),
          name: user.profile?.name ?? null,
          profileImage: user.profile?.profileImage ?? null,
          createdAt: toISOString(user.createdAt),
          providers: user.accounts.map((a) => a.provider),
        };
      },
    );

    if (cachedProfile === undefined) {
      throw new ApplicationException(ErrorCode.USER_0601, { userId });
    }

    return {
      userId: cachedProfile.id,
      email: cachedProfile.email,
      sessionId,
      role: cachedProfile.role,
      userTag: cachedProfile.userTag,
      status: cachedProfile.status,
      emailVerifiedAt: cachedProfile.emailVerifiedAt,
      subscriptionStatus: cachedProfile.subscriptionStatus,
      subscriptionExpiresAt: cachedProfile.subscriptionExpiresAt,
      name: cachedProfile.name,
      profileImage: cachedProfile.profileImage,
      createdAt: cachedProfile.createdAt,
      providers: cachedProfile.providers,
    };
  }
}
