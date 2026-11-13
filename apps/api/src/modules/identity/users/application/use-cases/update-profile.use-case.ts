import type { UpdateProfileResult } from "#api/modules/identity/auth/application/read-models/auth-result.read-model";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { AuthLogEvent } from "../../../auth/application/auth.log-events.js";
import type { AuthCachePort } from "../../../auth/application/ports/auth-collaboration.port.js";
import type { AuthUserRepositoryPort } from "../../../auth/application/ports/auth-user.repository.port.js";

export interface UpdateProfileCommand {
  readonly userId: string;
  readonly name?: string;
  // PATCH라 undefined는 그대로 두고 null은 지운다
  readonly profileImage?: string | null;
}

interface UpdateProfileDependencies {
  readonly userRepository: Pick<AuthUserRepositoryPort, "updateProfile">;
  readonly cacheService: Pick<AuthCachePort, "invalidateUserProfile">;
  readonly logger: ApplicationLoggerPort;
}

export class UpdateProfileUseCase {
  readonly #dependencies: UpdateProfileDependencies;

  constructor(dependencies: UpdateProfileDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateProfileCommand): Promise<UpdateProfileResult> {
    const { userId: rawUserId, ...data } = input;
    const userId = UserId.reconstitute(rawUserId);
    const profile = await this.#dependencies.userRepository.updateProfile(userId, data);

    await this.#dependencies.cacheService.invalidateUserProfile(userId);

    this.#dependencies.logger.log({ event: AuthLogEvent.PROFILE_UPDATED, userId: rawUserId });

    return {
      message: "프로필이 수정되었습니다.",
      name: profile.name,
      profileImage: profile.profileImage,
    };
  }
}
