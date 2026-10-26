import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { InviteCode } from "../../../domain/value-objects/invites/invite-code.vo.js";
import type { InviteConfigPort } from "../../ports/invites/invite.config.port.js";
import type {
  InviteRepositoryPort,
  InviterProfile,
} from "../../ports/invites/invite.repository.port.js";
import { assertInviteEnabled } from "../../services/invites/invite-availability.guard.js";

export interface PreviewInviteInput {
  readonly code: string;
}

interface PreviewInviteDependencies {
  readonly inviteRepository: Pick<InviteRepositoryPort, "findByCodeWithInviter">;
  readonly inviteConfig: InviteConfigPort;
}

/** 로그인 전에도 누가 초대했는지만 보여 준다. */
export class PreviewInvite {
  readonly #dependencies: PreviewInviteDependencies;

  constructor(dependencies: PreviewInviteDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: PreviewInviteInput): Promise<InviterProfile> {
    assertInviteEnabled(this.#dependencies.inviteConfig);

    const found = await this.#dependencies.inviteRepository.findByCodeWithInviter(
      InviteCode.of(input.code),
    );
    if (found == null) {
      throw new ApplicationException(ErrorCode.INVITE_2101);
    }
    if (!found.invite.isActive()) {
      throw new ApplicationException(ErrorCode.INVITE_2102);
    }

    return found.inviter;
  }
}
