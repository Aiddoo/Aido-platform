import { ErrorCode } from "@aido/api/errors";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { all, and } from "@prisma/orm-postgres/orm-client";

import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { databaseTimestamp, varchar } from "#api/platform/database/database-values";
import type * as PrismaModels from "#api/platform/database/database.types";
import {
  requireRecord,
  isUniqueConstraintViolation,
} from "#api/platform/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type {
  CreateCategoryInput,
  TodoCategoryRepositoryPort,
  TodoCategoryWithCountView,
  UpdateCategoryInput,
} from "../../../application/ports/categories/todo-category.repository.port.js";
import { TodoCategory } from "../../../domain/aggregates/categories/todo-category.aggregate.js";

type TodoCategoryRowWithCount = PrismaModels.TodoCategory & {
  todos: number;
};

/**
 * TodoCategoryRepositoryPort의 Prisma 어댑터.
 * 쓰기·단건은 TodoCategory 애그리게잇을, 개수 포함 읽기는 프로젝션을 반환한다.
 * 트랜잭션은 CLS(TransactionHost.tx)로 전파되며, 이름 유니크 위반(SQLSTATE 23505)은 TODO_CATEGORY_0853으로 번역한다.
 */
@Injectable()
export class PrismaTodoCategoryRepository implements TodoCategoryRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  private get client() {
    return this.txHost.tx;
  }

  private static toEntity(row: PrismaModels.TodoCategory): TodoCategory {
    return TodoCategory.reconstitute({
      id: row.id,
      userId: row.userId,
      name: row.name,
      color: row.color,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private static toView(row: TodoCategoryRowWithCount): TodoCategoryWithCountView {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      color: row.color,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      todoCount: row.todos,
    };
  }

  async create(input: CreateCategoryInput): Promise<TodoCategory> {
    try {
      const row = decodeRecord(
        "TodoCategory",
        await this.client.orm.public.TodoCategory.create(
          encodeCreate("TodoCategory", {
            userId: input.userId,
            name: input.name,
            color: input.color,
            sortOrder: input.sortOrder,
          }),
        ),
      );
      return PrismaTodoCategoryRepository.toEntity(row);
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ApplicationException(ErrorCode.TODO_CATEGORY_0853, {
          name: input.name,
        });
      }
      throw error;
    }
  }

  async update(id: number, input: UpdateCategoryInput): Promise<TodoCategory> {
    try {
      const row = decodeRecord(
        "TodoCategory",
        requireRecord(
          await this.client.orm.public.TodoCategory.where((row) => row.id.eq(id)).update(
            encodePatch("TodoCategory", {
              name: input.name,
              color: input.color,
              sortOrder: input.sortOrder,
            }),
          ),
        ),
      );
      return PrismaTodoCategoryRepository.toEntity(row);
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ApplicationException(ErrorCode.TODO_CATEGORY_0853, {
          name: input.name ?? "",
        });
      }
      throw error;
    }
  }

  async delete(id: number): Promise<void> {
    decodeRecord(
      "TodoCategory",
      requireRecord(
        await this.client.orm.public.TodoCategory.where((row) => row.id.eq(id)).delete(),
      ),
    );
  }

  async findByIdAndUserId(id: number, userId: string): Promise<TodoCategory | null> {
    const row = decodeRecord(
      "TodoCategory",
      await this.client.orm.public.TodoCategory.where((row) =>
        and(row.id.eq(id), row.userId.eq(userId)),
      ).first(),
    );
    return row === null ? null : PrismaTodoCategoryRepository.toEntity(row);
  }

  async findByIdWithCount(id: number): Promise<TodoCategoryWithCountView | null> {
    const row = decodeRecord(
      "TodoCategory",
      await this.client.orm.public.TodoCategory.where({ id })
        .include("todos", (todos) => todos.count())
        .first(),
    );
    return row === null ? null : PrismaTodoCategoryRepository.toView(row);
  }

  async findManyByUserId(userId: string): Promise<TodoCategoryWithCountView[]> {
    const rows = decodeRecord(
      "TodoCategory",
      await this.client.orm.public.TodoCategory.where({ userId })
        .include("todos", (todos) => todos.count())
        .orderBy((row) => row.sortOrder.asc())
        .all(),
    );
    return rows.map((row) => PrismaTodoCategoryRepository.toView(row));
  }

  async countByUserId(userId: string): Promise<number> {
    return this.client.orm.public.TodoCategory.where((row) => row.userId.eq(userId))
      .aggregate((aggregate) => ({ count: aggregate.count() }))
      .then(({ count }) => count);
  }

  async existsByUserIdAndName(userId: string, name: string, excludeId?: number): Promise<boolean> {
    const row = decodeRecord(
      "TodoCategory",
      await this.client.orm.public.TodoCategory.where((row) =>
        and(
          row.userId.eq(userId),
          row.name.eq(varchar(name, 50)),
          excludeId === undefined ? all() : row.id.neq(excludeId),
        ),
      ).first(),
    );
    return row !== null;
  }

  async getMaxSortOrder(userId: string): Promise<number> {
    const { maximum } = await this.client.orm.public.TodoCategory.where({ userId }).aggregate(
      (aggregate) => ({ maximum: aggregate.max("sortOrder") }),
    );
    return maximum ?? -1;
  }

  async shiftSortOrders(
    userId: string,
    fromSortOrder: number,
    toSortOrder: number | null,
    delta: number,
  ): Promise<number> {
    const plan = this.client.sql.public.TodoCategory.update((fields) => ({
      sortOrder: this.client.raw.sql`${fields.sortOrder} + ${delta}`.returns("pg/int4@1"),
      updatedAt: this.client.raw.sql`${databaseTimestamp(now())}`.returns("pg/timestamp-string@1"),
    }))
      .where((fields, functions) =>
        functions.and(
          functions.eq(fields.userId, userId),
          functions.gte(fields.sortOrder, fromSortOrder),
          toSortOrder === null
            ? this.client.raw.sql`TRUE`.returns("pg/bool@1")
            : functions.lte(fields.sortOrder, toSortOrder),
        ),
      )
      .build();
    return (await this.client.execute(plan)).affectedRows;
  }

  async getTodoCount(categoryId: number): Promise<number> {
    return this.client.orm.public.Todo.where((row) => row.categoryId.eq(categoryId))
      .aggregate((aggregate) => ({ count: aggregate.count() }))
      .then(({ count }) => count);
  }

  async moveTodosToCategory(fromCategoryId: number, toCategoryId: number): Promise<number> {
    return this.client.orm.public.Todo.where((row) =>
      row.categoryId.eq(fromCategoryId),
    ).updateAndCount(encodePatch("Todo", { categoryId: toCategoryId }));
  }
}
