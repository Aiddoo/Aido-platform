import { InviteRepositoryPort } from "#api/modules/social/invites/application/ports/invite.repository.port";
import { Invite } from "#api/modules/social/invites/domain/invite.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

function copyOf(invite: Invite): Invite {
  return Invite.reconstitute(invite.toPrimitives());
}

// Drizzle 저장소처럼 코드 UNIQUE·사람마다 ACTIVE 하나를 지킨다
export class InMemoryInviteRepository extends InviteRepositoryPort {
  readonly #invites = new Map<string, Invite>();

  constructor(invites: readonly Invite[] = []) {
    super();
    for (const invite of invites) {
      this.#invites.set(invite.id.value, copyOf(invite));
    }
  }

  get size(): number {
    return this.#invites.size;
  }

  // InMemory 조회 대역이 같은 상태를 읽도록 연다
  listAll(): Invite[] {
    return [...this.#invites.values()].map(copyOf);
  }

  async findActiveByInviterId(inviterId: UserId): Promise<Invite | null> {
    const found = [...this.#invites.values()].find(
      (invite) => invite.isIssuedBy(inviterId) && invite.isActive(),
    );
    return found == null ? null : copyOf(found);
  }

  async saveIfCodeUnused(invite: Invite): Promise<boolean> {
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
