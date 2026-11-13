import { InviteCode } from "../../../shared/domain/invite-code.vo.js";
import { assertInviteEnabled, inviteNotFound, inviteRevoked } from "../invites.errors.js";
import type { InviteConfigPort } from "../ports/invite-config.port.js";
import type { InviteReaderPort } from "../ports/invite.reader.port.js";
import type { InviterProfile } from "../read-models/inviter-profile.read-model.js";

export interface PreviewInviteQuery {
  readonly code: string;
}

export interface PreviewInviteDependencies {
  readonly inviteReader: Pick<InviteReaderPort, "findByCodeWithInviter">;
  readonly inviteConfig: Pick<InviteConfigPort, "isEnabled">;
}

// 로그인 전에도 누가 초대했는지만 보여 준다
export class PreviewInviteUseCase {
  readonly #dependencies: PreviewInviteDependencies;

  constructor(dependencies: PreviewInviteDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: PreviewInviteQuery): Promise<InviterProfile> {
    assertInviteEnabled(this.#dependencies.inviteConfig);

    const found = await this.#dependencies.inviteReader.findByCodeWithInviter(
      InviteCode.create(query.code),
    );
    if (found == null) {
      throw inviteNotFound();
    }
    if (!found.isActive) {
      throw inviteRevoked();
    }

    return found.inviter;
  }
}
