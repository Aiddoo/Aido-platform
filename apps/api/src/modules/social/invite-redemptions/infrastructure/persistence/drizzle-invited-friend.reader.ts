import type { RedemptionStatus } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { keyBy } from "es-toolkit";

import { UserBriefReaderPort } from "#api/modules/identity/users/identity-users.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { tupleLessThan } from "#api/platform/database/keyset";
import { inviteActiveDay, type inviteRedemption } from "#api/platform/database/schema/index";
import {
  type CursorPage,
  emptyCursorPage,
  toMappedCursorPage,
} from "#api/shared/application/cursor-page";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { InvitedFriendReaderPort } from "../../application/ports/invited-friend.reader.port.js";
import type { InvitedFriendReadModel } from "../../application/read-models/invited-friend.read-model.js";

// 한 페이지의 수락·활동일 수를 한 문장으로 읽고 프로필은 identity에서 한 번에 읽는다
@Injectable()
export class DrizzleInvitedFriendReader implements InvitedFriendReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #userBriefReader: UserBriefReaderPort;

  constructor(
    transactionHost: TransactionHost<DrizzleTransactionalAdapter>,
    userBriefReader: UserBriefReaderPort,
  ) {
    this.#transactionHost = transactionHost;
    this.#userBriefReader = userBriefReader;
  }

  async listInvitedFriends(params: {
    readonly inviterId: UserId;
    readonly afterInviteeId: UserId | null;
    readonly status: RedemptionStatus | null;
    readonly size: number;
  }): Promise<CursorPage<InvitedFriendReadModel, string>> {
    const { inviterId, afterInviteeId, status, size } = params;
    const anchor =
      afterInviteeId == null
        ? null
        : await this.#db.query.inviteRedemption.findFirst({
            columns: { joinedAt: true, id: true },
            where: { inviteeId: afterInviteeId.value, inviterId: inviterId.value },
          });
    if (afterInviteeId != null && anchor == null) {
      return emptyCursorPage(size);
    }

    const rows = await this.#db.query.inviteRedemption.findMany({
      columns: {
        id: true,
        inviteeId: true,
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
      extras: { activeDayCount: this.#activeDayCount() },
      orderBy: { joinedAt: "desc", id: "desc" },
      limit: size + 1,
    });
    return toMappedCursorPage({
      rows,
      size,
      toCursor: (row) => row.inviteeId,
      toItems: async (pageRows): Promise<InvitedFriendReadModel[]> => {
        const invitees = keyBy(
          await this.#userBriefReader.findByUserIds(
            pageRows.map((row) => UserId.reconstitute(row.inviteeId)),
          ),
          (brief) => brief.userId.value,
        );
        return pageRows.flatMap((row) => {
          const invitee = invitees[row.inviteeId];
          if (invitee == null) {
            return [];
          }
          return [
            {
              userId: row.inviteeId,
              name: invitee.name,
              userTag: invitee.userTag,
              profileImage: invitee.profileImage,
              status: row.status,
              activeDayCount: row.activeDayCount,
              joinedAt: row.joinedAt,
              qualifiedAt: row.qualifiedAt,
              rejectionReason: row.rejectionReason,
            },
          ];
        });
      },
    });
  }

  #activeDayCount() {
    return (redemption: typeof inviteRedemption) =>
      this.#db.$count(inviteActiveDay, eq(inviteActiveDay.redemptionId, redemption.id));
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
