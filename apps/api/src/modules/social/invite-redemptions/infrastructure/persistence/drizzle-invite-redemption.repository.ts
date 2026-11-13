import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, inArray, lte } from "drizzle-orm";

import {
  databaseConstraint,
  isUniqueConstraintViolation,
} from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { inviteActiveDay, inviteRedemption } from "#api/platform/database/schema/index";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { inviteAlreadyRedeemed } from "../../application/invite-redemptions.errors.js";
import { InviteRedemptionRepositoryPort } from "../../application/ports/invite-redemption.repository.port.js";
import type { InviteRedemptionId } from "../../domain/invite-redemption-id.vo.js";
import type { InviteRedemption } from "../../domain/invite-redemption.aggregate.js";
import {
  INVITE_REDEMPTION_COLUMNS,
  toInviteRedemption,
  toInviteRedemptionRow,
} from "./invite-redemption-row.mapper.js";

const INVITEE_UNIQUE_CONSTRAINT = "InviteRedemption_inviteeId_key";

@Injectable()
export class DrizzleInviteRedemptionRepository implements InviteRedemptionRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #clock: ClockPort;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>, clock: ClockPort) {
    this.#txHost = txHost;
    this.#clock = clock;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async save(redemption: InviteRedemption): Promise<void> {
    const row = toInviteRedemptionRow(redemption);
    const updatedAt = this.#clock.now();
    try {
      await this.#db
        .insert(inviteRedemption)
        .values({ ...row, updatedAt })
        .onConflictDoUpdate({
          target: inviteRedemption.id,
          set: {
            status: row.status,
            rejectionReason: row.rejectionReason,
            qualifiedAt: row.qualifiedAt,
            rewardedAt: row.rewardedAt,
            rejectedAt: row.rejectedAt,
            qualifyReminderSentAt: row.qualifyReminderSentAt,
            updatedAt,
          },
        });
    } catch (error) {
      // 같은 초대받은 사람의 다른 수락이 먼저 저장됐다. 트랜잭션이 끝나 함께 넣은 claim도 되돌아간다
      if (
        isUniqueConstraintViolation(error) &&
        databaseConstraint(error) === INVITEE_UNIQUE_CONSTRAINT
      ) {
        throw inviteAlreadyRedeemed();
      }
      throw error;
    }
    await this.#addActiveDays(redemption);
  }

  async existsJoinedByInviteeId(inviteeId: UserId): Promise<boolean> {
    const row = await this.#db.query.inviteRedemption.findFirst({
      columns: { id: true },
      where: { inviteeId: inviteeId.value, status: "JOINED" },
    });
    return row != null;
  }

  async findByInviteeIdForUpdate(inviteeId: UserId): Promise<InviteRedemption | null> {
    const [locked] = await this.#db
      .select({ id: inviteRedemption.id })
      .from(inviteRedemption)
      .where(eq(inviteRedemption.inviteeId, inviteeId.value))
      .limit(1)
      .for("update");
    return locked == null ? null : this.#findById(locked.id);
  }

  async findByIdForUpdate(redemptionId: InviteRedemptionId): Promise<InviteRedemption | null> {
    const [locked] = await this.#db
      .select({ id: inviteRedemption.id })
      .from(inviteRedemption)
      .where(eq(inviteRedemption.id, redemptionId.value))
      .limit(1)
      .for("update");
    return locked == null ? null : this.#findById(locked.id);
  }

  async expireJoinedBefore(at: Temporal.Instant, limit: number): Promise<number> {
    const claimed = await this.#db
      .select({ id: inviteRedemption.id })
      .from(inviteRedemption)
      .where(and(eq(inviteRedemption.status, "JOINED"), lte(inviteRedemption.expiresAt, at)))
      .orderBy(inviteRedemption.expiresAt, inviteRedemption.id)
      .limit(limit)
      .for("update", { skipLocked: true });
    if (claimed.length === 0) {
      return 0;
    }

    const expired = await this.#db
      .update(inviteRedemption)
      .set({ status: "REJECTED", rejectionReason: "EXPIRED", rejectedAt: at, updatedAt: at })
      .where(
        and(
          inArray(
            inviteRedemption.id,
            claimed.map((item) => item.id),
          ),
          eq(inviteRedemption.status, "JOINED"),
        ),
      )
      .returning({ id: inviteRedemption.id });
    return expired.length;
  }

  // 활동일은 (수락, 날짜) 기본 키라 이미 있는 날짜는 건너뛰어 같은 날을 두 번 세지 않는다
  async #addActiveDays(redemption: InviteRedemption): Promise<void> {
    if (redemption.activeDays.length === 0) {
      return;
    }
    await this.#db
      .insert(inviteActiveDay)
      .values(
        redemption.activeDays.map((localDate) => ({
          redemptionId: redemption.id.value,
          localDate,
        })),
      )
      .onConflictDoNothing({ target: [inviteActiveDay.redemptionId, inviteActiveDay.localDate] });
  }

  async #findById(redemptionId: string): Promise<InviteRedemption | null> {
    const row = await this.#db.query.inviteRedemption.findFirst({
      columns: INVITE_REDEMPTION_COLUMNS,
      where: { id: redemptionId },
      with: { activeDays: { columns: { localDate: true } } },
    });
    if (row == null) {
      return null;
    }
    const { activeDays, ...redemptionRow } = row;
    return toInviteRedemption(
      redemptionRow,
      activeDays.map((day) => day.localDate),
    );
  }
}
