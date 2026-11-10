import { FriendLockKeys } from "#api/modules/social/friends/application/friends.lock-keys";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { type MutationLockPort, type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { BlockLogEvent } from "../blocks.log-events.js";
import { type UserBlockRepositoryPort } from "../ports/user-block.repository.port.js";

export interface UnblockUserInput {
  readonly blockerId: string;
  readonly blockedId: string;
}

interface UnblockUserDependencies {
  readonly userBlockRepository: Pick<UserBlockRepositoryPort, "delete">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly logger: ApplicationLoggerPort;
}

/** 차단을 해제한다. 끊긴 친구 관계는 되살리지 않는다. 없던 차단을 해제해도 성공으로 본다. */
export class UnblockUserUseCase {
  readonly #dependencies: UnblockUserDependencies;

  constructor(dependencies: UnblockUserDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UnblockUserInput): Promise<void> {
    const { blockerId, blockedId } = input;
    const isUnblocked = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        FriendLockKeys.pair(UserId.reconstitute(blockerId), UserId.reconstitute(blockedId)),
      ]);
      return this.#dependencies.userBlockRepository.delete(blockerId, blockedId);
    });

    if (isUnblocked) {
      this.#dependencies.logger.log({
        event: BlockLogEvent.UNBLOCKED,
        userId: blockerId,
        targetUserId: blockedId,
      });
    }
  }
}
