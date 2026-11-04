import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, count, eq, inArray, lte, sql } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { inviteActiveDay, inviteRedemption } from "#api/platform/database/schema/index";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { parseDateOnly } from "#api/shared/domain/date/utils/parse";

import type {
  FindInvitedFriendsParams,
  FindQualifyReminderCandidatesParams,
  InvitedFriendRecord,
  InviteeIdentity,
  InviteRedemptionRepositoryPort,
  InviteRedemptionSummary,
  QualifyReminderCandidate,
} from "../../../application/ports/invites/invite-redemption.repository.port.js";
import {
  InviteRedemption,
  type InviteRedemptionCreationPlan,
} from "../../../domain/aggregates/invites/invite-redemption.aggregate.js";

const REDEMPTION_COLUMNS = {
  id: true,
  inviteId: true,
  inviterId: true,
  inviteeId: true,
  status: true,
  rejectionReason: true,
  timezone: true,
  inviterRewardEligible: true,
  joinedAt: true,
  qualifiedAt: true,
  rewardedAt: true,
  rejectedAt: true,
  expiresAt: true,
  qualifyReminderSentAt: true,
} as const;

@Injectable()
export class DrizzleInviteRedemptionRepository implements InviteRedemptionRepositoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  private activeDayCount() {
    return (redemption: typeof inviteRedemption) =>
      this.db.$count(inviteActiveDay, eq(inviteActiveDay.redemptionId, redemption.id));
  }

  async findInviteeIdentity(inviteeId: string): Promise<InviteeIdentity | null> {
    const found = await this.db.query.user.findFirst({
      columns: { id: true, userTag: true, createdAt: true, email: true, emailVerifiedAt: true },
      where: { id: inviteeId },
      with: {
        profile: { columns: { name: true } },
        accounts: { columns: { provider: true, providerAccountId: true } },
      },
    });
    if (found == null) {
      return null;
    }
    return {
      userId: found.id,
      displayName: found.profile?.name ?? found.userTag,
      createdAt: found.createdAt,
      verifiedEmail: found.emailVerifiedAt == null ? null : found.email,
      providerAccounts: found.accounts.map((account) => ({
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      })),
    };
  }

  async findDisplayName(userId: string): Promise<string | null> {
    const found = await this.db.query.user.findFirst({
      columns: { userTag: true },
      where: { id: userId, deletedAt: { isNull: true } },
      with: { profile: { columns: { name: true } } },
    });
    if (found == null) {
      return null;
    }
    return found.profile?.name ?? found.userTag;
  }

  async create(plan: InviteRedemptionCreationPlan): Promise<InviteRedemption | null> {
    const [row] = await this.db
      .insert(inviteRedemption)
      .values(plan)
      .onConflictDoNothing({ target: inviteRedemption.inviteeId })
      .returning();
    if (row == null) {
      return null;
    }
    return InviteRedemption.reconstitute({ ...row, activeDays: [] });
  }

  async hasJoinedByInviteeId(inviteeId: string): Promise<boolean> {
    const row = await this.db.query.inviteRedemption.findFirst({
      columns: { id: true },
      where: { inviteeId, status: "JOINED" },
    });
    return row != null;
  }

  async findByInviteeIdForUpdate(inviteeId: string): Promise<InviteRedemption | null> {
    const [locked] = await this.db
      .select({ id: inviteRedemption.id })
      .from(inviteRedemption)
      .where(eq(inviteRedemption.inviteeId, inviteeId))
      .limit(1)
      .for("update");
    return locked == null ? null : this.#findById(locked.id);
  }

  async findByIdForUpdate(redemptionId: string): Promise<InviteRedemption | null> {
    const [locked] = await this.db
      .select({ id: inviteRedemption.id })
      .from(inviteRedemption)
      .where(eq(inviteRedemption.id, redemptionId))
      .limit(1)
      .for("update");
    return locked == null ? null : this.#findById(locked.id);
  }

  async save(redemption: InviteRedemption): Promise<void> {
    const { addedActiveDays, ...state } = redemption.toPersistence();
    await this.db.update(inviteRedemption).set(state).where(eq(inviteRedemption.id, redemption.id));
    if (addedActiveDays.length === 0) {
      return;
    }
    await this.db
      .insert(inviteActiveDay)
      .values(
        addedActiveDays.map((localDate) => ({
          redemptionId: redemption.id,
          localDate: parseDateOnly(localDate),
        })),
      )
      .onConflictDoNothing({ target: [inviteActiveDay.redemptionId, inviteActiveDay.localDate] });
  }

  async summarizeByInviterId(inviterId: string): Promise<InviteRedemptionSummary> {
    const groups = await this.db
      .select({ status: inviteRedemption.status, total: count() })
      .from(inviteRedemption)
      .where(eq(inviteRedemption.inviterId, inviterId))
      .groupBy(inviteRedemption.status);
    const countOf = (status: InvitedFriendRecord["status"]) =>
      groups.find((group) => group.status === status)?.total ?? 0;
    return {
      joinedCount: countOf("JOINED"),
      qualifiedCount: countOf("QUALIFIED"),
      rewardedCount: countOf("REWARDED"),
      rejectedCount: countOf("REJECTED"),
    };
  }

  async findInvitedFriends(params: FindInvitedFriendsParams): Promise<InvitedFriendRecord[]> {
    const anchor =
      params.cursor == null
        ? undefined
        : await this.db.query.inviteRedemption.findFirst({
            columns: { joinedAt: true, id: true },
            where: { inviteeId: params.cursor, inviterId: params.inviterId },
          });
    if (params.cursor != null && anchor == null) {
      return [];
    }

    const rows = await this.db.query.inviteRedemption.findMany({
      columns: {
        id: true,
        status: true,
        rejectionReason: true,
        joinedAt: true,
        qualifiedAt: true,
      },
      where: {
        inviterId: params.inviterId,
        ...(params.status != null && { status: params.status }),
        ...(anchor != null && {
          RAW: (table) =>
            sql`(${table.joinedAt}, ${table.id}) < (${sql.param(anchor.joinedAt, table.joinedAt)}, ${anchor.id})`,
        }),
      },
      with: {
        invitee: {
          columns: { id: true, userTag: true },
          with: { profile: { columns: { name: true, profileImage: true } } },
        },
      },
      extras: { activeDayCount: this.activeDayCount() },
      orderBy: { joinedAt: "desc", id: "desc" },
      limit: params.size,
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

  async expireJoinedBefore(at: Date, limit: number): Promise<number> {
    const claimed = await this.db
      .select({ id: inviteRedemption.id })
      .from(inviteRedemption)
      .where(and(eq(inviteRedemption.status, "JOINED"), lte(inviteRedemption.expiresAt, at)))
      .orderBy(inviteRedemption.expiresAt, inviteRedemption.id)
      .limit(limit)
      .for("update", { skipLocked: true });
    if (claimed.length === 0) {
      return 0;
    }

    const expired = await this.db
      .update(inviteRedemption)
      .set({ status: "REJECTED", rejectionReason: "EXPIRED", rejectedAt: at })
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

  async findQualifyReminderCandidates(
    params: FindQualifyReminderCandidatesParams,
  ): Promise<QualifyReminderCandidate[]> {
    const { after } = params;
    const rows = await this.db.query.inviteRedemption.findMany({
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
      extras: { activeDayCount: this.activeDayCount() },
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

  async #findById(redemptionId: string): Promise<InviteRedemption | null> {
    const row = await this.db.query.inviteRedemption.findFirst({
      columns: REDEMPTION_COLUMNS,
      where: { id: redemptionId },
      with: { activeDays: { columns: { localDate: true } } },
    });
    if (row == null) {
      return null;
    }
    return InviteRedemption.reconstitute({
      ...row,
      activeDays: row.activeDays.map((day) => toDateString(day.localDate)),
    });
  }
}
