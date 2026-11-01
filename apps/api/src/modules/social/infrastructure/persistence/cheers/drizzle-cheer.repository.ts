import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { cheer } from "#api/platform/database/schema/index";
import { now } from "#api/shared/domain/date/utils/core";

import type {
  CheerRepositoryPort,
  CheerWithRelations,
  CreateCheerInput,
  FindCheersParams,
} from "../../../application/ports/cheers/cheer.repository.port.js";
import { Cheer } from "../../../domain/aggregates/cheers/cheer.aggregate.js";
import { hasNoBlockWith } from "../blocks/drizzle-user-block.filter.js";
import { USER_BRIEF_RELATION, type UserBriefRow } from "../drizzle-user-brief.relation.js";

type CheerRow = typeof cheer.$inferSelect;
type CheerRowWithRelations = CheerRow & {
  sender: UserBriefRow;
  receiver: UserBriefRow;
};

@Injectable()
export class DrizzleCheerRepository implements CheerRepositoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  private static toCheer(row: CheerRow): Cheer {
    return Cheer.reconstitute({
      id: row.id,
      senderId: row.senderId,
      receiverId: row.receiverId,
      message: row.message,
      readAt: row.readAt,
      createdAt: row.createdAt,
    });
  }

  private static toWithRelations(row: CheerRowWithRelations): CheerWithRelations {
    return {
      id: row.id,
      senderId: row.senderId,
      receiverId: row.receiverId,
      message: row.message,
      readAt: row.readAt,
      createdAt: row.createdAt,
      sender: {
        id: row.sender.id,
        userTag: row.sender.userTag,
        profile: row.sender.profile,
      },
      receiver: {
        id: row.receiver.id,
        userTag: row.receiver.userTag,
        profile: row.receiver.profile,
      },
    };
  }

  async findById(id: number): Promise<Cheer | null> {
    const row = await this.db.query.cheer.findFirst({ where: { id } });
    return row == null ? null : DrizzleCheerRepository.toCheer(row);
  }

  async findLastCheerToUser(senderId: string, receiverId: string): Promise<Cheer | null> {
    const row = await this.db.query.cheer.findFirst({
      where: { senderId, receiverId },
      orderBy: { createdAt: "desc" },
    });
    return row == null ? null : DrizzleCheerRepository.toCheer(row);
  }

  async saveRead(target: Cheer): Promise<void> {
    const [row] = await this.db
      .update(cheer)
      .set({ readAt: target.readAt })
      .where(eq(cheer.id, target.id))
      .returning({ id: cheer.id });
    requireRecord(row);
  }

  async markManyAsRead(ids: readonly number[], receiverId: string): Promise<number> {
    const updated = await this.db
      .update(cheer)
      .set({ readAt: now() })
      .where(
        and(inArray(cheer.id, [...ids]), eq(cheer.receiverId, receiverId), isNull(cheer.readAt)),
      )
      .returning({ id: cheer.id });
    return updated.length;
  }

  async findReceivedCheers(params: FindCheersParams): Promise<CheerWithRelations[]> {
    return this.findPage(params, "receiverId");
  }

  async findSentCheers(params: FindCheersParams): Promise<CheerWithRelations[]> {
    return this.findPage(params, "senderId");
  }

  private async findPage(
    { userId, cursor, size }: FindCheersParams,
    owner: "receiverId" | "senderId",
  ): Promise<CheerWithRelations[]> {
    const anchor =
      cursor == null
        ? undefined
        : await this.db.query.cheer.findFirst({
            columns: { id: true, createdAt: true },
            where: { id: cursor },
          });
    if (cursor != null && anchor == null) {
      return [];
    }

    const rows = await this.db.query.cheer.findMany({
      where: {
        ...(owner === "receiverId" ? { receiverId: userId } : { senderId: userId }),
        AND: [
          {
            RAW: (table) =>
              hasNoBlockWith(owner === "receiverId" ? table.senderId : table.receiverId, userId),
          },
          ...(anchor == null
            ? []
            : [
                {
                  RAW: (table: typeof cheer) =>
                    sql`(${table.createdAt}, ${table.id}) < (${sql.param(anchor.createdAt, table.createdAt)}, ${anchor.id})`,
                },
              ]),
        ],
      },
      with: { sender: USER_BRIEF_RELATION, receiver: USER_BRIEF_RELATION },
      orderBy: { createdAt: "desc", id: "desc" },
      limit: size + 1,
    });
    return rows.map((row) => DrizzleCheerRepository.toWithRelations(row));
  }

  countSentSince(senderId: string, since: Date, untilExclusive: Date): Promise<number> {
    return this.db.$count(
      cheer,
      and(
        eq(cheer.senderId, senderId),
        gte(cheer.createdAt, since),
        lt(cheer.createdAt, untilExclusive),
      ),
    );
  }

  countReceived(userId: string): Promise<number> {
    return this.db.$count(
      cheer,
      and(eq(cheer.receiverId, userId), hasNoBlockWith(cheer.senderId, userId)),
    );
  }

  countSent(userId: string): Promise<number> {
    return this.db.$count(
      cheer,
      and(eq(cheer.senderId, userId), hasNoBlockWith(cheer.receiverId, userId)),
    );
  }

  countUnreadReceived(userId: string): Promise<number> {
    return this.db.$count(
      cheer,
      and(
        eq(cheer.receiverId, userId),
        isNull(cheer.readAt),
        hasNoBlockWith(cheer.senderId, userId),
      ),
    );
  }

  async createWithRelations(input: CreateCheerInput): Promise<CheerWithRelations> {
    const [created] = await this.db
      .insert(cheer)
      .values({
        senderId: input.senderId,
        receiverId: input.receiverId,
        message: input.message,
        createdAt: input.createdAt,
      })
      .returning({ id: cheer.id });
    const row = await this.db.query.cheer.findFirst({
      where: { id: requireRecord(created).id },
      with: { sender: USER_BRIEF_RELATION, receiver: USER_BRIEF_RELATION },
    });
    return DrizzleCheerRepository.toWithRelations(requireRecord(row));
  }
}
