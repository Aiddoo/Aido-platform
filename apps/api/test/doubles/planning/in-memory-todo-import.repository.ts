import { TODO_IMPORT_ACTIVE_STATUSES } from "@aido/api/vocabulary";
import { orderBy } from "es-toolkit";

import {
  TodoImportRepositoryPort,
  type StalledTodoImportQuery,
} from "#api/modules/planning/todo-imports/application/ports/todo-import.repository.port";
import { todoImportAlreadyActiveConflict } from "#api/modules/planning/todo-imports/application/todo-imports.errors";
import type { TodoImportId } from "#api/modules/planning/todo-imports/domain/todo-import-id.vo";
import { TodoImport } from "#api/modules/planning/todo-imports/domain/todo-import.aggregate";
import { TODO_IMPORT_ENDED_STATUSES } from "#api/modules/planning/todo-imports/domain/todo-imports.constants";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

function copyOf(todoImport: TodoImport): TodoImport {
  return TodoImport.reconstitute(todoImport.toPrimitives());
}

function isActive(todoImport: TodoImport): boolean {
  return TODO_IMPORT_ACTIVE_STATUSES.some((status) => status === todoImport.status);
}

// Drizzle 저장소처럼 저장한 사본을 돌려주고 진행 중 가져오기는 사용자마다 하나만 받는다
export class InMemoryTodoImportRepository extends TodoImportRepositoryPort {
  readonly #imports = new Map<string, TodoImport>();
  saveCount = 0;

  constructor(imports: readonly TodoImport[] = []) {
    super();
    for (const todoImport of imports) {
      this.#imports.set(todoImport.id.value, copyOf(todoImport));
    }
  }

  get size(): number {
    return this.#imports.size;
  }

  async findByIdAndUserId(importId: TodoImportId, userId: UserId): Promise<TodoImport | null> {
    const found = await this.findById(importId);
    return found != null && found.userId.equals(userId) ? found : null;
  }

  async findById(importId: TodoImportId): Promise<TodoImport | null> {
    const found = this.#imports.get(importId.value);
    return found == null ? null : copyOf(found);
  }

  async findByIdempotencyKey(userId: UserId, idempotencyKey: string): Promise<TodoImport | null> {
    const found = [...this.#imports.values()].find(
      (todoImport) =>
        todoImport.userId.equals(userId) &&
        todoImport.toPrimitives().idempotencyKey === idempotencyKey,
    );
    return found == null ? null : copyOf(found);
  }

  async findActiveByUserId(userId: UserId): Promise<TodoImport | null> {
    const found = [...this.#imports.values()].find(
      (todoImport) => todoImport.userId.equals(userId) && isActive(todoImport),
    );
    return found == null ? null : copyOf(found);
  }

  async listStalled(query: StalledTodoImportQuery): Promise<TodoImport[]> {
    const stalled = [...this.#imports.values()].filter((todoImport) => {
      const { status, updatedAt } = todoImport.toPrimitives();
      return (
        query.statuses.includes(status) &&
        Temporal.Instant.compare(updatedAt, query.updatedBefore) < 0
      );
    });
    return orderBy(
      stalled,
      [
        (todoImport) => todoImport.toPrimitives().updatedAt.epochMilliseconds,
        (todoImport) => todoImport.id.value,
      ],
      ["asc", "asc"],
    )
      .slice(0, query.limit)
      .map(copyOf);
  }

  async save(todoImport: TodoImport): Promise<void> {
    const otherActive = [...this.#imports.values()].some(
      (stored) =>
        !stored.id.equals(todoImport.id) &&
        stored.userId.equals(todoImport.userId) &&
        isActive(stored),
    );
    if (isActive(todoImport) && otherActive) {
      throw todoImportAlreadyActiveConflict();
    }
    this.saveCount += 1;
    this.#imports.set(todoImport.id.value, copyOf(todoImport));
  }

  async deleteEndedBefore(cutoff: Temporal.Instant, limit: number): Promise<number> {
    const ended = [...this.#imports.values()]
      .filter((todoImport) => {
        const { status, updatedAt } = todoImport.toPrimitives();
        return (
          TODO_IMPORT_ENDED_STATUSES.includes(status) &&
          Temporal.Instant.compare(updatedAt, cutoff) < 0
        );
      })
      .slice(0, limit);
    for (const todoImport of ended) {
      this.#imports.delete(todoImport.id.value);
    }
    return ended.length;
  }
}
