import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { Invite } from "../../domain/invite.aggregate.js";
import { assertInviteEnabled } from "../invites.errors.js";
import { InviteLockKeys } from "../invites.lock-keys.js";
import { InviteLogEvent } from "../invites.log-events.js";
import type { InviteConfigPort } from "../ports/invite-config.port.js";
import type { InviteRepositoryPort } from "../ports/invite.repository.port.js";
import type { MyInvite } from "../read-models/my-invite.read-model.js";
import type { IssueInviteCodeUseCase } from "./issue-invite-code.use-case.js";
import type { SummarizeMyInviteUseCase } from "./summarize-my-invite.use-case.js";

export interface IssueMyInviteCommand {
  readonly inviterId: string;
}

export interface IssueMyInviteDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly inviteRepository: Pick<InviteRepositoryPort, "findActiveByInviterId">;
  readonly issueInviteCode: Pick<IssueInviteCodeUseCase, "execute">;
  readonly summarizeMyInvite: Pick<SummarizeMyInviteUseCase, "execute">;
  readonly inviteConfig: Pick<InviteConfigPort, "isEnabled">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

// 처음 열면 내 초대 코드를 발급하고 이후에는 같은 코드로 내 초대 요약을 반환한다(API는 "내 초대 조회")
export class IssueMyInviteUseCase {
  readonly #dependencies: IssueMyInviteDependencies;

  constructor(dependencies: IssueMyInviteDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: IssueMyInviteCommand): Promise<MyInvite> {
    const { inviteRepository, inviteConfig, clock, summarizeMyInvite } = this.#dependencies;
    assertInviteEnabled(inviteConfig);

    const inviterId = UserId.reconstitute(command.inviterId);
    const now = clock.now();
    const invite =
      (await inviteRepository.findActiveByInviterId(inviterId)) ??
      (await this.#issueOnce(inviterId, now));

    return summarizeMyInvite.execute({ invite, now });
  }

  // 동시에 처음 열어도 같은 사람에게 ACTIVE 코드를 하나만 만든다
  async #issueOnce(inviterId: UserId, now: Temporal.Instant): Promise<Invite> {
    const { unitOfWork, mutationLock, inviteRepository, issueInviteCode, logger } =
      this.#dependencies;
    return unitOfWork.run(async () => {
      await mutationLock.acquire([InviteLockKeys.invite(inviterId)]);
      const existing = await inviteRepository.findActiveByInviterId(inviterId);
      if (existing != null) {
        return existing;
      }

      const invite = await issueInviteCode.execute({ inviterId, now });
      logger.log({
        event: InviteLogEvent.ISSUED,
        inviterId: inviterId.value,
        inviteId: invite.id.value,
      });
      return invite;
    });
  }
}
