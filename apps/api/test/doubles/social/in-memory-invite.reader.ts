import { InviteReaderPort } from "#api/modules/social/invites/application/ports/invite.reader.port";
import type {
  InviterProfile,
  InviteWithInviterReadModel,
} from "#api/modules/social/invites/application/read-models/inviter-profile.read-model";
import type { InviteCode } from "#api/modules/social/shared/domain/invite-code.vo";
import { type InviteFixtureUser, INVITE_FIXTURE_USERS } from "#test/fixtures/social/invite.fixture";

import type { InMemoryInviteRepository } from "./in-memory-invite.repository.js";

function toProfile(user: InviteFixtureUser): InviterProfile {
  return {
    userId: user.id,
    name: user.name,
    userTag: user.userTag,
    profileImage: user.profileImage,
  };
}

// 초대 저장소 대역의 상태를 읽고 초대한 사람 프로필은 fixture 사용자에서 읽는다
export class InMemoryInviteReader extends InviteReaderPort {
  readonly #invites: InMemoryInviteRepository;
  readonly #profiles = new Map<string, InviterProfile>();
  readonly #withdrawnUserIds = new Set<string>();

  constructor(
    invites: InMemoryInviteRepository,
    users: readonly InviteFixtureUser[] = INVITE_FIXTURE_USERS,
  ) {
    super();
    this.#invites = invites;
    for (const user of users) {
      this.#profiles.set(user.id, toProfile(user));
    }
  }

  // 탈퇴 대기 중인 사람
  withdraw(userId: string): void {
    this.#withdrawnUserIds.add(userId);
  }

  async findByCodeWithInviter(code: InviteCode): Promise<InviteWithInviterReadModel | null> {
    const found = this.#invites.listAll().find((invite) => invite.code.equals(code));
    if (found == null || this.#withdrawnUserIds.has(found.inviterId.value)) {
      return null;
    }
    const inviter = this.#profiles.get(found.inviterId.value);
    if (inviter == null) {
      throw new Error(`초대한 사람 ${found.inviterId.value}의 프로필이 없습니다`);
    }
    return {
      inviteId: found.id.value,
      inviterId: found.inviterId.value,
      isActive: found.isActive(),
      inviter,
    };
  }
}
