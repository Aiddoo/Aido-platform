import { TODO_LIMITS } from "@aido/api/vocabulary";

import type { EntitlementReaderPort } from "#api/modules/access/feature-grants/access-feature-grants.public";
import {
  TodoCategoryId,
  type TodoCategoryReaderPort,
} from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import type { TodoCategoryUsageReaderPort } from "#api/modules/planning/todos/planning-todos.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { planTargetCapacity } from "../../domain/todo-import-capacity.domain-service.js";
import type { TodoImportCollection } from "../../domain/todo-import-collection.vo.js";
import type { TodoImportTarget } from "../../domain/todo-import-target.vo.js";
import {
  todoImportCategoryLimitReached,
  todoImportTargetsRejected,
  type TodoImportTargetRejection,
} from "../todo-imports.errors.js";

export interface AssertTodoImportTargetsCommand {
  readonly userId: UserId;
  readonly targets: readonly TodoImportTarget[];
  readonly collections: readonly TodoImportCollection[];
}

interface OwnedCategory {
  readonly id: number;
  readonly name: string;
}

interface AssertTodoImportTargetsDependencies {
  readonly categoryReader: Pick<TodoCategoryReaderPort, "listForUser">;
  readonly categoryUsageReader: Pick<TodoCategoryUsageReaderPort, "countUsages">;
  readonly entitlementReader: Pick<
    EntitlementReaderPort,
    "findFeatureLimitInTransaction" | "getFeatureQuotaInTransaction"
  >;
}

/**
 * 시작과 확정이 같은 규칙으로 대상 카테고리를 확인한다. 새 카테고리 수가 한도를 넘으면 카테고리 만들기와 같은
 * 0857이고, 그 밖의 거절(이름 중복·없는 카테고리·자리 부족)은 대상마다 모아 2303 하나로 알린다.
 */
export class AssertTodoImportTargetsUseCase {
  readonly #dependencies: AssertTodoImportTargetsDependencies;

  constructor(dependencies: AssertTodoImportTargetsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: AssertTodoImportTargetsCommand): Promise<void> {
    const { userId, targets } = command;
    const categories = await this.#dependencies.categoryReader.listForUser(userId);
    const newCategoryCount = targets.filter(isUncreatedCategory).length;
    await this.#assertCategoryCountWithinLimit(userId, categories.length, newCategoryCount);
    const placementRejections = findPlacementRejections(targets, categories);
    const rejectedKeys = new Set(placementRejections.map((rejection) => rejection.targetKey));
    const capacityRejections = await this.#findCapacityRejections(
      command,
      targets.filter((target) => !rejectedKeys.has(target.targetKey)),
    );
    const rejections = [...placementRejections, ...capacityRejections];
    if (rejections.length > 0) {
      throw todoImportTargetsRejected(rejections);
    }
  }

  async #assertCategoryCountWithinLimit(
    userId: UserId,
    categoryCount: number,
    addedCount: number,
  ): Promise<void> {
    if (addedCount === 0) {
      return;
    }
    const { entitlementReader } = this.#dependencies;
    const limit = await entitlementReader.findFeatureLimitInTransaction(userId, "TODO_CATEGORY");
    if (limit == null || categoryCount + addedCount <= limit) {
      return;
    }
    throw todoImportCategoryLimitReached(
      await entitlementReader.getFeatureQuotaInTransaction(userId, "TODO_CATEGORY", {
        used: categoryCount,
        resetsAt: null,
      }),
    );
  }

  async #findCapacityRejections(
    command: AssertTodoImportTargetsCommand,
    targets: readonly TodoImportTarget[],
  ): Promise<TodoImportTargetRejection[]> {
    const categoryIds = targets.flatMap((target) =>
      target.categoryId == null ? [] : [TodoCategoryId.reconstitute(target.categoryId)],
    );
    const usageByCategory =
      categoryIds.length === 0
        ? new Map<number, number>()
        : await this.#dependencies.categoryUsageReader.countUsages(command.userId, categoryIds);
    return planTargetCapacity({
      targets,
      collections: command.collections,
      usageByCategory,
      limitPerCategory: TODO_LIMITS.MAX_PER_CATEGORY,
    }).map((shortage) => ({ ...shortage, reason: "CAPACITY" }));
  }
}

function isUncreatedCategory(target: TodoImportTarget): boolean {
  return target.value.kind === "NEW_CATEGORY" && target.categoryId == null;
}

function findPlacementRejections(
  targets: readonly TodoImportTarget[],
  categories: readonly OwnedCategory[],
): TodoImportTargetRejection[] {
  const ownedIds = new Set(categories.map((category) => category.id));
  const takenNames = new Set(categories.map((category) => category.name));
  return targets.flatMap((target): TodoImportTargetRejection[] => {
    const { value } = target;
    if (value.kind === "NEW_CATEGORY" && value.categoryId == null) {
      if (takenNames.has(value.name)) {
        return [{ targetKey: target.targetKey, reason: "CATEGORY_NAME_TAKEN" }];
      }
      takenNames.add(value.name);
      return [];
    }
    if (value.categoryId == null || !ownedIds.has(value.categoryId)) {
      return [{ targetKey: target.targetKey, reason: "CATEGORY_NOT_FOUND" }];
    }
    return [];
  });
}
