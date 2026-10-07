import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and } from "@prisma/orm-postgres/orm-client";

import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { databaseTimestamp } from "#api/platform/database/database-values";
import type { Cheer as CheerRow } from "#api/platform/database/database.types";
import {
  DatabaseRecordNotFoundError,
  requireRecord,
} from "#api/platform/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import { now } from "#api/shared/domain/date/utils/core";

import type {
  CheerRepositoryPort,
  CheerWithRelations,
  CreateCheerInput,
  FindCheersParams,
} from "../../../application/ports/cheers/cheer.repository.port.js";
import { Cheer } from "../../../domain/aggregates/cheers/cheer.aggregate.js";

type UserBriefRow = {
  id: string;
  userTag: string;
  profile: { name: string | null; profileImage: string | null } | null;
};
type CheerRowWithRelations = CheerRow & {
  sender: UserBriefRow | null;
  receiver: UserBriefRow | null;
};

@Injectable()
export class PrismaCheerRepository implements CheerRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  private get client() {
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
    const sender = requireRecord(row.sender);
    const receiver = requireRecord(row.receiver);
    return {
      id: row.id,
      senderId: row.senderId,
      receiverId: row.receiverId,
      message: row.message,
      readAt: row.readAt,
      createdAt: row.createdAt,
      sender: {
        id: sender.id,
        userTag: sender.userTag,
        profile: sender.profile,
      },
      receiver: {
        id: receiver.id,
        userTag: receiver.userTag,
        profile: receiver.profile,
      },
    };
  }

  async findById(id: number): Promise<Cheer | null> {
    const row = decodeRecord(
      "Cheer",
      await this.client.orm.public.Cheer.where((row) => row.id.eq(id)).first(),
    );
    return row === null ? null : PrismaCheerRepository.toCheer(row);
  }

  async findLastCheerToUser(senderId: string, receiverId: string): Promise<Cheer | null> {
    const row = decodeRecord(
      "Cheer",
      await this.client.orm.public.Cheer.where((row) =>
        and(row.senderId.eq(senderId), row.receiverId.eq(receiverId)),
      )
        .orderBy((row) => row.createdAt.desc())
        .first(),
    );
    return row === null ? null : PrismaCheerRepository.toCheer(row);
  }

  async saveRead(cheer: Cheer): Promise<void> {
    const affected = await this.client.orm.public.Cheer.where({ id: cheer.id }).updateAndCount(
      encodePatch("Cheer", { readAt: cheer.readAt }),
    );
    if (affected === 0) throw new DatabaseRecordNotFoundError();
  }

  async markManyAsRead(ids: readonly number[], receiverId: string): Promise<number> {
    return this.client.orm.public.Cheer.where((row) =>
      and(row.id.in([...ids]), row.receiverId.eq(receiverId), row.readAt.isNull()),
    ).updateAndCount(encodePatch("Cheer", { readAt: now() }));
  }

  async findReceivedCheers(params: FindCheersParams): Promise<CheerWithRelations[]> {
    const { userId, cursor, size } = params;
    let cheers = this.client.orm.public.Cheer.where({ receiverId: userId })
      .include("sender", (user) =>
        user
          .select("id", "userTag")
          .include("profile", (profile) => profile.select("name", "profileImage")),
      )
      .include("receiver", (user) =>
        user
          .select("id", "userTag")
          .include("profile", (profile) => profile.select("name", "profileImage")),
      )
      .orderBy((row) => row.createdAt.desc())
      .orderBy((row) => row.id.desc())
      .limit(size + 1);
    if (cursor !== undefined && cursor !== null) {
      const anchor = await this.client.orm.public.Cheer.where({ id: cursor })
        .select("id", "createdAt")
        .first();
      if (anchor === null) return [];
      cheers = cheers.cursor(anchor);
    }
    const rows = decodeRecord("Cheer", await cheers.all());
    return rows.map((row) => PrismaCheerRepository.toWithRelations(row));
  }

  async findSentCheers(params: FindCheersParams): Promise<CheerWithRelations[]> {
    const { userId, cursor, size } = params;
    let cheers = this.client.orm.public.Cheer.where({ senderId: userId })
      .include("sender", (user) =>
        user
          .select("id", "userTag")
          .include("profile", (profile) => profile.select("name", "profileImage")),
      )
      .include("receiver", (user) =>
        user
          .select("id", "userTag")
          .include("profile", (profile) => profile.select("name", "profileImage")),
      )
      .orderBy((row) => row.createdAt.desc())
      .orderBy((row) => row.id.desc())
      .limit(size + 1);
    if (cursor !== undefined && cursor !== null) {
      const anchor = await this.client.orm.public.Cheer.where({ id: cursor })
        .select("id", "createdAt")
        .first();
      if (anchor === null) return [];
      cheers = cheers.cursor(anchor);
    }
    const rows = decodeRecord("Cheer", await cheers.all());
    return rows.map((row) => PrismaCheerRepository.toWithRelations(row));
  }

  async countSentSince(senderId: string, since: Date, untilExclusive: Date): Promise<number> {
    return this.client.orm.public.Cheer.where((row) =>
      and(
        row.senderId.eq(senderId),
        row.createdAt.gte(databaseTimestamp(since)),
        row.createdAt.lt(databaseTimestamp(untilExclusive)),
      ),
    )
      .aggregate((aggregate) => ({ count: aggregate.count() }))
      .then(({ count }) => count);
  }

  async countReceived(userId: string): Promise<number> {
    return this.client.orm.public.Cheer.where((row) => row.receiverId.eq(userId))
      .aggregate((aggregate) => ({ count: aggregate.count() }))
      .then(({ count }) => count);
  }

  async countSent(userId: string): Promise<number> {
    return this.client.orm.public.Cheer.where((row) => row.senderId.eq(userId))
      .aggregate((aggregate) => ({ count: aggregate.count() }))
      .then(({ count }) => count);
  }

  async countUnreadReceived(userId: string): Promise<number> {
    return this.client.orm.public.Cheer.where((row) =>
      and(row.receiverId.eq(userId), row.readAt.isNull()),
    )
      .aggregate((aggregate) => ({ count: aggregate.count() }))
      .then(({ count }) => count);
  }

  async createWithRelations(input: CreateCheerInput): Promise<CheerWithRelations> {
    const row = decodeRecord(
      "Cheer",
      await this.client.orm.public.Cheer.include("sender", (user) =>
        user
          .select("id", "userTag")
          .include("profile", (profile) => profile.select("name", "profileImage")),
      )
        .include("receiver", (user) =>
          user
            .select("id", "userTag")
            .include("profile", (profile) => profile.select("name", "profileImage")),
        )
        .create(
          encodeCreate("Cheer", {
            senderId: input.senderId,
            receiverId: input.receiverId,
            message: input.message,
            createdAt: input.createdAt,
          }),
        ),
    );
    return PrismaCheerRepository.toWithRelations(row);
  }
}
