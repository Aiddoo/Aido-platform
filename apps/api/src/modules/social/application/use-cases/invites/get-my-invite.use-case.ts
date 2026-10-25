import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";

import { SocialInviteLogEvent } from "../../observability/invites/social-invite-log.events.js";
import type { InviteConfigPort } from "../../ports/invites/invite.config.port.js";
import type { InviteRepositoryPort } from "../../ports/invites/invite.repository.port.js";
import type { MyInviteView } from "../../read-models/invites/my-invite.read-model.js";
import { assertInviteEnabled } from "../../services/invites/invite-availability.guard.js";
import type { MyInviteReader } from "../../services/invites/my-invite.reader.js";

export interface GetMyInviteInput {
  readonly inviterId: string;
}

interface GetMyInviteDependencies {
  readonly inviteRepository: Pick<InviteRepositoryPort, "findActiveByInviterId" | "issue">;
  readonly myInviteReader: Pick<MyInviteReader, "read">;
  readonly inviteConfig: InviteConfigPort;
  readonly mutationLock: MutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLogger;
}

/** 처음 조회할 때 초대 코드를 발급하고 내 초대 요약을 반환한다. */
export class GetMyInvite {
  readonly #dependencies: GetMyInviteDependencies;

  constructor(dependencies: GetMyInviteDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetMyInviteInput): Promise<MyInviteView> {
    assertInviteEnabled(this.#dependencies.inviteConfig);

    const capturedAt = now();
    const invite =
      (await this.#dependencies.inviteRepository.findActiveByInviterId(input.inviterId)) ??
      (await this.#issueOnce(input.inviterId, capturedAt));

    return this.#dependencies.myInviteReader.read(invite, capturedAt);
  }

  // 동시에 처음 조회해도 같은 사람에게 ACTIVE 코드를 하나만 만든다
  async #issueOnce(inviterId: string, issuedAt: Date) {
    return this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([MutationLockKeys.invite(inviterId)]);
      const existing = await this.#dependencies.inviteRepository.findActiveByInviterId(inviterId);
      if (existing !== null) {
        return existing;
      }

      const invite = await this.#dependencies.inviteRepository.issue({ inviterId, issuedAt });
      this.#dependencies.logger.log({
        event: SocialInviteLogEvent.ISSUED,
        inviterId,
        inviteId: invite.id,
      });
      return invite;
    });
  }
}
