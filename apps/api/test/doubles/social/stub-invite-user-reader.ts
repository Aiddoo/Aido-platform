import { InviteUserReaderPort } from "#api/modules/social/invites/application/ports/invite-user.reader.port";
import type { InviteeIdentity } from "#api/modules/social/invites/application/read-models/invitee-identity.read-model";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { INVITE_FIXTURE_NOW, INVITE_FIXTURE_USERS } from "#test/fixtures/social/invite.fixture";

// fixture 사용자를 모두 방금 가입한 사람으로 두고, 인증 이메일·소셜 계정·탈퇴만 바꿔 쓴다
export class StubInviteUserReader extends InviteUserReaderPort {
  readonly #identities = new Map<string, InviteeIdentity>();
  readonly #withdrawnUserIds = new Set<string>();

  constructor() {
    super();
    for (const user of INVITE_FIXTURE_USERS) {
      this.#identities.set(user.id, {
        userId: user.id,
        displayName: user.name ?? user.userTag,
        joinedAt: INVITE_FIXTURE_NOW,
        verifiedEmail: `${user.userTag.toLowerCase()}@example.test`,
        providerAccounts: [],
      });
    }
  }

  setIdentity(identity: InviteeIdentity): void {
    this.#identities.set(identity.userId, identity);
  }

  remove(userId: string): void {
    this.#identities.delete(userId);
  }

  /** 탈퇴 처리된 사람은 알림 이름을 읽지 못한다. */
  withdraw(userId: string): void {
    this.#withdrawnUserIds.add(userId);
  }

  async findInviteeIdentity(userId: UserId): Promise<InviteeIdentity | null> {
    return this.#identities.get(userId.value) ?? null;
  }

  async findDisplayName(userId: UserId): Promise<string | null> {
    if (this.#withdrawnUserIds.has(userId.value)) {
      return null;
    }
    return this.#identities.get(userId.value)?.displayName ?? null;
  }
}
