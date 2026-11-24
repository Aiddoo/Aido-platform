import { orderBy } from "es-toolkit";

import { TodoImportItemRepositoryPort } from "#api/modules/planning/todo-imports/application/ports/todo-import-item.repository.port";
import type { TodoImportId } from "#api/modules/planning/todo-imports/domain/todo-import-id.vo";
import type { TodoImportItem } from "#api/modules/planning/todo-imports/domain/todo-import-item.vo";
import type {
  TodoImportItemOutcome,
  TodoImportItemStatus,
} from "#api/modules/planning/todo-imports/domain/todo-imports.constants";

interface StoredItem {
  readonly importId: string;
  readonly item: TodoImportItem;
  status: TodoImportItemStatus;
}

// 끝난 가져오기 판단은 저장소마다 테이블을 함께 보므로, 대역은 끝난 시각을 테스트가 직접 알려 준다
export class InMemoryTodoImportItemRepository extends TodoImportItemRepositoryPort {
  readonly #items = new Map<string, StoredItem>();
  readonly endedAtByImport = new Map<string, Temporal.Instant>();

  statusesOf(importId: TodoImportId): ReadonlyMap<string, TodoImportItemStatus> {
    return new Map(
      [...this.#items.values()]
        .filter((stored) => stored.importId === importId.value)
        .map((stored) => [stored.item.sourceKey, stored.status]),
    );
  }

  async insertMany(importId: TodoImportId, items: readonly TodoImportItem[]): Promise<number> {
    let inserted = 0;
    for (const item of items) {
      const key = `${importId.value}:${item.sourceKey}`;
      if (!this.#items.has(key)) {
        this.#items.set(key, { importId: importId.value, item, status: "PENDING" });
        inserted += 1;
      }
    }
    return inserted;
  }

  async listPending(importId: TodoImportId, limit: number): Promise<TodoImportItem[]> {
    const pending = [...this.#items.values()].filter(
      (stored) => stored.importId === importId.value && stored.status === "PENDING",
    );
    // PostgreSQL ASC처럼 시각 없는 일정(null)은 같은 날짜의 뒤에 둔다
    return orderBy(
      pending,
      [
        (stored) => stored.item.startDate.toString(),
        (stored) => stored.item.value.localTime ?? "~",
        (stored) => stored.item.sourceKey,
      ],
      ["asc", "asc", "asc"],
    )
      .slice(0, limit)
      .map((stored) => stored.item);
  }

  async markOutcomes(
    importId: TodoImportId,
    outcomes: ReadonlyMap<string, TodoImportItemOutcome>,
  ): Promise<void> {
    for (const [sourceKey, outcome] of outcomes) {
      const stored = this.#items.get(`${importId.value}:${sourceKey}`);
      if (stored != null) {
        stored.status = outcome;
      }
    }
  }

  async deleteByImportId(importId: TodoImportId): Promise<void> {
    for (const [key, stored] of this.#items) {
      if (stored.importId === importId.value) {
        this.#items.delete(key);
      }
    }
  }

  async deleteOfImportsEndedBefore(cutoff: Temporal.Instant, limit: number): Promise<number> {
    const expired = [...this.#items.entries()]
      .filter(([, stored]) => {
        const endedAt = this.endedAtByImport.get(stored.importId);
        return endedAt != null && Temporal.Instant.compare(endedAt, cutoff) < 0;
      })
      .slice(0, limit);
    for (const [key] of expired) {
      this.#items.delete(key);
    }
    return expired.length;
  }
}
