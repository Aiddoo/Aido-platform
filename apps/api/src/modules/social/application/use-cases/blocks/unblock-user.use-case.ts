import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";

import { SocialBlockLogEvent } from "../../observability/blocks/social-block-log.events.js";
import { type UserBlockRepositoryPort } from "../../ports/blocks/user-block.repository.port.js";

export interface UnblockUserInput {
  readonly blockerId: string;
  readonly blockedId: string;
}

interface UnblockUserDependencies {
  readonly userBlockRepository: Pick<UserBlockRepositoryPort, "delete">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly logger: ApplicationLogger;
}

/** 차단을 해제한다. 끊긴 친구 관계는 되살리지 않는다. 없던 차단을 해제해도 성공으로 본다. */
export class UnblockUser {
  readonly #dependencies: UnblockUserDependencies;

  constructor(dependencies: UnblockUserDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UnblockUserInput): Promise<void> {
    const { blockerId, blockedId } = input;
    const isUnblocked = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        MutationLockKeys.friendPair(blockerId, blockedId),
      ]);
      return this.#dependencies.userBlockRepository.delete(blockerId, blockedId);
    });

    if (isUnblocked) {
      this.#dependencies.logger.log({
        event: SocialBlockLogEvent.UNBLOCKED,
        userId: blockerId,
        targetUserId: blockedId,
      });
    }
  }
}
