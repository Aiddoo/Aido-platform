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

export interface RotateInviteCodeInput {
  readonly inviterId: string;
}

interface RotateInviteCodeDependencies {
  readonly inviteRepository: Pick<
    InviteRepositoryPort,
    "findActiveByInviterId" | "issue" | "saveRevocation"
  >;
  readonly myInviteReader: Pick<MyInviteReader, "read">;
  readonly inviteConfig: InviteConfigPort;
  readonly mutationLock: MutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLogger;
}

/** 지금 코드를 폐기하고 새 코드를 발급한다. 폐기한 코드로 들어오면 INVITE_2102가 된다. */
export class RotateInviteCode {
  readonly #dependencies: RotateInviteCodeDependencies;

  constructor(dependencies: RotateInviteCodeDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RotateInviteCodeInput): Promise<MyInviteView> {
    assertInviteEnabled(this.#dependencies.inviteConfig);

    const capturedAt = now();
    const { invite, revokedInviteId } = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([MutationLockKeys.invite(input.inviterId)]);
      const current = await this.#dependencies.inviteRepository.findActiveByInviterId(
        input.inviterId,
      );
      if (current?.revoke(capturedAt)) {
        await this.#dependencies.inviteRepository.saveRevocation(current);
      }

      const issued = await this.#dependencies.inviteRepository.issue({
        inviterId: input.inviterId,
        issuedAt: capturedAt,
      });
      return { invite: issued, revokedInviteId: current?.id ?? null };
    });

    this.#dependencies.logger.log({
      event: SocialInviteLogEvent.ROTATED,
      inviterId: input.inviterId,
      inviteId: invite.id,
      revokedInviteId,
    });
    return this.#dependencies.myInviteReader.read(invite, capturedAt);
  }
}
