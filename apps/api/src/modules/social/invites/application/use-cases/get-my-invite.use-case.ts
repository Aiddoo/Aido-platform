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
import type { IssueInviteUseCase } from "./issue-invite.use-case.js";
import type { SummarizeMyInviteUseCase } from "./summarize-my-invite.use-case.js";

export interface GetMyInviteQuery {
  readonly inviterId: string;
}

export interface GetMyInviteDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly inviteRepository: Pick<InviteRepositoryPort, "findActiveByInviterId">;
  readonly issueInvite: Pick<IssueInviteUseCase, "execute">;
  readonly summarizeMyInvite: Pick<SummarizeMyInviteUseCase, "execute">;
  readonly inviteConfig: Pick<InviteConfigPort, "isEnabled">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/** 처음 조회할 때 초대 코드를 발급하고 내 초대 요약을 반환한다. */
export class GetMyInviteUseCase {
  readonly #dependencies: GetMyInviteDependencies;

  constructor(dependencies: GetMyInviteDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetMyInviteQuery): Promise<MyInvite> {
    const { inviteRepository, inviteConfig, clock, summarizeMyInvite } = this.#dependencies;
    assertInviteEnabled(inviteConfig);

    const inviterId = UserId.reconstitute(query.inviterId);
    const now = clock.now();
    const invite =
      (await inviteRepository.findActiveByInviterId(inviterId)) ??
      (await this.#issueOnce(inviterId, now));

    return summarizeMyInvite.execute({ invite, now });
  }

  // 동시에 처음 조회해도 같은 사람에게 ACTIVE 코드를 하나만 만든다
  async #issueOnce(inviterId: UserId, now: Temporal.Instant): Promise<Invite> {
    const { unitOfWork, mutationLock, inviteRepository, issueInvite, logger } = this.#dependencies;
    return unitOfWork.run(async () => {
      await mutationLock.acquire([InviteLockKeys.invite(inviterId)]);
      const existing = await inviteRepository.findActiveByInviterId(inviterId);
      if (existing != null) {
        return existing;
      }

      const invite = await issueInvite.execute({ inviterId, now });
      logger.log({
        event: InviteLogEvent.ISSUED,
        inviterId: inviterId.value,
        inviteId: invite.id.value,
      });
      return invite;
    });
  }
}
