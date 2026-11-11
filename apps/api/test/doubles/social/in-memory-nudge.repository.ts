import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type {
  ListNudgesParams,
  NudgeReaderPort,
} from "#api/modules/social/nudges/application/ports/nudge.reader.port";
import {
  NudgeRepositoryPort,
  type NudgeThanksCandidateQuery,
} from "#api/modules/social/nudges/application/ports/nudge.repository.port";
import type {
  NudgeInteractionTodo,
  NudgeThanksRecipient,
} from "#api/modules/social/nudges/application/read-models/nudge-interaction.read-model";
import type {
  NudgeListItem,
  NudgeUserSummary,
} from "#api/modules/social/nudges/application/read-models/nudge.read-model";
import { NudgeId } from "#api/modules/social/nudges/domain/nudge-id.vo";
import { NudgeTargetTodo } from "#api/modules/social/nudges/domain/nudge-target-todo.vo";
import { Nudge } from "#api/modules/social/nudges/domain/nudge.aggregate";
import type { NudgeDirection } from "#api/modules/social/nudges/domain/nudges.constants";
import { ReminderNudgeId } from "#api/modules/social/nudges/domain/reminder-nudge-id.vo";
import { ReminderNudge } from "#api/modules/social/nudges/domain/reminder-nudge.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import type { NudgeTodoSeed } from "#test/fixtures/social/nudge.fixture";

interface StoredTodo extends NudgeTodoSeed {
  readonly id: number;
}

// Drizzle 저장소와 같은 순서(생성 시각·id 내림차순)로 나열한다
function compareCreatedOrder(
  left: { readonly createdAt: Temporal.Instant; readonly id: { readonly value: number } },
  right: { readonly createdAt: Temporal.Instant; readonly id: { readonly value: number } },
): number {
  return (
    Temporal.Instant.compare(right.createdAt, left.createdAt) || right.id.value - left.id.value
  );
}

function copyOf(nudge: Nudge): Nudge {
  return Nudge.reconstitute(nudge.toPrimitives());
}

function copyOfReminder(reminder: ReminderNudge): ReminderNudge {
  return ReminderNudge.reconstitute(reminder.toPrimitives());
}

function isWithin(
  instant: Temporal.Instant,
  window: { readonly startsAt: Temporal.Instant; readonly endsAt: Temporal.Instant },
): boolean {
  return (
    Temporal.Instant.compare(window.startsAt, instant) <= 0 &&
    Temporal.Instant.compare(instant, window.endsAt) < 0
  );
}

// 차단 관계는 다루지 않는다. 차단 제외는 실제 PostgreSQL integration에서 본다
export class InMemoryNudgeRepository extends NudgeRepositoryPort implements NudgeReaderPort {
  readonly #nudges = new Map<number, Nudge>();
  readonly #reminders = new Map<number, ReminderNudge>();
  readonly #todos = new Map<number, StoredTodo>();
  readonly #users = new Map<string, NudgeUserSummary>();
  readonly thanksBatchSizes: number[] = [];
  #sequence = 0;
  #reminderSequence = 0;
  #todoSequence = 0;

  constructor(nudges: readonly Nudge[] = []) {
    super();
    for (const nudge of nudges) {
      this.#nudges.set(nudge.id.value, copyOf(nudge));
    }
    this.#sequence = Math.max(0, ...this.#nudges.keys());
  }

  get size(): number {
    return this.#nudges.size;
  }

  get reminderCount(): number {
    return this.#reminders.size;
  }

  addUser(user: NudgeUserSummary): void {
    this.#users.set(user.id, user);
  }

  async addTodo(seed: NudgeTodoSeed): Promise<number> {
    this.#todoSequence += 1;
    this.#todos.set(this.#todoSequence, { ...seed, id: this.#todoSequence });
    return this.#todoSequence;
  }

  updateTodo(todoId: number, changes: Partial<NudgeTodoSeed>): void {
    const todo = this.#todos.get(todoId);
    if (todo != null) {
      this.#todos.set(todoId, { ...todo, ...changes });
    }
  }

  deleteTodo(todoId: number): void {
    this.#todos.delete(todoId);
    for (const [id, nudge] of this.#nudges) {
      if (nudge.todoId === todoId) {
        this.#nudges.delete(id);
      }
    }
  }

  async nextId(): Promise<NudgeId> {
    this.#sequence += 1;
    return NudgeId.reconstitute(this.#sequence);
  }

  async findById(nudgeId: NudgeId): Promise<Nudge | null> {
    const nudge = this.#nudges.get(nudgeId.value);
    return nudge == null ? null : copyOf(nudge);
  }

  async findLastSentForTodo(senderId: UserId, todoId: TodoId): Promise<Nudge | null> {
    return this.#lastNudge(
      (nudge) => nudge.senderId.equals(senderId) && nudge.todoId === todoId.value,
    );
  }

  async findLastSentTo(senderId: UserId, receiverId: UserId): Promise<Nudge | null> {
    return this.#lastNudge(
      (nudge) => nudge.senderId.equals(senderId) && nudge.receiverId.equals(receiverId),
    );
  }

  async countSentBetween(
    senderId: UserId,
    window: { readonly startsAt: Temporal.Instant; readonly endsAt: Temporal.Instant },
  ): Promise<number> {
    return this.#all().filter(
      (nudge) => nudge.senderId.equals(senderId) && isWithin(nudge.createdAt, window),
    ).length;
  }

  async save(nudge: Nudge): Promise<void> {
    const stored = this.#nudges.get(nudge.id.value)?.toPrimitives();
    const next = nudge.toPrimitives();
    this.#nudges.set(
      nudge.id.value,
      Nudge.reconstitute({
        ...next,
        readAt: stored?.readAt ?? next.readAt,
        thankedAt: stored?.thankedAt ?? next.thankedAt,
      }),
    );
  }

  async saveThanks(nudges: readonly Nudge[]): Promise<void> {
    this.thanksBatchSizes.push(nudges.length);
    for (const nudge of nudges) {
      const stored = this.#nudges.get(nudge.id.value);
      if (stored != null && nudge.thankedAt != null) {
        stored.markThanked(nudge.thankedAt);
      }
    }
  }

  async listThanksCandidates(query: NudgeThanksCandidateQuery): Promise<Nudge[]> {
    return this.#thanksCandidates(query).map(copyOf);
  }

  async findTargetTodo(todoId: TodoId): Promise<NudgeTargetTodo | null> {
    const todo = this.#todos.get(todoId.value);
    return todo == null
      ? null
      : NudgeTargetTodo.reconstitute({
          ownerId: todo.ownerId,
          title: todo.title,
          visibility: todo.visibility,
          startDate: todo.startDate,
          endDate: todo.endDate,
        });
  }

  async lockInteractionTodo(todoId: TodoId, ownerId: UserId): Promise<NudgeInteractionTodo | null> {
    return this.#interactionTodo(todoId.value, ownerId);
  }

  async countTodosOn(ownerId: UserId, date: Temporal.PlainDate): Promise<number> {
    return [...this.#todos.values()].filter(
      (todo) =>
        todo.ownerId === ownerId.value &&
        (todo.endDate == null
          ? todo.startDate.equals(date)
          : Temporal.PlainDate.compare(todo.startDate, date) <= 0 &&
            Temporal.PlainDate.compare(date, todo.endDate) <= 0),
    ).length;
  }

  async nextReminderId(): Promise<ReminderNudgeId> {
    this.#reminderSequence += 1;
    return ReminderNudgeId.reconstitute(this.#reminderSequence);
  }

  async findLastReminderSentTo(
    senderId: UserId,
    receiverId: UserId,
  ): Promise<ReminderNudge | null> {
    const [last] = [...this.#reminders.values()]
      .filter(
        (reminder) => reminder.senderId.equals(senderId) && reminder.receiverId.equals(receiverId),
      )
      .toSorted(compareCreatedOrder);
    return last == null ? null : copyOfReminder(last);
  }

  async saveReminder(reminder: ReminderNudge): Promise<void> {
    this.#reminders.set(reminder.id.value, copyOfReminder(reminder));
  }

  async listReceived(params: ListNudgesParams): Promise<NudgeListItem[]> {
    return this.#listOwned(params, (nudge) => nudge.receiverId.equals(params.userId));
  }

  async listSent(params: ListNudgesParams): Promise<NudgeListItem[]> {
    return this.#listOwned(params, (nudge) => nudge.senderId.equals(params.userId));
  }

  async countReceived(userId: UserId): Promise<number> {
    return this.#all().filter((nudge) => nudge.receiverId.equals(userId)).length;
  }

  async countSent(userId: UserId): Promise<number> {
    return this.#all().filter((nudge) => nudge.senderId.equals(userId)).length;
  }

  async countUnreadReceived(userId: UserId): Promise<number> {
    return this.#all().filter((nudge) => nudge.receiverId.equals(userId) && nudge.readAt == null)
      .length;
  }

  async findInteraction(nudgeId: NudgeId, viewerId: UserId): Promise<NudgeListItem | null> {
    const nudge = this.#nudges.get(nudgeId.value);
    if (nudge == null || !(nudge.senderId.equals(viewerId) || nudge.receiverId.equals(viewerId))) {
      return null;
    }
    return this.#toListItem(nudge);
  }

  async listInteractions(params: {
    readonly viewerId: UserId;
    readonly direction: NudgeDirection;
    readonly afterNudgeId: NudgeId | null;
    readonly limit: number;
  }): Promise<NudgeListItem[]> {
    const { viewerId, direction, afterNudgeId, limit } = params;
    return this.#all()
      .filter((nudge) =>
        direction === "received"
          ? nudge.receiverId.equals(viewerId)
          : nudge.senderId.equals(viewerId),
      )
      .filter((nudge) => afterNudgeId == null || nudge.id.value < afterNudgeId.value)
      .toSorted((left, right) => right.id.value - left.id.value)
      .slice(0, limit)
      .flatMap((nudge) => this.#toListItem(nudge) ?? []);
  }

  async findInteractionTodo(todoId: TodoId, ownerId: UserId): Promise<NudgeInteractionTodo | null> {
    return this.#interactionTodo(todoId.value, ownerId);
  }

  async findLastReceivedNudgeId(todoId: TodoId, receiverId: UserId): Promise<NudgeId | null> {
    const [last] = this.#all()
      .filter((nudge) => nudge.todoId === todoId.value && nudge.receiverId.equals(receiverId))
      .toSorted((left, right) => right.id.value - left.id.value);
    return last?.id ?? null;
  }

  async countThankedRecipients(todoId: TodoId, receiverId: UserId): Promise<number> {
    return new Set(this.#thanked(todoId, receiverId).map((nudge) => nudge.senderId.value)).size;
  }

  async findLastThankedAt(todoId: TodoId, receiverId: UserId): Promise<Temporal.Instant | null> {
    const thankedAts = this.#thanked(todoId, receiverId)
      .flatMap((nudge) => nudge.thankedAt ?? [])
      .toSorted(Temporal.Instant.compare);
    return thankedAts.at(-1) ?? null;
  }

  async listThanksRecipients(
    query: NudgeThanksCandidateQuery & {
      readonly afterNudgeId: NudgeId | null;
      readonly limit: number | null;
    },
  ): Promise<NudgeThanksRecipient[]> {
    const remaining = this.#thanksCandidates(query).filter(
      (nudge) => query.afterNudgeId == null || nudge.id.value < query.afterNudgeId.value,
    );
    const page = query.limit == null ? remaining : remaining.slice(0, query.limit);
    return page.map((nudge) => ({
      nudgeId: nudge.id.value,
      sender: this.#userSummary(nudge.senderId.value),
    }));
  }

  async countThanksRecipients(query: NudgeThanksCandidateQuery): Promise<number> {
    return this.#thanksCandidates(query).length;
  }

  #all(): Nudge[] {
    return [...this.#nudges.values()];
  }

  #lastNudge(matches: (nudge: Nudge) => boolean): Nudge | null {
    const [last] = this.#all().filter(matches).toSorted(compareCreatedOrder);
    return last == null ? null : copyOf(last);
  }

  #thanked(todoId: TodoId, receiverId: UserId): Nudge[] {
    return this.#all().filter(
      (nudge) =>
        nudge.todoId === todoId.value &&
        nudge.receiverId.equals(receiverId) &&
        nudge.thankedAt != null,
    );
  }

  // 친구마다 throughNudgeId까지 받은, 아직 감사받지 않은 가장 최근 콕 하나(id 내림차순)
  #thanksCandidates(query: NudgeThanksCandidateQuery): Nudge[] {
    const todo = this.#todos.get(query.todoId.value);
    if (todo == null || todo.visibility !== "PUBLIC" || todo.ownerId !== query.ownerId.value) {
      return [];
    }
    const friends = new Set(query.friendIds.map((friendId) => friendId.value));
    const thankedSenders = new Set(
      this.#thanked(query.todoId, query.ownerId).map((nudge) => nudge.senderId.value),
    );
    const latestBySender = new Map<string, Nudge>();
    for (const nudge of this.#all()) {
      const isCandidate =
        nudge.todoId === query.todoId.value &&
        nudge.receiverId.equals(query.ownerId) &&
        nudge.id.value <= query.throughNudgeId.value &&
        friends.has(nudge.senderId.value) &&
        !thankedSenders.has(nudge.senderId.value) &&
        nudge.thankedAt == null;
      const latest = latestBySender.get(nudge.senderId.value);
      if (isCandidate && (latest == null || latest.id.value < nudge.id.value)) {
        latestBySender.set(nudge.senderId.value, nudge);
      }
    }
    return [...latestBySender.values()].toSorted((left, right) => right.id.value - left.id.value);
  }

  #interactionTodo(todoId: number, ownerId: UserId): NudgeInteractionTodo | null {
    const todo = this.#todos.get(todoId);
    if (todo == null || todo.ownerId !== ownerId.value) {
      return null;
    }
    return {
      id: todo.id,
      ownerId: todo.ownerId,
      title: todo.title,
      completed: todo.completed,
      visibility: todo.visibility,
    };
  }

  #listOwned(params: ListNudgesParams, isOwned: (nudge: Nudge) => boolean): NudgeListItem[] {
    const anchor = params.afterNudgeId == null ? null : this.#nudges.get(params.afterNudgeId.value);
    if (params.afterNudgeId != null && anchor == null) {
      return [];
    }
    return this.#all()
      .filter(isOwned)
      .filter((nudge) => anchor == null || compareCreatedOrder(anchor, nudge) < 0)
      .toSorted(compareCreatedOrder)
      .slice(0, params.limit)
      .flatMap((nudge) => this.#toListItem(nudge) ?? []);
  }

  // 대상 할 일이 지워지면 콕도 함께 지워지는 외래 키와 같게, 할 일이 없는 콕은 내보내지 않는다
  #toListItem(nudge: Nudge): NudgeListItem | null {
    const todo = this.#todos.get(nudge.todoId);
    if (todo == null) {
      return null;
    }
    const primitives = nudge.toPrimitives();
    return {
      ...primitives,
      sender: this.#userSummary(primitives.senderId),
      receiver: this.#userSummary(primitives.receiverId),
      todo: {
        id: todo.id,
        title: todo.title,
        completed: todo.completed,
        ownerId: todo.ownerId,
        visibility: todo.visibility,
      },
    };
  }

  #userSummary(userId: string): NudgeUserSummary {
    return (
      this.#users.get(userId) ?? { id: userId, userTag: userId, name: null, profileImage: null }
    );
  }
}
