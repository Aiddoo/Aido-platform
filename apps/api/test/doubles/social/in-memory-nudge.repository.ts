import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import {
  NudgeRepositoryPort,
  type NudgeThanksCandidateQuery,
} from "#api/modules/social/nudges/application/ports/nudge.repository.port";
import type { NudgeInteractionTodoReadModel } from "#api/modules/social/nudges/application/read-models/nudge-interaction.read-model";
import type { NudgeUserReadModel } from "#api/modules/social/nudges/application/read-models/nudge.read-model";
import { NudgeId } from "#api/modules/social/nudges/domain/nudge-id.vo";
import { NudgeTargetTodo } from "#api/modules/social/nudges/domain/nudge-target-todo.vo";
import { Nudge } from "#api/modules/social/nudges/domain/nudge.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import type { NudgeTodoSeed } from "#test/fixtures/social/nudge.fixture";

export interface StoredNudgeTodo extends NudgeTodoSeed {
  readonly id: number;
}

// Drizzle 저장소와 같은 순서(생성 시각·id 내림차순)로 나열한다
export function compareCreatedOrder(left: Nudge, right: Nudge): number {
  return (
    Temporal.Instant.compare(right.createdAt, left.createdAt) || right.id.value - left.id.value
  );
}

function copyOf(nudge: Nudge): Nudge {
  return Nudge.reconstitute(nudge.toPrimitives());
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

// 콕 대상 할 일·사용자 요약은 planning·identity가 쓰는 행이라 저장소 밖에서 넣는다.
// InMemoryNudgeReader가 같은 상태를 읽는다. 차단 제외는 실제 PostgreSQL integration에서 본다
export class InMemoryNudgeRepository extends NudgeRepositoryPort {
  readonly #nudges = new Map<number, Nudge>();
  readonly #todos = new Map<number, StoredNudgeTodo>();
  readonly #users = new Map<string, NudgeUserReadModel>();
  readonly saveAllBatchSizes: number[] = [];
  #sequence = 0;
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

  listAll(): Nudge[] {
    return [...this.#nudges.values()].map(copyOf);
  }

  findTodo(todoId: number): StoredNudgeTodo | null {
    return this.#todos.get(todoId) ?? null;
  }

  findUser(userId: string): NudgeUserReadModel {
    return (
      this.#users.get(userId) ?? { id: userId, userTag: userId, name: null, profileImage: null }
    );
  }

  addUser(user: NudgeUserReadModel): void {
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

  // 할 일이 지워지면 콕도 함께 지워지는 외래 키와 같다
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
    return this.listAll().filter(
      (nudge) => nudge.senderId.equals(senderId) && isWithin(nudge.createdAt, window),
    ).length;
  }

  // 친구마다 throughNudgeId까지 받은, 아직 감사받지 않은 가장 최근 콕 하나(id 내림차순)
  async listThanksCandidates(query: NudgeThanksCandidateQuery): Promise<Nudge[]> {
    const todo = this.#todos.get(query.todoId.value);
    if (todo == null || todo.visibility !== "PUBLIC" || todo.ownerId !== query.ownerId.value) {
      return [];
    }
    const friends = new Set(query.friendIds.map((friendId) => friendId.value));
    const all = this.listAll();
    const thankedSenders = new Set(
      all
        .filter(
          (nudge) =>
            nudge.todoId === query.todoId.value &&
            nudge.receiverId.equals(query.ownerId) &&
            nudge.thankedAt != null,
        )
        .map((nudge) => nudge.senderId.value),
    );
    const latestBySender = new Map<string, Nudge>();
    for (const nudge of all) {
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

  async saveAll(nudges: readonly Nudge[]): Promise<void> {
    this.saveAllBatchSizes.push(nudges.length);
    for (const nudge of nudges) {
      await this.save(nudge);
    }
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

  async lockInteractionTodo(
    todoId: TodoId,
    ownerId: UserId,
  ): Promise<NudgeInteractionTodoReadModel | null> {
    return this.findInteractionTodo(todoId.value, ownerId);
  }

  findInteractionTodo(todoId: number, ownerId: UserId): NudgeInteractionTodoReadModel | null {
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

  #lastNudge(matches: (nudge: Nudge) => boolean): Nudge | null {
    const [last] = this.listAll().filter(matches).toSorted(compareCreatedOrder);
    return last ?? null;
  }
}
