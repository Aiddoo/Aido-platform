import type { RedemptionStatus } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, count, eq, inArray, lte } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { createEntityId } from "#api/platform/database/entity-id";
import { tupleLessThan } from "#api/platform/database/keyset";
import { inviteActiveDay, inviteRedemption } from "#api/platform/database/schema/index";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { InviteRedemptionRepositoryPort } from "../../application/ports/invite-redemption.repository.port.js";
import type { InviteRedemptionSummary } from "../../application/read-models/invite-redemption-summary.read-model.js";
import type { InvitedFriend } from "../../application/read-models/invited-friend.read-model.js";
import type { QualifyReminderCandidate } from "../../application/read-models/qualify-reminder-candidate.read-model.js";
import { InviteRedemptionId } from "../../domain/invite-redemption-id.vo.js";
import type { InviteRedemption } from "../../domain/invite-redemption.aggregate.js";
import {
  INVITE_REDEMPTION_COLUMNS,
  toInviteRedemption,
  toInviteRedemptionRow,
} from "./invite-redemption-row.mapper.js";

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

  #activeDayCount() {
    return (redemption: typeof inviteRedemption) =>
      this.#db.$count(inviteActiveDay, eq(inviteActiveDay.redemptionId, redemption.id));
  }

  async nextId(): Promise<InviteRedemptionId> {
    return InviteRedemptionId.reconstitute(createEntityId());
  }

  async add(redemption: InviteRedemption): Promise<boolean> {
    const inserted = await this.#db
      .insert(inviteRedemption)
      .values({ ...toInviteRedemptionRow(redemption), updatedAt: this.#clock.now() })
      .onConflictDoNothing({ target: inviteRedemption.inviteeId })
      .returning({ id: inviteRedemption.id });
    if (inserted.length === 0) {
      return false;
    }
    await this.#addActiveDays(redemption);
    return true;
  }

  async save(redemption: InviteRedemption): Promise<void> {
    const row = toInviteRedemptionRow(redemption);
    await this.#db
      .update(inviteRedemption)
      .set({
        status: row.status,
        rejectionReason: row.rejectionReason,
        qualifiedAt: row.qualifiedAt,
        rewardedAt: row.rewardedAt,
        rejectedAt: row.rejectedAt,
        qualifyReminderSentAt: row.qualifyReminderSentAt,
        updatedAt: this.#clock.now(),
      })
      .where(eq(inviteRedemption.id, row.id));
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

  async summarizeByInviterId(inviterId: UserId): Promise<InviteRedemptionSummary> {
    const groups = await this.#db
      .select({ status: inviteRedemption.status, total: count() })
      .from(inviteRedemption)
      .where(eq(inviteRedemption.inviterId, inviterId.value))
      .groupBy(inviteRedemption.status);
    const countOf = (status: RedemptionStatus) =>
      groups.find((group) => group.status === status)?.total ?? 0;
    return {
      joinedCount: countOf("JOINED"),
      qualifiedCount: countOf("QUALIFIED"),
      rewardedCount: countOf("REWARDED"),
      rejectedCount: countOf("REJECTED"),
    };
  }

  async listInvitedFriends(params: {
    readonly inviterId: UserId;
    readonly afterInviteeId: UserId | null;
    readonly status: RedemptionStatus | null;
    readonly limit: number;
  }): Promise<InvitedFriend[]> {
    const { inviterId, afterInviteeId, status, limit } = params;
    const anchor =
      afterInviteeId == null
        ? null
        : await this.#db.query.inviteRedemption.findFirst({
            columns: { joinedAt: true, id: true },
            where: { inviteeId: afterInviteeId.value, inviterId: inviterId.value },
          });
    if (afterInviteeId != null && anchor == null) {
      return [];
    }

    const rows = await this.#db.query.inviteRedemption.findMany({
      columns: {
        id: true,
        status: true,
        rejectionReason: true,
        joinedAt: true,
        qualifiedAt: true,
      },
      where: {
        inviterId: inviterId.value,
        ...(status != null && { status }),
        ...(anchor != null && {
          RAW: (table) => tupleLessThan([table.joinedAt, table.id], [anchor.joinedAt, anchor.id]),
        }),
      },
      with: {
        invitee: {
          columns: { id: true, userTag: true },
          with: { profile: { columns: { name: true, profileImage: true } } },
        },
      },
      extras: { activeDayCount: this.#activeDayCount() },
      orderBy: { joinedAt: "desc", id: "desc" },
      limit,
    });
    return rows.map((row) => ({
      userId: row.invitee.id,
      name: row.invitee.profile?.name ?? null,
      userTag: row.invitee.userTag,
      profileImage: row.invitee.profile?.profileImage ?? null,
      status: row.status,
      activeDayCount: row.activeDayCount,
      joinedAt: row.joinedAt,
      qualifiedAt: row.qualifiedAt,
      rejectionReason: row.rejectionReason,
    }));
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

  async listQualifyReminderCandidates(params: {
    readonly now: Temporal.Instant;
    readonly expiresBefore: Temporal.Instant;
    readonly after: Pick<QualifyReminderCandidate, "expiresAt" | "redemptionId"> | null;
    readonly limit: number;
  }): Promise<QualifyReminderCandidate[]> {
    const { after } = params;
    const rows = await this.#db.query.inviteRedemption.findMany({
      columns: { id: true, timezone: true, expiresAt: true },
      where: {
        status: "JOINED",
        qualifyReminderSentAt: { isNull: true },
        inviterId: { isNotNull: true },
        inviterRewardEligible: true,
        expiresAt: { gt: params.now, lte: params.expiresBefore },
        ...(after != null && {
          OR: [
            { expiresAt: { gt: after.expiresAt } },
            { expiresAt: { eq: after.expiresAt }, id: { gt: after.redemptionId } },
          ],
        }),
      },
      extras: { activeDayCount: this.#activeDayCount() },
      orderBy: { expiresAt: "asc", id: "asc" },
      limit: params.limit,
    });
    return rows.map((row) => ({
      redemptionId: row.id,
      timezone: row.timezone,
      expiresAt: row.expiresAt,
      activeDayCount: row.activeDayCount,
    }));
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
