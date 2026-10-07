import type {
  CheerNotifierPort,
  CheerSentNotification,
} from "#api/modules/social/application/ports/cheers/cheer-notifier.port";
import type {
  CheerRepositoryPort,
  CheerRecord,
  CheerWithRelations,
  CreateCheerInput,
  FindCheersParams,
} from "#api/modules/social/application/ports/cheers/cheer.repository.port";
import type { FollowUserBrief } from "#api/modules/social/application/ports/friends/follow.repository.port";
import type {
  NudgeNotifierPort,
  NudgeSentNotification,
  NudgeInteractionNotification,
} from "#api/modules/social/application/ports/nudges/nudge-notifier.port";
import type {
  NudgeRepositoryPort,
  TargetTodoRecord,
  NudgeWithRelations,
  NudgeInteractionRecord,
  NudgeInteractionTodo,
  CreateNudgeInput,
  CreateRemindNudgeInput,
  ReminderNudgeWithRelations,
  FindNudgesParams,
  FindNudgeThanksCandidatesInput,
  NudgeThanksCandidatePage,
} from "#api/modules/social/application/ports/nudges/nudge.repository.port";
import { Cheer } from "#api/modules/social/domain/aggregates/cheers/cheer.aggregate";
import {
  Nudge,
  type NudgeProps,
} from "#api/modules/social/domain/aggregates/nudges/nudge.aggregate";
import {
  ReminderNudge,
  type ReminderNudgeProps,
} from "#api/modules/social/domain/aggregates/nudges/reminder-nudge.aggregate";
import { now } from "#api/shared/domain/date/utils/core";
import { CheerFixture, NudgeFixture } from "#test/fixtures/friend.fixture";

export class StubCheerRepository implements CheerRepositoryPort {
  readonly records = new Map<number, CheerRecord>();
  constructor(readonly users: ReadonlyMap<string, FollowUserBrief>) {}
  seed(input: Partial<CheerRecord> & Pick<CheerRecord, "senderId" | "receiverId">): CheerRecord {
    const record = CheerFixture.create(input);
    this.records.set(record.id, structuredClone(record));
    return record;
  }
  async findById(id: number): Promise<Cheer | null> {
    const record = this.records.get(id);
    return record ? Cheer.reconstitute(record) : null;
  }
  async findLastCheerToUser(senderId: string, receiverId: string): Promise<Cheer | null> {
    const record = [...this.records.values()]
      .filter((record) => record.senderId === senderId && record.receiverId === receiverId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
    return record ? Cheer.reconstitute(record) : null;
  }
  async saveRead(cheer: Cheer): Promise<void> {
    const record = this.records.get(cheer.id);
    if (record && record.readAt === null)
      this.records.set(cheer.id, { ...record, readAt: cheer.readAt });
  }
  async markManyAsRead(ids: number[], receiverId: string): Promise<number> {
    let count = 0;
    for (const id of new Set(ids)) {
      const record = this.records.get(id);
      if (record?.receiverId === receiverId && record.readAt === null) {
        this.records.set(id, { ...record, readAt: now() });
        count += 1;
      }
    }
    return count;
  }
  async findReceivedCheers(input: FindCheersParams): Promise<CheerWithRelations[]> {
    return this.#projections(
      [...this.records.values()].filter((record) => record.receiverId === input.userId),
    );
  }
  async findSentCheers(input: FindCheersParams): Promise<CheerWithRelations[]> {
    return this.#projections(
      [...this.records.values()].filter((record) => record.senderId === input.userId),
    );
  }
  async countSentSince(senderId: string, since: Date, untilExclusive: Date): Promise<number> {
    return [...this.records.values()].filter(
      (record) =>
        record.senderId === senderId &&
        record.createdAt >= since &&
        record.createdAt < untilExclusive,
    ).length;
  }
  async countReceived(userId: string): Promise<number> {
    return [...this.records.values()].filter((record) => record.receiverId === userId).length;
  }
  async countSent(userId: string): Promise<number> {
    return [...this.records.values()].filter((record) => record.senderId === userId).length;
  }
  async countUnreadReceived(userId: string): Promise<number> {
    return [...this.records.values()].filter(
      (record) => record.receiverId === userId && record.readAt === null,
    ).length;
  }
  async createWithRelations(input: CreateCheerInput): Promise<CheerWithRelations> {
    const record = this.seed({ ...input, message: input.message ?? null });
    return this.#projection(record);
  }
  #projection(record: CheerRecord): CheerWithRelations {
    return structuredClone({
      ...record,
      sender: this.users.get(record.senderId) ?? {
        id: record.senderId,
        userTag: record.senderId,
        profile: null,
      },
      receiver: this.users.get(record.receiverId) ?? {
        id: record.receiverId,
        userTag: record.receiverId,
        profile: null,
      },
    });
  }
  #projections(records: CheerRecord[]): CheerWithRelations[] {
    return records.map((record) => this.#projection(record));
  }
}

export class StubNudgeRepository implements NudgeRepositoryPort {
  readonly records = new Map<number, NudgeProps>();
  readonly reminders = new Map<number, ReminderNudgeProps>();
  readonly todos = new Map<number, TargetTodoRecord & { title: string; completed: boolean }>();
  constructor(readonly users: ReadonlyMap<string, FollowUserBrief>) {}
  seed(
    input: Partial<NudgeProps> & Pick<NudgeProps, "senderId" | "receiverId" | "todoId">,
  ): NudgeProps {
    const record = NudgeFixture.create(input);
    this.records.set(record.id, structuredClone(record));
    return record;
  }
  seedReminder(input: Omit<ReminderNudgeProps, "id"> & { id?: number }): ReminderNudgeProps {
    const record = { ...input, id: input.id ?? this.reminders.size + 1 };
    this.reminders.set(record.id, structuredClone(record));
    return record;
  }
  async findById(id: number): Promise<Nudge | null> {
    const record = this.records.get(id);
    return record ? Nudge.reconstitute(record) : null;
  }
  async findLastNudgeForTodo(senderId: string, todoId: number): Promise<Nudge | null> {
    return this.#last(
      [...this.records.values()].filter(
        (record) => record.senderId === senderId && record.todoId === todoId,
      ),
    );
  }
  async findLastNudgeToUser(senderId: string, receiverId: string): Promise<Nudge | null> {
    return this.#last(
      [...this.records.values()].filter(
        (record) => record.senderId === senderId && record.receiverId === receiverId,
      ),
    );
  }
  async findLastRemindNudge(senderId: string, receiverId: string): Promise<ReminderNudge | null> {
    const record = [...this.reminders.values()]
      .filter((record) => record.senderId === senderId && record.receiverId === receiverId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
    return record ? ReminderNudge.reconstitute(record) : null;
  }
  async findTargetTodo(todoId: number): Promise<TargetTodoRecord | null> {
    const todo = this.todos.get(todoId);
    return todo ? structuredClone(todo) : null;
  }
  async saveRead(nudge: Nudge): Promise<void> {
    const record = this.records.get(nudge.id);
    if (record && record.readAt === null)
      this.records.set(nudge.id, { ...record, readAt: nudge.readAt });
  }
  async saveReply(nudge: Nudge): Promise<void> {
    const record = this.records.get(nudge.id);
    if (record) this.records.set(nudge.id, { ...record, ...nudge.toPersistence() });
  }
  async saveThanksBatch(ids: readonly number[], thankedAt: Date): Promise<void> {
    for (const id of ids) {
      const record = this.records.get(id);
      if (record && record.thankedAt === null)
        this.records.set(id, { ...record, thankedAt: new Date(thankedAt) });
    }
  }
  async findInteractionById(id: number, userId: string): Promise<NudgeInteractionRecord | null> {
    const record = this.records.get(id);
    return record && (record.senderId === userId || record.receiverId === userId)
      ? this.#interaction(record)
      : null;
  }
  async findInteractions(
    input: FindNudgesParams & { direction: "received" | "sent" },
  ): Promise<NudgeInteractionRecord[]> {
    return [...this.records.values()]
      .filter(
        (record) =>
          (input.direction === "received" ? record.receiverId : record.senderId) === input.userId,
      )
      .flatMap((record) => {
        const item = this.#interaction(record);
        return item ? [item] : [];
      });
  }
  async findInteractionTodo(todoId: number, userId: string): Promise<NudgeInteractionTodo | null> {
    const todo = this.todos.get(todoId);
    return todo?.ownerId === userId
      ? {
          id: todoId,
          title: todo.title,
          completed: todo.completed,
          visibility: todo.visibility,
          ownerId: todo.ownerId,
        }
      : null;
  }
  async lockInteractionTodo(todoId: number, userId: string): Promise<NudgeInteractionTodo | null> {
    return this.findInteractionTodo(todoId, userId);
  }
  async findLastReceivedNudgeId(todoId: number, userId: string): Promise<number | null> {
    const ids = [...this.records.values()]
      .filter((record) => record.todoId === todoId && record.receiverId === userId)
      .map((record) => record.id);
    return ids.length > 0 ? Math.max(...ids) : null;
  }
  async findThanksCandidates(
    input: FindNudgeThanksCandidatesInput,
  ): Promise<NudgeInteractionRecord[]> {
    return [...this.records.values()]
      .filter(
        (record) =>
          record.todoId === input.todoId &&
          record.receiverId === input.userId &&
          record.id <= input.throughNudgeId &&
          input.friendIds.includes(record.senderId),
      )
      .flatMap((record) => {
        const item = this.#interaction(record);
        return item ? [item] : [];
      });
  }
  async findThanksCandidatePage(
    input: FindNudgeThanksCandidatesInput & { cursor?: number; size: number },
  ): Promise<NudgeThanksCandidatePage> {
    const records = await this.findThanksCandidates(input);
    const eligible = records.filter(
      (record) => input.cursor === undefined || record.id > input.cursor,
    );
    const items = eligible.slice(0, input.size);
    return {
      items,
      totalRecipients: records.length,
      nextCursor: eligible.length > input.size ? (items.at(-1)?.id ?? null) : null,
      hasNext: eligible.length > input.size,
    };
  }
  async findReceivedNudges(input: FindNudgesParams): Promise<NudgeWithRelations[]> {
    return this.#projections(
      [...this.records.values()].filter((record) => record.receiverId === input.userId),
    );
  }
  async findSentNudges(input: FindNudgesParams): Promise<NudgeWithRelations[]> {
    return this.#projections(
      [...this.records.values()].filter((record) => record.senderId === input.userId),
    );
  }
  async countSentSince(senderId: string, since: Date, untilExclusive: Date): Promise<number> {
    return [...this.records.values()].filter(
      (record) =>
        record.senderId === senderId &&
        record.createdAt >= since &&
        record.createdAt < untilExclusive,
    ).length;
  }
  async countTodayTodos(userId: string, today: Date): Promise<number> {
    return [...this.todos.values()].filter(
      (todo) =>
        todo.ownerId === userId &&
        todo.startDate <= today &&
        (todo.endDate ?? todo.startDate) >= today,
    ).length;
  }
  async countReceived(userId: string): Promise<number> {
    return [...this.records.values()].filter((record) => record.receiverId === userId).length;
  }
  async countSent(userId: string): Promise<number> {
    return [...this.records.values()].filter((record) => record.senderId === userId).length;
  }
  async countUnreadReceived(userId: string): Promise<number> {
    return [...this.records.values()].filter(
      (record) => record.receiverId === userId && record.readAt === null,
    ).length;
  }
  async createNudge(input: CreateNudgeInput): Promise<NudgeWithRelations> {
    const record = this.seed({ ...input, message: input.message ?? null });
    return this.#projection(record);
  }
  async createRemindNudge(input: CreateRemindNudgeInput): Promise<ReminderNudgeWithRelations> {
    const record = this.seedReminder({
      ...input,
      message: input.message ?? null,
      createdAt: now(),
    });
    return structuredClone({
      ...record,
      sender: this.users.get(input.senderId) ?? {
        id: input.senderId,
        userTag: input.senderId,
        profile: null,
      },
    });
  }
  #last(records: NudgeProps[]): Nudge | null {
    const record = records.sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    )[0];
    return record ? Nudge.reconstitute(record) : null;
  }
  #projection(record: NudgeProps): NudgeWithRelations {
    const todo = this.todos.get(record.todoId);
    return structuredClone({
      ...record,
      sender: this.users.get(record.senderId) ?? {
        id: record.senderId,
        userTag: record.senderId,
        profile: null,
      },
      receiver: this.users.get(record.receiverId) ?? {
        id: record.receiverId,
        userTag: record.receiverId,
        profile: null,
      },
      todo: { id: record.todoId, title: todo?.title ?? "", completed: todo?.completed ?? false },
    });
  }
  #projections(records: NudgeProps[]): NudgeWithRelations[] {
    return records.map((record) => this.#projection(record));
  }
  #interaction(record: NudgeProps): NudgeInteractionRecord | null {
    const todo = this.todos.get(record.todoId);
    return todo
      ? structuredClone({
          ...this.#projection(record),
          replyKind: record.replyKind,
          repliedAt: record.repliedAt,
          replyUpdatedAt: record.replyUpdatedAt,
          thankedAt: record.thankedAt,
          todo: {
            id: record.todoId,
            title: todo.title,
            completed: todo.completed,
            ownerId: todo.ownerId,
            visibility: todo.visibility,
          },
        })
      : null;
  }
}

export class StubCheerNotifier implements CheerNotifierPort {
  readonly notifications: CheerSentNotification[] = [];
  notifyCheerSent(input: CheerSentNotification): void {
    this.notifications.push({ ...input });
  }
}
export class StubNudgeNotifier implements NudgeNotifierPort {
  readonly notifications: NudgeSentNotification[] = [];
  readonly interactions: NudgeInteractionNotification[] = [];
  readonly batchSizes: number[] = [];
  notifyNudgeSent(input: NudgeSentNotification): void {
    this.notifications.push({ ...input });
  }
  async recordInteraction(input: NudgeInteractionNotification): Promise<void> {
    this.interactions.push({ ...input });
  }
  async recordInteractions(input: readonly NudgeInteractionNotification[]): Promise<void> {
    this.batchSizes.push(input.length);
    this.interactions.push(...structuredClone(input));
  }
}
