import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import {
  type ListNudgesParams,
  NudgeReaderPort,
} from "#api/modules/social/nudges/application/ports/nudge.reader.port";
import type { NudgeThanksCandidateQuery } from "#api/modules/social/nudges/application/ports/nudge.repository.port";
import type {
  NudgeInteractionTodoReadModel,
  NudgeThanksRecipientReadModel,
} from "#api/modules/social/nudges/application/read-models/nudge-interaction.read-model";
import type { NudgeReadModel } from "#api/modules/social/nudges/application/read-models/nudge.read-model";
import type { NudgeId } from "#api/modules/social/nudges/domain/nudge-id.vo";
import type { Nudge } from "#api/modules/social/nudges/domain/nudge.aggregate";
import type { NudgeDirection } from "#api/modules/social/nudges/domain/nudges.constants";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { compareCreatedOrder, type InMemoryNudgeRepository } from "./in-memory-nudge.repository.js";

// Drizzle 조회와 같은 순서로 같은 저장소 상태를 읽는다. 차단 제외는 실제 PostgreSQL integration에서 본다
export class InMemoryNudgeReader extends NudgeReaderPort {
  readonly #repository: InMemoryNudgeRepository;

  constructor(repository: InMemoryNudgeRepository) {
    super();
    this.#repository = repository;
  }

  async listReceived(params: ListNudgesParams): Promise<NudgeReadModel[]> {
    return this.#listOwned(params, (nudge) => nudge.receiverId.equals(params.userId));
  }

  async listSent(params: ListNudgesParams): Promise<NudgeReadModel[]> {
    return this.#listOwned(params, (nudge) => nudge.senderId.equals(params.userId));
  }

  async countReceived(userId: UserId): Promise<number> {
    return this.#repository.listAll().filter((nudge) => nudge.receiverId.equals(userId)).length;
  }

  async countSent(userId: UserId): Promise<number> {
    return this.#repository.listAll().filter((nudge) => nudge.senderId.equals(userId)).length;
  }

  async countUnreadReceived(userId: UserId): Promise<number> {
    return this.#repository
      .listAll()
      .filter((nudge) => nudge.receiverId.equals(userId) && nudge.readAt == null).length;
  }

  async findInteraction(nudgeId: NudgeId, viewerId: UserId): Promise<NudgeReadModel | null> {
    const nudge = this.#repository.listAll().find((candidate) => candidate.id.equals(nudgeId));
    if (nudge == null || !(nudge.senderId.equals(viewerId) || nudge.receiverId.equals(viewerId))) {
      return null;
    }
    return this.#toReadModel(nudge);
  }

  async listInteractions(params: {
    readonly viewerId: UserId;
    readonly direction: NudgeDirection;
    readonly afterNudgeId: NudgeId | null;
    readonly limit: number;
  }): Promise<NudgeReadModel[]> {
    const { viewerId, direction, afterNudgeId, limit } = params;
    return this.#repository
      .listAll()
      .filter((nudge) =>
        direction === "received"
          ? nudge.receiverId.equals(viewerId)
          : nudge.senderId.equals(viewerId),
      )
      .filter((nudge) => afterNudgeId == null || nudge.id.value < afterNudgeId.value)
      .toSorted((left, right) => right.id.value - left.id.value)
      .slice(0, limit)
      .flatMap((nudge) => this.#toReadModel(nudge) ?? []);
  }

  async findInteractionTodo(
    todoId: TodoId,
    ownerId: UserId,
  ): Promise<NudgeInteractionTodoReadModel | null> {
    return this.#repository.findInteractionTodo(todoId.value, ownerId);
  }

  async findLastReceivedNudgeId(todoId: TodoId, receiverId: UserId): Promise<NudgeId | null> {
    const [last] = this.#repository
      .listAll()
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
  ): Promise<NudgeThanksRecipientReadModel[]> {
    const remaining = (await this.#repository.listThanksCandidates(query)).filter(
      (nudge) => query.afterNudgeId == null || nudge.id.value < query.afterNudgeId.value,
    );
    const page = query.limit == null ? remaining : remaining.slice(0, query.limit);
    return page.map((nudge) => ({
      nudgeId: nudge.id.value,
      sender: this.#repository.findUser(nudge.senderId.value),
    }));
  }

  async countThanksRecipients(query: NudgeThanksCandidateQuery): Promise<number> {
    return (await this.#repository.listThanksCandidates(query)).length;
  }

  #thanked(todoId: TodoId, receiverId: UserId): Nudge[] {
    return this.#repository
      .listAll()
      .filter(
        (nudge) =>
          nudge.todoId === todoId.value &&
          nudge.receiverId.equals(receiverId) &&
          nudge.thankedAt != null,
      );
  }

  #listOwned(params: ListNudgesParams, isOwned: (nudge: Nudge) => boolean): NudgeReadModel[] {
    const all = this.#repository.listAll();
    const anchor =
      params.afterNudgeId == null
        ? null
        : all.find((nudge) => params.afterNudgeId != null && nudge.id.equals(params.afterNudgeId));
    if (params.afterNudgeId != null && anchor == null) {
      return [];
    }
    return all
      .filter(isOwned)
      .filter((nudge) => anchor == null || compareCreatedOrder(anchor, nudge) < 0)
      .toSorted(compareCreatedOrder)
      .slice(0, params.limit)
      .flatMap((nudge) => this.#toReadModel(nudge) ?? []);
  }

  // 대상 할 일이 지워지면 콕도 함께 지워지는 외래 키와 같게, 할 일이 없는 콕은 내보내지 않는다
  #toReadModel(nudge: Nudge): NudgeReadModel | null {
    const todo = this.#repository.findTodo(nudge.todoId);
    if (todo == null) {
      return null;
    }
    const primitives = nudge.toPrimitives();
    return {
      ...primitives,
      sender: this.#repository.findUser(primitives.senderId),
      receiver: this.#repository.findUser(primitives.receiverId),
      todo: {
        id: todo.id,
        title: todo.title,
        completed: todo.completed,
        ownerId: todo.ownerId,
        visibility: todo.visibility,
      },
    };
  }
}
