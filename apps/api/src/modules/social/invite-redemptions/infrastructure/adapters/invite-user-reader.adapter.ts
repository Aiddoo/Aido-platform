import { Injectable } from "@nestjs/common";

import { UserBriefReaderPort } from "#api/modules/identity/users/identity-users.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { InviteUserReaderPort } from "../../application/ports/invite-user.reader.port.js";
import type { InviteeIdentityReadModel } from "../../application/read-models/invitee-identity.read-model.js";

@Injectable()
export class InviteUserReaderAdapter implements InviteUserReaderPort {
  readonly #userBriefReader: UserBriefReaderPort;

  constructor(userBriefReader: UserBriefReaderPort) {
    this.#userBriefReader = userBriefReader;
  }

  async findInviteeIdentity(userId: UserId): Promise<InviteeIdentityReadModel | null> {
    const identity = await this.#userBriefReader.findAccountIdentity(userId);
    if (identity == null) {
      return null;
    }
    return {
      userId: identity.user.userId.value,
      displayName: identity.user.name ?? identity.user.userTag,
      joinedAt: identity.joinedAt,
      verifiedEmail: identity.verifiedEmail,
      providerAccounts: identity.providerAccounts,
    };
  }

  async findDisplayName(userId: UserId): Promise<string | null> {
    const [brief] = await this.#userBriefReader.listByUserIds([userId]);
    if (brief == null || brief.isDeletionPending) {
      return null;
    }
    return brief.name ?? brief.userTag;
  }
}
