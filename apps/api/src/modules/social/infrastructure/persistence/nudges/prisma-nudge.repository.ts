import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { all, and, or } from "@prisma/orm-postgres/orm-client";
import { compact } from "es-toolkit";
import sql from "sql-template-tag";

import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { decodeSqlRows, sqlRowSpec, sqlStatement } from "#api/platform/database/database-sql";
import { databaseDate, databaseTimestamp } from "#api/platform/database/database-values";
import type * as PrismaModels from "#api/platform/database/database.types";
import {
  DatabaseRecordNotFoundError,
  requireRecord,
} from "#api/platform/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";

import type {
  CreateNudgeInput,
  CreateRemindNudgeInput,
  FindNudgesParams,
  FindNudgeThanksCandidatesInput,
  NudgeInteractionRecord,
  NudgeInteractionTodo,
  NudgeRepositoryPort,
  NudgeThanksCandidatePage,
  NudgeWithRelations,
  ReminderNudgeWithRelations,
  TargetTodoRecord,
} from "../../../application/ports/nudges/nudge.repository.port.js";
import { Nudge } from "../../../domain/aggregates/nudges/nudge.aggregate.js";
import { ReminderNudge } from "../../../domain/aggregates/nudges/reminder-nudge.aggregate.js";

type UserBriefRow = {
  id: string;
  userTag: string;
  profile: { name: string | null; profileImage: string | null } | null;
};
type TodoBriefRow = { id: number; title: string; completed: boolean };
type NudgeRowWithRelations = PrismaModels.Nudge & {
  sender: UserBriefRow | null;
  receiver: UserBriefRow | null;
  todo: (TodoBriefRow & { userId: string; visibility: string }) | null;
};
type NudgeInteractionRow = NudgeRowWithRelations & {
  todo: (TodoBriefRow & { userId: string; visibility: string }) | null;
};
type ReminderNudgeRowWithRelations = PrismaModels.ReminderNudge & {
  sender: UserBriefRow | null;
};

@Injectable()
export class PrismaNudgeRepository implements NudgeRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  private get client() {
    return this.txHost.tx;
  }

  private get interactions() {
    return this.client.orm.public.Nudge.include("sender", (user) =>
      user
        .select("id", "userTag")
        .include("profile", (profile) => profile.select("name", "profileImage")),
    )
      .include("receiver", (user) =>
        user
          .select("id", "userTag")
          .include("profile", (profile) => profile.select("name", "profileImage")),
      )
      .include("todo", (todo) => todo.select("id", "title", "completed", "userId", "visibility"));
  }

  private static toNudge(row: PrismaModels.Nudge): Nudge {
    return Nudge.reconstitute({
      id: row.id,
      senderId: row.senderId,
      receiverId: row.receiverId,
      todoId: row.todoId,
      message: row.message,
      readAt: row.readAt,
      createdAt: row.createdAt,
      replyKind: row.replyKind,
      repliedAt: row.repliedAt,
      replyUpdatedAt: row.replyUpdatedAt,
      thankedAt: row.thankedAt,
    });
  }

  private static toReminderNudge(row: PrismaModels.ReminderNudge): ReminderNudge {
    return ReminderNudge.reconstitute({
      id: row.id,
      senderId: row.senderId,
      receiverId: row.receiverId,
      message: row.message,
      createdAt: row.createdAt,
    });
  }

  private static toWithRelations(row: NudgeRowWithRelations): NudgeWithRelations {
    const sender = requireRecord(row.sender);
    const receiver = requireRecord(row.receiver);
    const todo = requireRecord(row.todo);
    return {
      id: row.id,
      senderId: row.senderId,
      receiverId: row.receiverId,
      todoId: row.todoId,
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
      todo: {
        id: todo.id,
        title: todo.title,
        completed: todo.completed,
      },
    };
  }

  private static toRemindWithRelations(
    row: ReminderNudgeRowWithRelations,
  ): ReminderNudgeWithRelations {
    const sender = requireRecord(row.sender);
    return {
      id: row.id,
      senderId: row.senderId,
      receiverId: row.receiverId,
      message: row.message,
      createdAt: row.createdAt,
      sender: {
        id: sender.id,
        userTag: sender.userTag,
        profile: sender.profile,
      },
    };
  }

  async findById(id: number): Promise<Nudge | null> {
    const row = decodeRecord(
      "Nudge",
      await this.client.orm.public.Nudge.where((row) => row.id.eq(id)).first(),
    );
    return row === null ? null : PrismaNudgeRepository.toNudge(row);
  }

  async findLastNudgeForTodo(senderId: string, todoId: number): Promise<Nudge | null> {
    const row = decodeRecord(
      "Nudge",
      await this.client.orm.public.Nudge.where((row) =>
        and(row.senderId.eq(senderId), row.todoId.eq(todoId)),
      )
        .orderBy((row) => row.createdAt.desc())
        .first(),
    );
    return row === null ? null : PrismaNudgeRepository.toNudge(row);
  }

  async findLastNudgeToUser(senderId: string, receiverId: string): Promise<Nudge | null> {
    const row = decodeRecord(
      "Nudge",
      await this.client.orm.public.Nudge.where((row) =>
        and(row.senderId.eq(senderId), row.receiverId.eq(receiverId)),
      )
        .orderBy((row) => row.createdAt.desc())
        .first(),
    );
    return row === null ? null : PrismaNudgeRepository.toNudge(row);
  }

  async findLastRemindNudge(senderId: string, receiverId: string): Promise<ReminderNudge | null> {
    const row = decodeRecord(
      "ReminderNudge",
      await this.client.orm.public.ReminderNudge.where((row) =>
        and(row.senderId.eq(senderId), row.receiverId.eq(receiverId)),
      )
        .orderBy((row) => row.createdAt.desc())
        .first(),
    );
    return row === null ? null : PrismaNudgeRepository.toReminderNudge(row);
  }

  async findTargetTodo(todoId: number): Promise<TargetTodoRecord | null> {
    const row = decodeRecord(
      "Todo",
      await this.client.orm.public.Todo.where((row) => row.id.eq(todoId))
        .select("userId", "visibility", "startDate", "endDate")
        .first(),
    );
    if (row === null) {
      return null;
    }
    return {
      ownerId: row.userId,
      visibility: row.visibility,
      startDate: row.startDate,
      endDate: row.endDate,
    };
  }

  async saveRead(nudge: Nudge): Promise<void> {
    await this.client.orm.public.Nudge.where((row) =>
      and(row.id.eq(nudge.id), row.readAt.isNull()),
    ).updateAndCount(encodePatch("Nudge", { readAt: nudge.readAt }));
  }

  async saveReply(nudge: Nudge): Promise<void> {
    const state = nudge.toPersistence();
    const affected = await this.client.orm.public.Nudge.where({ id: nudge.id }).updateAndCount(
      encodePatch("Nudge", {
        replyKind: state.replyKind,
        repliedAt: state.repliedAt,
        replyUpdatedAt: state.replyUpdatedAt,
      }),
    );
    if (affected === 0) throw new DatabaseRecordNotFoundError();
    await this.saveRead(nudge);
  }

  async saveThanksBatch(nudgeIds: readonly number[], thankedAt: Date): Promise<void> {
    if (nudgeIds.length === 0) return;
    await this.client.orm.public.Nudge.where((row) =>
      and(row.id.in([...nudgeIds]), row.thankedAt.isNull()),
    ).updateAndCount(encodePatch("Nudge", { thankedAt }));
  }

  private static toInteraction(row: NudgeInteractionRow): NudgeInteractionRecord {
    const todo = requireRecord(row.todo);
    return {
      ...PrismaNudgeRepository.toWithRelations(row),
      replyKind: row.replyKind,
      repliedAt: row.repliedAt,
      replyUpdatedAt: row.replyUpdatedAt,
      thankedAt: row.thankedAt,
      todo: {
        id: todo.id,
        title: todo.title,
        completed: todo.completed,
        ownerId: todo.userId,
        visibility: todo.visibility,
      },
    };
  }

  async findInteractionById(id: number, userId: string): Promise<NudgeInteractionRecord | null> {
    const row = decodeRecord(
      "Nudge",
      await this.interactions
        .where((nudge) =>
          and(nudge.id.eq(id), or(nudge.senderId.eq(userId), nudge.receiverId.eq(userId))),
        )
        .first(),
    );
    return row === null ? null : PrismaNudgeRepository.toInteraction(row);
  }

  async findInteractions(
    params: FindNudgesParams & { direction: "received" | "sent" },
  ): Promise<NudgeInteractionRecord[]> {
    const rows = decodeRecord(
      "Nudge",
      await this.interactions
        .where((nudge) =>
          and(
            params.direction === "received"
              ? nudge.receiverId.eq(params.userId)
              : nudge.senderId.eq(params.userId),
            params.cursor !== undefined ? nudge.id.lt(params.cursor) : all(),
          ),
        )
        .orderBy((nudge) => nudge.id.desc())
        .limit(params.size + 1)
        .all(),
    );
    return rows.map(PrismaNudgeRepository.toInteraction);
  }

  async lockInteractionTodo(todoId: number, userId: string): Promise<NudgeInteractionTodo | null> {
    const interactionTodoRow = sqlRowSpec({
      id: "pg/int4@1",
      ownerId: "pg/text@1",
      title: "pg/text@1",
      completed: "pg/bool@1",
      visibility: "pg/text@1",
    });

    // 완료·공개 상태 변경과 답장·감사 저장을 같은 행 잠금으로 직렬화한다.
    const rows = decodeSqlRows(
      interactionTodoRow,
      await this.client.query(
        sqlStatement(
          this.client,
          sql`
			SELECT "id", "userId" AS "ownerId", "title", "completed", "visibility"
			FROM "Todo" WHERE "id" = ${todoId} AND "userId" = ${userId} FOR UPDATE
		`,
        )
          .returnsRow(interactionTodoRow)
          .build(),
      ),
    );
    return rows[0] ?? null;
  }

  async findInteractionTodo(todoId: number, userId: string): Promise<NudgeInteractionTodo | null> {
    const row = decodeRecord(
      "Todo",
      await this.client.orm.public.Todo.where((row) =>
        and(row.id.eq(todoId), row.userId.eq(userId)),
      )
        .select("id", "userId", "title", "completed", "visibility")
        .first(),
    );
    return row
      ? {
          id: row.id,
          ownerId: row.userId,
          title: row.title,
          completed: row.completed,
          visibility: row.visibility,
        }
      : null;
  }

  async findLastReceivedNudgeId(todoId: number, userId: string): Promise<number | null> {
    const row = decodeRecord(
      "Nudge",
      await this.client.orm.public.Nudge.where((row) =>
        and(row.todoId.eq(todoId), row.receiverId.eq(userId)),
      )
        .select("id")
        .orderBy((row) => row.id.desc())
        .first(),
    );
    return row?.id ?? null;
  }

  async findThanksCandidates(
    input: FindNudgeThanksCandidatesInput,
  ): Promise<NudgeInteractionRecord[]> {
    const ids = await this.#findThanksCandidateIds(input);
    return this.#findThanksCandidatesByIds(ids);
  }

  async findThanksCandidatePage(
    input: FindNudgeThanksCandidatesInput & { cursor?: number; size: number },
  ): Promise<NudgeThanksCandidatePage> {
    const ids = await this.#findThanksCandidateIds(input);
    const { cursor } = input;
    const remainingIds = cursor === undefined ? ids : ids.filter((id) => id < cursor);
    const pageIds = remainingIds.slice(0, input.size);
    const hasNext = remainingIds.length > pageIds.length;
    return {
      items: await this.#findThanksCandidatesByIds(pageIds),
      totalRecipients: ids.length,
      hasNext,
      nextCursor: hasNext ? (pageIds.at(-1) ?? null) : null,
    };
  }

  async #findThanksCandidateIds(input: FindNudgeThanksCandidatesInput): Promise<number[]> {
    if (input.friendIds.length === 0) {
      return [];
    }
    const thanked = decodeRecord(
      "Nudge",
      await this.client.orm.public.Nudge.where((row) =>
        and(
          row.todoId.eq(input.todoId),
          row.receiverId.eq(input.userId),
          row.thankedAt.isNotNull(),
        ),
      )
        .select("senderId")
        .all(),
    );
    const groups = await this.client.orm.public.Nudge.where((row) =>
      and(
        row.todoId.eq(input.todoId),
        row.receiverId.eq(input.userId),
        row.id.lte(input.throughNudgeId),
        row.senderId.in([...input.friendIds]),
        row.senderId.notIn(thanked.map((item) => item.senderId)),
        row.thankedAt.isNull(),
        requireRecord(row.todo).some((related) =>
          and(related.visibility.eq("PUBLIC"), related.userId.eq(input.userId)),
        ),
      ),
    )
      .groupBy("senderId")
      .aggregate((aggregate) => ({ max_id: aggregate.max("id") }));
    return compact(groups.map((group) => group.max_id)).sort((left, right) => right - left);
  }

  async #findThanksCandidatesByIds(ids: readonly number[]): Promise<NudgeInteractionRecord[]> {
    if (ids.length === 0) return [];
    const rows = decodeRecord(
      "Nudge",
      await this.interactions
        .where((row) => row.id.in([...ids]))
        .orderBy((row) => row.id.desc())
        .all(),
    );
    return rows.map(PrismaNudgeRepository.toInteraction);
  }

  async findReceivedNudges(params: FindNudgesParams): Promise<NudgeWithRelations[]> {
    const { userId, cursor, size } = params;
    let nudges = this.interactions
      .where({ receiverId: userId })
      .orderBy((row) => row.createdAt.desc())
      .orderBy((row) => row.id.desc())
      .limit(size + 1);
    if (cursor !== undefined && cursor !== null) {
      const anchor = await this.client.orm.public.Nudge.where({ id: cursor })
        .select("id", "createdAt")
        .first();
      if (anchor === null) return [];
      nudges = nudges.cursor(anchor);
    }
    const rows = decodeRecord("Nudge", await nudges.all());
    return rows.map((row) => PrismaNudgeRepository.toWithRelations(row));
  }

  async findSentNudges(params: FindNudgesParams): Promise<NudgeWithRelations[]> {
    const { userId, cursor, size } = params;
    let nudges = this.interactions
      .where({ senderId: userId })
      .orderBy((row) => row.createdAt.desc())
      .orderBy((row) => row.id.desc())
      .limit(size + 1);
    if (cursor !== undefined && cursor !== null) {
      const anchor = await this.client.orm.public.Nudge.where({ id: cursor })
        .select("id", "createdAt")
        .first();
      if (anchor === null) return [];
      nudges = nudges.cursor(anchor);
    }
    const rows = decodeRecord("Nudge", await nudges.all());
    return rows.map((row) => PrismaNudgeRepository.toWithRelations(row));
  }

  async countSentSince(senderId: string, since: Date, untilExclusive: Date): Promise<number> {
    return this.client.orm.public.Nudge.where((row) =>
      and(
        row.senderId.eq(senderId),
        row.createdAt.gte(databaseTimestamp(since)),
        row.createdAt.lt(databaseTimestamp(untilExclusive)),
      ),
    )
      .aggregate((aggregate) => ({ count: aggregate.count() }))
      .then(({ count }) => count);
  }

  async countTodayTodos(userId: string, today: Date): Promise<number> {
    return this.client.orm.public.Todo.where((row) =>
      and(
        row.userId.eq(userId),
        or(
          and(row.startDate.lte(databaseDate(today)), row.endDate.gte(databaseDate(today))),
          and(row.startDate.eq(databaseDate(today)), row.endDate.isNull()),
        ),
      ),
    )
      .aggregate((aggregate) => ({ count: aggregate.count() }))
      .then(({ count }) => count);
  }

  async countReceived(userId: string): Promise<number> {
    return this.client.orm.public.Nudge.where((row) => row.receiverId.eq(userId))
      .aggregate((aggregate) => ({ count: aggregate.count() }))
      .then(({ count }) => count);
  }

  async countSent(userId: string): Promise<number> {
    return this.client.orm.public.Nudge.where((row) => row.senderId.eq(userId))
      .aggregate((aggregate) => ({ count: aggregate.count() }))
      .then(({ count }) => count);
  }

  async countUnreadReceived(userId: string): Promise<number> {
    return this.client.orm.public.Nudge.where((row) =>
      and(row.receiverId.eq(userId), row.readAt.isNull()),
    )
      .aggregate((aggregate) => ({ count: aggregate.count() }))
      .then(({ count }) => count);
  }

  async createNudge(input: CreateNudgeInput): Promise<NudgeWithRelations> {
    const row = decodeRecord(
      "Nudge",
      await this.interactions.create(
        encodeCreate("Nudge", {
          senderId: input.senderId,
          receiverId: input.receiverId,
          todoId: input.todoId,
          message: input.message,
          createdAt: input.createdAt,
        }),
      ),
    );
    return PrismaNudgeRepository.toWithRelations(row);
  }

  async createRemindNudge(input: CreateRemindNudgeInput): Promise<ReminderNudgeWithRelations> {
    const row = decodeRecord(
      "ReminderNudge",
      await this.client.orm.public.ReminderNudge.include("sender", (user) =>
        user
          .select("id", "userTag")
          .include("profile", (profile) => profile.select("name", "profileImage")),
      ).create(
        encodeCreate("ReminderNudge", {
          senderId: input.senderId,
          receiverId: input.receiverId,
          message: input.message,
        }),
      ),
    );
    return PrismaNudgeRepository.toRemindWithRelations(row);
  }
}
