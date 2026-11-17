import { Injectable } from "@nestjs/common";

import { UserBriefReaderPort } from "#api/modules/identity/users/identity-users.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { FriendProfileReaderPort } from "../../application/ports/friend-profile.reader.port.js";
import type { UserTag } from "../../domain/user-tag.vo.js";

@Injectable()
export class FriendProfileReaderAdapter implements FriendProfileReaderPort {
  readonly #userBriefReader: UserBriefReaderPort;

  constructor(userBriefReader: UserBriefReaderPort) {
    this.#userBriefReader = userBriefReader;
  }

  existsActiveUser(userId: UserId): Promise<boolean> {
    return this.#userBriefReader.existsActiveUser(userId);
  }

  findActiveUserIdByTag(userTag: UserTag): Promise<UserId | null> {
    return this.#userBriefReader.findActiveUserIdByTag(userTag.value);
  }

  async findDisplayName(userId: UserId): Promise<string | null> {
    const [brief] = await this.#userBriefReader.findByUserIds([userId]);
    return brief == null ? null : (brief.name ?? brief.userTag);
  }
}
