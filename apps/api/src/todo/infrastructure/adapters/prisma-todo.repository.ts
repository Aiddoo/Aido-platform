import { Injectable } from "@nestjs/common";

import type {
  TodoRepositoryPort,
  TodoUpdatePatch,
} from "../../application/ports/todo.repository.port.js";
import { TodoItem } from "../../domain/entities/todo-item.entity.js";
import {
  Todo,
  type TodoCreationPlan,
  type TodoVisibility,
} from "../../domain/entities/todo.aggregate.js";
import { TodoId } from "../../domain/value-objects/todo-id.vo.js";
import {
  TodoSchedule,
  type TodoScheduleProps,
} from "../../domain/value-objects/todo-schedule.vo.js";
import { TodoRowRepository } from "../persistence/todo-row.repository.js";
import type { TodoAggregateRow } from "../persistence/todo-row.types.js";

/**
 * Prisma Todo 쓰기 어댑터
 *
 * TodoRepositoryPort 구현체. 행 기반 TodoRowRepository의 쿼리를 재사용하되,
 * 행 ↔ 도메인 애그리게잇 매핑(toDomain/toPersistence)을 이 어댑터가 소유합니다.
 * 활성 트랜잭션은 TodoRowRepository가 CLS에서 직접 읽습니다.
 */
@Injectable()
export class PrismaTodoRepository implements TodoRepositoryPort {
  constructor(private readonly todoRepository: TodoRowRepository) {}

  /** DB 행 → 도메인 애그리게잇 (순수 도메인 상태와 하위 항목만 복원) */
  private static toDomain(row: TodoAggregateRow): Todo {
    return Todo.reconstitute({
      id: TodoId.create(row.id),
      userId: row.userId,
      title: row.title,
      categoryId: row.categoryId,
      sortOrder: row.sortOrder,
      completed: row.completed,
      completedAt: row.completedAt,
      // 복원은 불변식 재검증 없음 (가드 도입 이전 데이터 보호)
      schedule: TodoSchedule.reconstitute({
        startDate: row.startDate,
        endDate: row.endDate,
        scheduledTime: row.scheduledTime,
        isAllDay: row.isAllDay,
      }),
      visibility: row.visibility,
      recurrenceGroupId: row.recurrenceGroupId,
      items: row.items.map((item) =>
        TodoItem.reconstitute({
          id: item.id,
          title: item.title,
          completed: item.completed,
          sortOrder: item.sortOrder,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        }),
      ),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async findByIdAndUserId(id: number, userId: string): Promise<Todo | null> {
    const row = await this.todoRepository.findByIdAndUserId(id, userId);
    return row === null ? null : PrismaTodoRepository.toDomain(row);
  }

  async create(data: TodoCreationPlan): Promise<Todo> {
    const row = await this.todoRepository.create({
      userId: data.userId,
      categoryId: data.categoryId,
      title: data.title,
      sortOrder: data.sortOrder,
      startDate: data.startDate,
      endDate: data.endDate,
      scheduledTime: data.scheduledTime,
      isAllDay: data.isAllDay,
      visibility: data.visibility,
    });
    return PrismaTodoRepository.toDomain(row);
  }

  async createInlineItems(todoId: number, items: { title: string }[]): Promise<void> {
    await this.todoRepository.createManyItems(todoId, items);
  }

  async updateCompletion(id: number, completed: boolean, completedAt: Date | null): Promise<void> {
    await this.todoRepository.update(id, { completed, completedAt });
  }

  async updateDetails(id: number, patch: TodoUpdatePatch): Promise<void> {
    // 인프라 경계에서 날짜와 문자열 codec을 변환한다.
    await this.todoRepository.update(id, patch);
  }

  async updateTitle(id: number, title: string): Promise<void> {
    await this.todoRepository.update(id, { title });
  }

  async updateVisibility(id: number, visibility: TodoVisibility): Promise<void> {
    await this.todoRepository.update(id, { visibility });
  }

  async updateSchedule(id: number, schedule: TodoScheduleProps): Promise<void> {
    await this.todoRepository.update(id, {
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      scheduledTime: schedule.scheduledTime,
      isAllDay: schedule.isAllDay,
    });
  }

  async updateCategory(id: number, categoryId: number): Promise<void> {
    await this.todoRepository.update(id, {
      categoryId,
    });
  }

  async delete(id: number): Promise<void> {
    await this.todoRepository.delete(id);
  }

  async updateSortOrder(id: number, sortOrder: number): Promise<void> {
    await this.todoRepository.updateSortOrder(id, sortOrder);
  }

  async shiftSortOrders(
    userId: string,
    from: number,
    to: number | null,
    delta: number,
  ): Promise<void> {
    await this.todoRepository.shiftSortOrders(userId, from, to, delta);
  }

  async createMany(items: TodoCreationPlan[], recurrenceGroupId: string): Promise<Todo[]> {
    const rows = await this.todoRepository.createManyBatch(
      items.map((item) => ({
        userId: item.userId,
        categoryId: item.categoryId,
        title: item.title,
        sortOrder: item.sortOrder,
        startDate: item.startDate,
        endDate: item.endDate,
        scheduledTime: item.scheduledTime,
        isAllDay: item.isAllDay,
        visibility: item.visibility,
        recurrenceGroupId,
      })),
      recurrenceGroupId,
    );
    return rows.map((row) => PrismaTodoRepository.toDomain(row));
  }

  countActiveByCategory(userId: string, categoryId: number): Promise<number> {
    return this.todoRepository.countActiveByCategory(userId, categoryId);
  }

  getMaxSortOrder(userId: string): Promise<number> {
    return this.todoRepository.getMaxSortOrder(userId);
  }

  // ===== 하위 항목 (체크리스트) =====

  async createItem(todoId: number, data: { title: string; sortOrder: number }): Promise<void> {
    await this.todoRepository.createItem(todoId, data);
  }

  async updateItem(itemId: number, data: { title?: string; completed?: boolean }): Promise<void> {
    await this.todoRepository.updateItem(itemId, data);
  }

  async deleteItem(itemId: number): Promise<void> {
    await this.todoRepository.deleteItem(itemId);
  }

  async reorderItems(itemIds: number[]): Promise<void> {
    await this.todoRepository.reorderItems(itemIds);
  }
}
