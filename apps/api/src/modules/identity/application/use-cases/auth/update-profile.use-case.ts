import type { UpdateProfileInput as UpdateProfileBody } from "@aido/api";

import type { UpdateProfileResult } from "#api/modules/identity/application/types/auth/index";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { IdentityLogEvent } from "../../observability/auth/identity-log.events.js";
import type { AuthCachePort } from "../../ports/auth/auth-collaboration.port.js";
import type { AuthUserRepositoryPort } from "../../ports/auth/auth-persistence.port.js";

export type UpdateProfileInput = Readonly<UpdateProfileBody> & { readonly userId: string };

interface UpdateProfileDependencies {
  readonly userRepository: Pick<AuthUserRepositoryPort, "updateProfile">;
  readonly cacheService: Pick<AuthCachePort, "invalidateUserProfile">;
  readonly logger: ApplicationLogger;
}

export class UpdateProfile {
  readonly #dependencies: UpdateProfileDependencies;

  constructor(dependencies: UpdateProfileDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateProfileInput): Promise<UpdateProfileResult> {
    const { userId, ...data } = input;
    const profile = await this.#dependencies.userRepository.updateProfile(userId, data);

    await this.#dependencies.cacheService.invalidateUserProfile(userId);

    this.#dependencies.logger.log({ event: IdentityLogEvent.PROFILE_UPDATED, userId });

    return {
      message: "프로필이 수정되었습니다.",
      name: profile.name,
      profileImage: profile.profileImage,
    };
  }
}
