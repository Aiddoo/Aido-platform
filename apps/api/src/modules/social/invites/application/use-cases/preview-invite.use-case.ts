import { InviteCode } from "../../domain/invite-code.vo.js";
import { assertInviteEnabled, inviteNotFound, inviteRevoked } from "../invites.errors.js";
import type { InviteConfigPort } from "../ports/invite-config.port.js";
import type { InviteRepositoryPort } from "../ports/invite.repository.port.js";
import type { InviterProfile } from "../read-models/inviter-profile.read-model.js";

export interface PreviewInviteQuery {
  readonly code: string;
}

export interface PreviewInviteDependencies {
  readonly inviteRepository: Pick<InviteRepositoryPort, "findByCodeWithInviter">;
  readonly inviteConfig: Pick<InviteConfigPort, "isEnabled">;
}

/** 로그인 전에도 누가 초대했는지만 보여 준다. */
export class PreviewInviteUseCase {
  readonly #dependencies: PreviewInviteDependencies;

  constructor(dependencies: PreviewInviteDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: PreviewInviteQuery): Promise<InviterProfile> {
    assertInviteEnabled(this.#dependencies.inviteConfig);

    const found = await this.#dependencies.inviteRepository.findByCodeWithInviter(
      InviteCode.create(query.code),
    );
    if (found == null) {
      throw inviteNotFound();
    }
    if (!found.invite.isActive()) {
      throw inviteRevoked();
    }

    return found.inviter;
  }
}
