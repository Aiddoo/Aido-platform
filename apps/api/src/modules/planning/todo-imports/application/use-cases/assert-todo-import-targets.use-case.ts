import type { EntitlementReaderPort } from "#api/modules/access/feature-grants/access-feature-grants.public";
import type {
  TodoCategoryCreatorPort,
  TodoCategoryReaderPort,
} from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoImportTarget } from "../../domain/todo-import-target.vo.js";
import {
  todoImportCategoryLimitReached,
  todoImportTargetsRejected,
  type TodoImportTargetRejection,
} from "../todo-imports.errors.js";

export interface AssertTodoImportTargetsCommand {
  readonly userId: UserId;
  readonly targets: readonly TodoImportTarget[];
}

interface OwnedCategory {
  readonly id: number;
  readonly name: string;
}

interface AssertTodoImportTargetsDependencies {
  readonly categoryReader: Pick<TodoCategoryReaderPort, "listForUser">;
  readonly categoryCreator: Pick<TodoCategoryCreatorPort, "assertDraftsValid">;
  readonly entitlementReader: Pick<
    EntitlementReaderPort,
    "findFeatureLimitInTransaction" | "getFeatureQuotaInTransaction"
  >;
}

/**
 * 시작과 확정이 같은 규칙으로 대상 카테고리를 확인한다. 새 카테고리 이름·색은 카테고리 만들기와 같은 규칙으로
 * 먼저 거르고(업로드를 다 받은 뒤 확정에서 실패하지 않게), 새 카테고리 수가 한도를 넘으면 같은 0857이고, 이름 중복·없는 카테고리는 대상마다 모아 2303 하나로 알린다. 카테고리 자리는 막지 않고 할 일을
 * 만드는 작업이 가까운 날짜부터 남는 만큼만 만든다
 */
export class AssertTodoImportTargetsUseCase {
  readonly #dependencies: AssertTodoImportTargetsDependencies;

  constructor(dependencies: AssertTodoImportTargetsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: AssertTodoImportTargetsCommand): Promise<void> {
    const { userId, targets } = command;
    this.#dependencies.categoryCreator.assertDraftsValid(
      targets.flatMap((target) =>
        target.value.kind === "NEW_CATEGORY" && target.categoryId == null ? [target.value] : [],
      ),
    );
    const categories = await this.#dependencies.categoryReader.listForUser(userId);
    const newCategoryCount = targets.filter(isUncreatedCategory).length;
    await this.#assertCategoryCountWithinLimit(userId, categories.length, newCategoryCount);
    const rejections = findPlacementRejections(targets, categories);
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
