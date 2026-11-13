import { inviteAlreadyRedeemed } from "#api/modules/social/invite-redemptions/application/invite-redemptions.errors";
import { InviteRedemptionRepositoryPort } from "#api/modules/social/invite-redemptions/application/ports/invite-redemption.repository.port";
import type { InviteRedemptionId } from "#api/modules/social/invite-redemptions/domain/invite-redemption-id.vo";
import { InviteRedemption } from "#api/modules/social/invite-redemptions/domain/invite-redemption.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function copyOf(redemption: InviteRedemption): InviteRedemption {
  return InviteRedemption.reconstitute(redemption.toPrimitives());
}

// Drizzle 저장소와 같은 순서: 마감·id 오름차순
function compareExpiringFirst(
  left: Pick<InviteRedemption, "expiresAt"> & { readonly idValue: string },
  right: Pick<InviteRedemption, "expiresAt"> & { readonly idValue: string },
): number {
  return (
    Temporal.Instant.compare(left.expiresAt, right.expiresAt) ||
    compareText(left.idValue, right.idValue)
  );
}

export class InMemoryInviteRedemptionRepository extends InviteRedemptionRepositoryPort {
  readonly #redemptions = new Map<string, InviteRedemption>();

  constructor(redemptions: readonly InviteRedemption[] = []) {
    super();
    for (const redemption of redemptions) {
      this.#redemptions.set(redemption.id.value, copyOf(redemption));
    }
  }

  get size(): number {
    return this.#redemptions.size;
  }

  // InMemory 조회 대역이 같은 상태를 읽도록 연다
  listAll(): InviteRedemption[] {
    return this.#all().map(copyOf);
  }

  // Drizzle 저장소처럼 같은 초대받은 사람의 다른 수락이 있으면 INVITE_2104로 거절한다
  async save(redemption: InviteRedemption): Promise<void> {
    const isOtherRedemptionOfInvitee = this.#all().some(
      (existing) =>
        existing.inviteeId.equals(redemption.inviteeId) && !existing.id.equals(redemption.id),
    );
    if (isOtherRedemptionOfInvitee) {
      throw inviteAlreadyRedeemed();
    }
    this.#redemptions.set(redemption.id.value, copyOf(redemption));
  }

  async existsJoinedByInviteeId(inviteeId: UserId): Promise<boolean> {
    return this.#all().some(
      (redemption) => redemption.inviteeId.equals(inviteeId) && redemption.status === "JOINED",
    );
  }

  async findByInviteeIdForUpdate(inviteeId: UserId): Promise<InviteRedemption | null> {
    const found = this.#all().find((redemption) => redemption.inviteeId.equals(inviteeId));
    return found == null ? null : copyOf(found);
  }

  async findByIdForUpdate(redemptionId: InviteRedemptionId): Promise<InviteRedemption | null> {
    const found = this.#redemptions.get(redemptionId.value);
    return found == null ? null : copyOf(found);
  }

  async expireJoinedBefore(at: Temporal.Instant, limit: number): Promise<number> {
    const expiring = this.#all()
      .filter(
        (redemption) =>
          redemption.status === "JOINED" && Temporal.Instant.compare(redemption.expiresAt, at) <= 0,
      )
      .map((redemption) => ({
        redemption,
        expiresAt: redemption.expiresAt,
        idValue: redemption.id.value,
      }))
      .toSorted(compareExpiringFirst)
      .slice(0, limit);
    for (const { redemption } of expiring) {
      redemption.expire(at);
      this.#redemptions.set(redemption.id.value, copyOf(redemption));
    }
    return expiring.length;
  }

  #all(): InviteRedemption[] {
    return [...this.#redemptions.values()];
  }
}
