import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { all, and } from "@prisma/orm-postgres/orm-client";

import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import {
  applicationDate,
  databaseDate,
  databaseTimestamp,
} from "#api/platform/database/database-values";
import { requireRecord } from "#api/platform/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";

import type {
  FindInvitedFriendsParams,
  InvitedFriendRecord,
  InviteeIdentity,
  InviteRedemptionRepositoryPort,
  InviteRedemptionSummary,
} from "../../../application/ports/invites/invite-redemption.repository.port.js";
import {
  InviteRedemption,
  type InviteRedemptionCreationPlan,
} from "../../../domain/aggregates/invites/invite-redemption.aggregate.js";

const REDEMPTION_COLUMNS = [
  "id",
  "inviteId",
  "inviterId",
  "inviteeId",
  "status",
  "rejectionReason",
  "timezone",
  "inviterRewardEligible",
  "joinedAt",
  "qualifiedAt",
  "rewardedAt",
  "rejectedAt",
  "expiresAt",
] as const;

@Injectable()
export class PrismaInviteRedemptionRepository implements InviteRedemptionRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  private get client() {
    return this.txHost.tx;
  }

  async findInviteeIdentity(inviteeId: string): Promise<InviteeIdentity | null> {
    const user = decodeRecord(
      "User",
      await this.client.orm.public.User.where((row) => row.id.eq(inviteeId))
        .select("id", "createdAt", "email", "emailVerifiedAt")
        .include("accounts", (account) => account.select("provider", "providerAccountId"))
        .first(),
    );
    if (user == null) return null;
    return {
      userId: user.id,
      createdAt: user.createdAt,
      verifiedEmail: user.emailVerifiedAt == null ? null : user.email,
      providerAccounts: user.accounts.map((account) => ({
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      })),
    };
  }

  async existsByInviteeId(inviteeId: string): Promise<boolean> {
    const row = await this.client.orm.public.InviteRedemption.where((redemption) =>
      redemption.inviteeId.eq(inviteeId),
    )
      .select("id")
      .first();
    return row != null;
  }

  async create(plan: InviteRedemptionCreationPlan): Promise<InviteRedemption | null> {
    const [row] = decodeRecord(
      "InviteRedemption",
      await this.client.orm.public.InviteRedemption.createAll(
        [encodeCreate("InviteRedemption", plan)],
        { onConflict: "skip", conflictOn: ["inviteeId"] },
      ),
    );
    if (row == null) return null;
    return InviteRedemption.reconstitute({ ...row, activeDays: [] });
  }

  async hasJoinedByInviteeId(inviteeId: string): Promise<boolean> {
    const row = await this.client.orm.public.InviteRedemption.where({
      inviteeId,
      status: "JOINED",
    })
      .select("id")
      .first();
    return row != null;
  }

  async findByInviteeIdForUpdate(inviteeId: string): Promise<InviteRedemption | null> {
    const locked = await this.client.orm.public.InviteRedemption.where({ inviteeId })
      .select("id")
      .forUpdate()
      .first();
    return locked == null ? null : this.#findById(locked.id);
  }

  async findByIdForUpdate(redemptionId: string): Promise<InviteRedemption | null> {
    const locked = await this.client.orm.public.InviteRedemption.where({ id: redemptionId })
      .select("id")
      .forUpdate()
      .first();
    return locked == null ? null : this.#findById(locked.id);
  }

  async save(redemption: InviteRedemption): Promise<void> {
    const { addedActiveDays, ...state } = redemption.toPersistence();
    await this.client.orm.public.InviteRedemption.where({ id: redemption.id }).updateAndCount(
      encodePatch("InviteRedemption", state),
    );
    if (addedActiveDays.length === 0) return;
    await this.client.orm.public.InviteActiveDay.createAndCount(
      addedActiveDays.map((localDate) =>
        encodeCreate("InviteActiveDay", {
          redemptionId: redemption.id,
          localDate: applicationDate(localDate),
        }),
      ),
      { onConflict: "skip", conflictOn: ["redemptionId", "localDate"] },
    );
  }

  async summarizeByInviterId(inviterId: string): Promise<InviteRedemptionSummary> {
    // 상태별 수를 groupBy 한 번으로 센다
    const groups = await this.client.orm.public.InviteRedemption.where({ inviterId })
      .groupBy("status")
      .aggregate((aggregate) => ({ count: aggregate.count() }));
    const countOf = (status: InvitedFriendRecord["status"]) =>
      groups.find((group) => group.status === status)?.count ?? 0;
    return {
      joinedCount: countOf("JOINED"),
      qualifiedCount: countOf("QUALIFIED"),
      rewardedCount: countOf("REWARDED"),
      rejectedCount: countOf("REJECTED"),
    };
  }

  async findInvitedFriends(params: FindInvitedFriendsParams): Promise<InvitedFriendRecord[]> {
    // 상태가 있으면 (inviterId, status, joinedAt, id), 없으면 (inviterId, joinedAt, id) 인덱스 순서로 keyset을 읽고
    // 프로필·활동일 수는 include로 같은 문장에 붙인다
    let page = this.client.orm.public.InviteRedemption.where((row) =>
      and(
        row.inviterId.eq(params.inviterId),
        params.status == null ? all() : row.status.eq(params.status),
      ),
    )
      .select("id", "status", "rejectionReason", "joinedAt", "qualifiedAt")
      .include("invitee", (user) =>
        user
          .select("id", "userTag")
          .include("profile", (profile) => profile.select("name", "profileImage")),
      )
      .include("activeDays", (days) => days.count())
      .orderBy((row) => row.joinedAt.desc())
      .orderBy((row) => row.id.desc())
      .limit(params.size);
    if (params.cursor != null) {
      const anchor = await this.client.orm.public.InviteRedemption.where({
        inviteeId: params.cursor,
        inviterId: params.inviterId,
      })
        .select("joinedAt", "id")
        .first();
      if (anchor == null) return [];
      // cursor는 (joinedAt, id) 비교를 OR로 풀어 쓰므로 joinedAt 상한을 따로 걸어 인덱스 범위로 시작한다
      page = page.where((row) => row.joinedAt.lte(anchor.joinedAt)).cursor(anchor);
    }

    const rows = decodeRecord("InviteRedemption", await page.all());
    return rows.map((row) => {
      const invitee = requireRecord(row.invitee);
      return {
        userId: invitee.id,
        name: invitee.profile?.name ?? null,
        userTag: invitee.userTag,
        profileImage: invitee.profile?.profileImage ?? null,
        status: row.status,
        activeDayCount: row.activeDays,
        joinedAt: row.joinedAt,
        qualifiedAt: row.qualifiedAt,
        rejectionReason: row.rejectionReason,
      };
    });
  }

  async expireJoinedBefore(at: Date, limit: number): Promise<number> {
    // 다른 정비 작업이 잡은 행은 건너뛰고 한 묶음만 잠근 뒤, 그 사이 상태가 바뀐 행은 JOINED 조건으로 거른다
    const claimed = await this.client.orm.public.InviteRedemption.where((row) =>
      and(row.status.eq("JOINED"), row.expiresAt.lte(databaseTimestamp(at))),
    )
      .select("id")
      .orderBy((row) => row.expiresAt.asc())
      .orderBy((row) => row.id.asc())
      .limit(limit)
      .forUpdate({ skipLocked: true })
      .all();
    if (claimed.length === 0) return 0;

    return this.client.orm.public.InviteRedemption.where((row) =>
      and(row.id.in(claimed.map((item) => item.id)), row.status.eq("JOINED")),
    ).updateAndCount(
      encodePatch("InviteRedemption", {
        status: "REJECTED",
        rejectionReason: "EXPIRED",
        rejectedAt: at,
      }),
    );
  }

  async #findById(redemptionId: string): Promise<InviteRedemption | null> {
    const row = decodeRecord(
      "InviteRedemption",
      await this.client.orm.public.InviteRedemption.where({ id: redemptionId })
        .select(...REDEMPTION_COLUMNS)
        .include("activeDays", (day) => day.select("localDate"))
        .first(),
    );
    if (row == null) return null;
    return InviteRedemption.reconstitute({
      ...row,
      activeDays: row.activeDays.map((day) => databaseDate(day.localDate)),
    });
  }
}
