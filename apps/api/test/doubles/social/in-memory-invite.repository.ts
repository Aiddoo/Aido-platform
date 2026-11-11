import { InviteRepositoryPort } from "#api/modules/social/invites/application/ports/invite.repository.port";
import type {
  InviterProfile,
  InviteWithInviter,
} from "#api/modules/social/invites/application/read-models/inviter-profile.read-model";
import type { InviteCode } from "#api/modules/social/invites/domain/invite-code.vo";
import { InviteId } from "#api/modules/social/invites/domain/invite-id.vo";
import { Invite } from "#api/modules/social/invites/domain/invite.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { type InviteFixtureUser, INVITE_FIXTURE_USERS } from "#test/fixtures/social/invite.fixture";

function copyOf(invite: Invite): Invite {
  return Invite.reconstitute(invite.toPrimitives());
}

function toProfile(user: InviteFixtureUser): InviterProfile {
  return {
    userId: user.id,
    name: user.name,
    userTag: user.userTag,
    profileImage: user.profileImage,
  };
}

// Drizzle 저장소처럼 코드 UNIQUE·사람마다 ACTIVE 하나를 지키고, 초대한 사람 프로필은 fixture 사용자에서 읽는다
export class InMemoryInviteRepository extends InviteRepositoryPort {
  readonly #invites = new Map<string, Invite>();
  readonly #profiles = new Map<string, InviterProfile>();
  readonly #withdrawnUserIds = new Set<string>();
  #sequence = 0;

  constructor(
    invites: readonly Invite[] = [],
    users: readonly InviteFixtureUser[] = INVITE_FIXTURE_USERS,
  ) {
    super();
    for (const user of users) {
      this.#profiles.set(user.id, toProfile(user));
    }
    for (const invite of invites) {
      this.#invites.set(invite.id.value, copyOf(invite));
    }
  }

  get size(): number {
    return this.#invites.size;
  }

  /** 탈퇴 대기 중인 사람 */
  withdraw(userId: string): void {
    this.#withdrawnUserIds.add(userId);
  }

  async nextId(): Promise<InviteId> {
    this.#sequence += 1;
    return InviteId.reconstitute(`c${String(this.#sequence).padStart(24, "0")}`);
  }

  async findActiveByInviterId(inviterId: UserId): Promise<Invite | null> {
    const found = [...this.#invites.values()].find(
      (invite) => invite.isIssuedBy(inviterId) && invite.isActive(),
    );
    return found == null ? null : copyOf(found);
  }

  async findByCodeWithInviter(code: InviteCode): Promise<InviteWithInviter | null> {
    const found = [...this.#invites.values()].find((invite) => invite.code.equals(code));
    if (found == null || this.#withdrawnUserIds.has(found.inviterId.value)) {
      return null;
    }
    const inviter = this.#profiles.get(found.inviterId.value);
    if (inviter == null) {
      throw new Error(`초대한 사람 ${found.inviterId.value}의 프로필이 없습니다`);
    }
    return { invite: copyOf(found), inviter };
  }

  async add(invite: Invite): Promise<boolean> {
    const invites = [...this.#invites.values()];
    if (invites.some((existing) => existing.code.equals(invite.code))) {
      return false;
    }
    if (
      invite.isActive() &&
      invites.some((existing) => existing.isActive() && existing.inviterId.equals(invite.inviterId))
    ) {
      throw new Error("Invite_inviterId_active_key UNIQUE 위반");
    }
    this.#invites.set(invite.id.value, copyOf(invite));
    return true;
  }

  async save(invite: Invite): Promise<void> {
    if (this.#invites.has(invite.id.value)) {
      this.#invites.set(invite.id.value, copyOf(invite));
    }
  }
}
