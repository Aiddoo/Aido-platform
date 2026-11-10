import { randomUUID } from "node:crypto";

import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import {
  type DomainEventPublisherPort,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { CategoryChangedEvent } from "../../domain/category-changed.event.js";
import { TodoCategoryId } from "../../domain/todo-category-id.vo.js";
import type { TodoCategory } from "../../domain/todo-category.aggregate.js";
import { TodoCategoryLockKeys } from "../categories.lock-keys.js";
import { TodoCategoryLogEvent } from "../categories.log-events.js";
import { type TodoCategoryCachePort } from "../ports/todo-category-cache.port.js";
import { type TodoCategoryRepositoryPort } from "../ports/todo-category.repository.port.js";

interface UpdateTodoCategoryData {
  name?: string;
  color?: string;
}

export interface UpdateTodoCategoryInput {
  readonly id: number;
  readonly userId: string;
  readonly data: UpdateTodoCategoryData;
}

interface UpdateTodoCategoryDependencies {
  readonly repository: Pick<
    TodoCategoryRepositoryPort,
    "findByIdAndUserId" | "existsByUserIdAndName" | "update"
  >;
  readonly cache: TodoCategoryCachePort;
  readonly mutationLock: MutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly clock: ClockPort;
  readonly eventPublisher: DomainEventPublisherPort;
  readonly logger: ApplicationLoggerPort;
}

export class UpdateTodoCategoryUseCase {
  readonly #dependencies: UpdateTodoCategoryDependencies;

  constructor(dependencies: UpdateTodoCategoryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateTodoCategoryInput): Promise<TodoCategory> {
    const { id, data } = input;
    const userId = UserId.reconstitute(input.userId);
    const categoryId = TodoCategoryId.reconstitute(id);
    const updated = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        TodoCategoryLockKeys.userCategories(input.userId),
      ]);
      const category = await this.#dependencies.repository.findByIdAndUserId(categoryId, userId);
      if (category == null) {
        throw new ApplicationException(ErrorCode.TODO_CATEGORY_0851, {
          categoryId: id,
        });
      }

      if (data.name != null && data.name !== category.name.value) {
        const duplicate = await this.#dependencies.repository.existsByUserIdAndName(
          userId,
          data.name,
          categoryId,
        );
        if (duplicate) {
          throw new ApplicationException(ErrorCode.TODO_CATEGORY_0853, {
            name: data.name,
          });
        }
      }

      const now = this.#dependencies.clock.now();
      if (!category.updateDetails(data, now)) {
        return category;
      }
      const updated = await this.#dependencies.repository.update(categoryId, {
        name: data.name == null ? undefined : category.name.value,
        color: data.color == null ? undefined : category.color.value,
      });
      await this.#dependencies.eventPublisher.publish([
        new CategoryChangedEvent({
          eventName: "planning.todo-category.updated",
          eventId: randomUUID(),
          occurredAt: now,
          categoryId: id,
          userId: input.userId,
        }),
      ]);
      return updated;
    });

    await this.#dependencies.cache.invalidate(userId);
    this.#dependencies.logger.debug({
      event: TodoCategoryLogEvent.UPDATED,
      userId: input.userId,
      categoryId: id,
    });
    return updated;
  }
}
