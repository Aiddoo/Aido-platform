import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { assertInviteEnabled } from "../invites.errors.js";
import { InviteLockKeys } from "../invites.lock-keys.js";
import { InviteLogEvent } from "../invites.log-events.js";
import type { InviteConfigPort } from "../ports/invite-config.port.js";
import type { InviteRepositoryPort } from "../ports/invite.repository.port.js";
import type { MyInvite } from "../read-models/my-invite.read-model.js";
import type { IssueInviteUseCase } from "./issue-invite.use-case.js";
import type { SummarizeMyInviteUseCase } from "./summarize-my-invite.use-case.js";

export interface RotateInviteCodeCommand {
  readonly inviterId: string;
}

export interface RotateInviteCodeDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly inviteRepository: Pick<InviteRepositoryPort, "findActiveByInviterId" | "save">;
  readonly issueInvite: Pick<IssueInviteUseCase, "execute">;
  readonly summarizeMyInvite: Pick<SummarizeMyInviteUseCase, "execute">;
  readonly inviteConfig: Pick<InviteConfigPort, "isEnabled">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/** 지금 코드를 폐기하고 새 코드를 발급한다. 폐기한 코드로 들어오면 INVITE_2102가 된다. */
export class RotateInviteCodeUseCase {
  readonly #dependencies: RotateInviteCodeDependencies;

  constructor(dependencies: RotateInviteCodeDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: RotateInviteCodeCommand): Promise<MyInvite> {
    const { unitOfWork, mutationLock, inviteRepository, issueInvite, clock, logger } =
      this.#dependencies;
    assertInviteEnabled(this.#dependencies.inviteConfig);

    const inviterId = UserId.reconstitute(command.inviterId);
    const now = clock.now();
    const { invite, revokedInviteId } = await unitOfWork.run(async () => {
      await mutationLock.acquire([InviteLockKeys.invite(inviterId)]);
      const current = await inviteRepository.findActiveByInviterId(inviterId);
      if (current?.revoke(now) === true) {
        await inviteRepository.save(current);
      }

      const issued = await issueInvite.execute({ inviterId, now });
      return { invite: issued, revokedInviteId: current?.id.value ?? null };
    });

    logger.log({
      event: InviteLogEvent.ROTATED,
      inviterId: inviterId.value,
      inviteId: invite.id.value,
      revokedInviteId,
    });
    return this.#dependencies.summarizeMyInvite.execute({ invite, now });
  }
}
