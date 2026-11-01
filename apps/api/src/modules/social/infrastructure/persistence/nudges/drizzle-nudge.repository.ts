import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import {
  and,
  eq,
  exists,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  max,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { compact, maxBy, uniqBy } from "es-toolkit";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { nudge, reminderNudge, todo } from "#api/platform/database/schema/index";

import type {
  CreateNudgeInput,
  CreateRemindNudgeInput,
  FindNudgesParams,
  FindNudgeThanksCandidatesInput,
  NudgeInteractionRecord,
  NudgeInteractionTodo,
  NudgeRepositoryPort,
  NudgeThanksCandidatePage,
  NudgeThanksSummary,
  NudgeWithRelations,
  ReminderNudgeWithRelations,
  TargetTodoRecord,
} from "../../../application/ports/nudges/nudge.repository.port.js";
import { Nudge } from "../../../domain/aggregates/nudges/nudge.aggregate.js";
import { ReminderNudge } from "../../../domain/aggregates/nudges/reminder-nudge.aggregate.js";
import { hasNoBlockWith } from "../blocks/drizzle-user-block.filter.js";
import { USER_BRIEF_RELATION, type UserBriefRow } from "../drizzle-user-brief.relation.js";

type NudgeRow = typeof nudge.$inferSelect;
type ReminderNudgeRow = typeof reminderNudge.$inferSelect;
type InteractionTodoRow = {
  id: number;
  title: string;
  completed: boolean;
  userId: string;
  visibility: string;
};
type NudgeRowWithRelations = NudgeRow & {
  sender: UserBriefRow;
  receiver: UserBriefRow;
  todo: InteractionTodoRow;
};
type ReminderNudgeRowWithRelations = ReminderNudgeRow & {
  sender: UserBriefRow;
};

const INTERACTION_RELATIONS = {
  sender: USER_BRIEF_RELATION,
  receiver: USER_BRIEF_RELATION,
  todo: { columns: { id: true, title: true, completed: true, userId: true, visibility: true } },
} as const;

@Injectable()
export class DrizzleNudgeRepository implements NudgeRepositoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  private static toNudge(row: NudgeRow): Nudge {
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

  private static toReminderNudge(row: ReminderNudgeRow): ReminderNudge {
    return ReminderNudge.reconstitute({
      id: row.id,
      senderId: row.senderId,
      receiverId: row.receiverId,
      message: row.message,
      createdAt: row.createdAt,
    });
  }

  private static toWithRelations(row: NudgeRowWithRelations): NudgeWithRelations {
    return {
      id: row.id,
      senderId: row.senderId,
      receiverId: row.receiverId,
      todoId: row.todoId,
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
      todo: {
        id: row.todo.id,
        title: row.todo.title,
        completed: row.todo.completed,
      },
    };
  }

  private static toInteractionTodo(row: InteractionTodoRow): NudgeInteractionTodo {
    return {
      id: row.id,
      ownerId: row.userId,
      title: row.title,
      completed: row.completed,
      visibility: row.visibility,
    };
  }

  private static toRemindWithRelations(
    row: ReminderNudgeRowWithRelations,
  ): ReminderNudgeWithRelations {
    return {
      id: row.id,
      senderId: row.senderId,
      receiverId: row.receiverId,
      message: row.message,
      createdAt: row.createdAt,
      sender: {
        id: row.sender.id,
        userTag: row.sender.userTag,
        profile: row.sender.profile,
      },
    };
  }

  private static toInteraction(row: NudgeRowWithRelations): NudgeInteractionRecord {
    return {
      ...DrizzleNudgeRepository.toWithRelations(row),
      replyKind: row.replyKind,
      repliedAt: row.repliedAt,
      replyUpdatedAt: row.replyUpdatedAt,
      thankedAt: row.thankedAt,
      todo: {
        id: row.todo.id,
        title: row.todo.title,
        completed: row.todo.completed,
        ownerId: row.todo.userId,
        visibility: row.todo.visibility,
      },
    };
  }

  async findById(id: number): Promise<Nudge | null> {
    const row = await this.db.query.nudge.findFirst({ where: { id } });
    return row == null ? null : DrizzleNudgeRepository.toNudge(row);
  }

  async findLastNudgeForTodo(senderId: string, todoId: number): Promise<Nudge | null> {
    const row = await this.db.query.nudge.findFirst({
      where: { senderId, todoId },
      orderBy: { createdAt: "desc" },
    });
    return row == null ? null : DrizzleNudgeRepository.toNudge(row);
  }

  async findLastNudgeToUser(senderId: string, receiverId: string): Promise<Nudge | null> {
    const row = await this.db.query.nudge.findFirst({
      where: { senderId, receiverId },
      orderBy: { createdAt: "desc" },
    });
    return row == null ? null : DrizzleNudgeRepository.toNudge(row);
  }

  async findLastRemindNudge(senderId: string, receiverId: string): Promise<ReminderNudge | null> {
    const row = await this.db.query.reminderNudge.findFirst({
      where: { senderId, receiverId },
      orderBy: { createdAt: "desc" },
    });
    return row == null ? null : DrizzleNudgeRepository.toReminderNudge(row);
  }

  async findTargetTodo(todoId: number): Promise<TargetTodoRecord | null> {
    const row = await this.db.query.todo.findFirst({
      columns: { userId: true, visibility: true, startDate: true, endDate: true },
      where: { id: todoId },
    });
    if (row == null) {
      return null;
    }
    return {
      ownerId: row.userId,
      visibility: row.visibility,
      startDate: row.startDate,
      endDate: row.endDate,
    };
  }

  async saveRead(target: Nudge): Promise<void> {
    await this.db
      .update(nudge)
      .set({ readAt: target.readAt })
      .where(and(eq(nudge.id, target.id), isNull(nudge.readAt)));
  }

  async saveReply(target: Nudge): Promise<void> {
    const state = target.toPersistence();
    const [updated] = await this.db
      .update(nudge)
      .set({
        replyKind: state.replyKind,
        repliedAt: state.repliedAt,
        replyUpdatedAt: state.replyUpdatedAt,
      })
      .where(eq(nudge.id, target.id))
      .returning({ id: nudge.id });
    requireRecord(updated);
    await this.saveRead(target);
  }

  async saveThanksBatch(nudgeIds: readonly number[], thankedAt: Date): Promise<void> {
    if (nudgeIds.length === 0) {
      return;
    }
    await this.db
      .update(nudge)
      .set({ thankedAt })
      .where(and(inArray(nudge.id, [...nudgeIds]), isNull(nudge.thankedAt)));
  }

  async findInteractionById(id: number, userId: string): Promise<NudgeInteractionRecord | null> {
    const row = await this.db.query.nudge.findFirst({
      where: {
        id,
        // 목록과 같이 상대가 어느 방향으로든 차단 관계면 없는 콕으로 본다.
        OR: [
          { receiverId: userId, RAW: (table) => hasNoBlockWith(table.senderId, userId) },
          { senderId: userId, RAW: (table) => hasNoBlockWith(table.receiverId, userId) },
        ],
      },
      with: INTERACTION_RELATIONS,
    });
    return row == null ? null : DrizzleNudgeRepository.toInteraction(row);
  }

  async findInteractions(
    params: FindNudgesParams & { direction: "received" | "sent" },
  ): Promise<NudgeInteractionRecord[]> {
    const { userId, cursor, size, direction } = params;
    const rows = await this.db.query.nudge.findMany({
      where: {
        ...(direction === "received" ? { receiverId: userId } : { senderId: userId }),
        RAW: (table) =>
          hasNoBlockWith(direction === "received" ? table.senderId : table.receiverId, userId),
        ...(cursor != null && { id: { lt: cursor } }),
      },
      with: INTERACTION_RELATIONS,
      orderBy: { id: "desc" },
      limit: size + 1,
    });
    return rows.map((row) => DrizzleNudgeRepository.toInteraction(row));
  }

  async lockInteractionTodo(todoId: number, userId: string): Promise<NudgeInteractionTodo | null> {
    // 완료·공개 상태 변경과 답장·감사 저장을 같은 행 잠금으로 직렬화한다.
    const [row] = await this.db
      .select({
        id: todo.id,
        userId: todo.userId,
        title: todo.title,
        completed: todo.completed,
        visibility: todo.visibility,
      })
      .from(todo)
      .where(and(eq(todo.id, todoId), eq(todo.userId, userId)))
      .limit(1)
      .for("update");
    return row ? DrizzleNudgeRepository.toInteractionTodo(row) : null;
  }

  async findInteractionTodo(todoId: number, userId: string): Promise<NudgeInteractionTodo | null> {
    const row = await this.db.query.todo.findFirst({
      columns: { id: true, userId: true, title: true, completed: true, visibility: true },
      where: { id: todoId, userId },
    });
    return row ? DrizzleNudgeRepository.toInteractionTodo(row) : null;
  }

  async findLastReceivedNudgeId(todoId: number, userId: string): Promise<number | null> {
    const row = await this.db.query.nudge.findFirst({
      columns: { id: true },
      where: { todoId, receiverId: userId },
      orderBy: { id: "desc" },
    });
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
    const remainingIds = cursor == null ? ids : ids.filter((id) => id < cursor);
    const pageIds = remainingIds.slice(0, input.size);
    const hasNext = remainingIds.length > pageIds.length;
    return {
      items: await this.#findThanksCandidatesByIds(pageIds),
      totalRecipients: ids.length,
      hasNext,
      nextCursor: hasNext ? (pageIds.at(-1) ?? null) : null,
    };
  }

  async findThanksSummary(todoId: number, userId: string): Promise<NudgeThanksSummary> {
    const thanked = await this.db
      .select({ senderId: nudge.senderId, thankedAt: nudge.thankedAt })
      .from(nudge)
      .where(
        and(eq(nudge.todoId, todoId), eq(nudge.receiverId, userId), isNotNull(nudge.thankedAt)),
      );
    const thankedAtList = compact(thanked.map((item) => item.thankedAt));
    return {
      thankedRecipientCount: uniqBy(thanked, (item) => item.senderId).length,
      lastThankedAt: maxBy(thankedAtList, (thankedAt) => thankedAt.getTime()) ?? null,
    };
  }

  async #findThanksCandidateIds(input: FindNudgeThanksCandidatesInput): Promise<number[]> {
    if (input.friendIds.length === 0) {
      return [];
    }
    const thanked = await this.db
      .select({ senderId: nudge.senderId })
      .from(nudge)
      .where(
        and(
          eq(nudge.todoId, input.todoId),
          eq(nudge.receiverId, input.userId),
          isNotNull(nudge.thankedAt),
        ),
      );
    const thankedSenderIds = thanked.map((item) => item.senderId);
    const groups = await this.db
      .select({ latestId: max(nudge.id) })
      .from(nudge)
      .where(
        and(
          eq(nudge.todoId, input.todoId),
          eq(nudge.receiverId, input.userId),
          lte(nudge.id, input.throughNudgeId),
          inArray(nudge.senderId, [...input.friendIds]),
          thankedSenderIds.length === 0 ? undefined : notInArray(nudge.senderId, thankedSenderIds),
          isNull(nudge.thankedAt),
          exists(
            this.db
              .select({ one: sql`1` })
              .from(todo)
              .where(
                and(
                  eq(todo.id, nudge.todoId),
                  eq(todo.visibility, "PUBLIC"),
                  eq(todo.userId, input.userId),
                ),
              ),
          ),
        ),
      )
      .groupBy(nudge.senderId);
    return compact(groups.map((group) => group.latestId)).sort((left, right) => right - left);
  }

  async #findThanksCandidatesByIds(ids: readonly number[]): Promise<NudgeInteractionRecord[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.db.query.nudge.findMany({
      where: { id: { in: [...ids] } },
      with: INTERACTION_RELATIONS,
      orderBy: { id: "desc" },
    });
    return rows.map((row) => DrizzleNudgeRepository.toInteraction(row));
  }

  findReceivedNudges(params: FindNudgesParams): Promise<NudgeWithRelations[]> {
    return this.findPage(params, "receiverId");
  }

  findSentNudges(params: FindNudgesParams): Promise<NudgeWithRelations[]> {
    return this.findPage(params, "senderId");
  }

  private async findPage(
    { userId, cursor, size }: FindNudgesParams,
    owner: "receiverId" | "senderId",
  ): Promise<NudgeWithRelations[]> {
    const anchor =
      cursor == null
        ? undefined
        : await this.db.query.nudge.findFirst({
            columns: { id: true, createdAt: true },
            where: { id: cursor },
          });
    if (cursor != null && anchor == null) {
      return [];
    }

    const rows = await this.db.query.nudge.findMany({
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
                  RAW: (table: typeof nudge) =>
                    sql`(${table.createdAt}, ${table.id}) < (${sql.param(anchor.createdAt, table.createdAt)}, ${anchor.id})`,
                },
              ]),
        ],
      },
      with: INTERACTION_RELATIONS,
      orderBy: { createdAt: "desc", id: "desc" },
      limit: size + 1,
    });
    return rows.map((row) => DrizzleNudgeRepository.toWithRelations(row));
  }

  countSentSince(senderId: string, since: Date, untilExclusive: Date): Promise<number> {
    return this.db.$count(
      nudge,
      and(
        eq(nudge.senderId, senderId),
        gte(nudge.createdAt, since),
        lt(nudge.createdAt, untilExclusive),
      ),
    );
  }

  countTodayTodos(userId: string, today: Date): Promise<number> {
    return this.db.$count(
      todo,
      and(
        eq(todo.userId, userId),
        or(
          and(lte(todo.startDate, today), gte(todo.endDate, today)),
          and(eq(todo.startDate, today), isNull(todo.endDate)),
        ),
      ),
    );
  }

  countReceived(userId: string): Promise<number> {
    return this.db.$count(
      nudge,
      and(eq(nudge.receiverId, userId), hasNoBlockWith(nudge.senderId, userId)),
    );
  }

  countSent(userId: string): Promise<number> {
    return this.db.$count(
      nudge,
      and(eq(nudge.senderId, userId), hasNoBlockWith(nudge.receiverId, userId)),
    );
  }

  countUnreadReceived(userId: string): Promise<number> {
    return this.db.$count(
      nudge,
      and(
        eq(nudge.receiverId, userId),
        isNull(nudge.readAt),
        hasNoBlockWith(nudge.senderId, userId),
      ),
    );
  }

  async createNudge(input: CreateNudgeInput): Promise<NudgeWithRelations> {
    const [created] = await this.db
      .insert(nudge)
      .values({
        senderId: input.senderId,
        receiverId: input.receiverId,
        todoId: input.todoId,
        message: input.message,
        createdAt: input.createdAt,
      })
      .returning({ id: nudge.id });
    const row = await this.db.query.nudge.findFirst({
      where: { id: requireRecord(created).id },
      with: INTERACTION_RELATIONS,
    });
    return DrizzleNudgeRepository.toWithRelations(requireRecord(row));
  }

  async createRemindNudge(input: CreateRemindNudgeInput): Promise<ReminderNudgeWithRelations> {
    const [created] = await this.db
      .insert(reminderNudge)
      .values({
        senderId: input.senderId,
        receiverId: input.receiverId,
        message: input.message,
      })
      .returning({ id: reminderNudge.id });
    const row = await this.db.query.reminderNudge.findFirst({
      where: { id: requireRecord(created).id },
      with: { sender: USER_BRIEF_RELATION },
    });
    return DrizzleNudgeRepository.toRemindWithRelations(requireRecord(row));
  }
}
