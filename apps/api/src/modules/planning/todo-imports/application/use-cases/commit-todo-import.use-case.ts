import { zip } from "es-toolkit";

import type { EntitlementReaderPort } from "#api/modules/access/feature-grants/access-feature-grants.public";
import {
  TodoCategoryLockKeys,
  type TodoCategoryCreatorPort,
} from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import { TodoLockKeys } from "#api/modules/planning/todos/planning-todos.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { localDateIn } from "#api/shared/domain/time/timezone-name";

import { TodoImportId } from "../../domain/todo-import-id.vo.js";
import { judgeImportRange } from "../../domain/todo-import-range.domain-service.js";
import type { TodoImport } from "../../domain/todo-import.aggregate.js";
import { todoImportStatusConflict } from "../../domain/todo-imports.errors.js";
import type { TodoImportMaterializationQueuePort } from "../ports/todo-import-materialization-queue.port.js";
import type { TodoImportRepositoryPort } from "../ports/todo-import.repository.port.js";
import {
  toTodoImportReadModel,
  type TodoImportReadModel,
} from "../read-models/todo-import.read-model.js";
import { todoImportNotFound, todoImportRangeBeyondPlan } from "../todo-imports.errors.js";
import { TodoImportLockKeys } from "../todo-imports.lock-keys.js";
import { TodoImportLogEvent } from "../todo-imports.log-events.js";
import type { AssertTodoImportTargetsUseCase } from "./assert-todo-import-targets.use-case.js";

export interface CommitTodoImportCommand {
  readonly userId: string;
  readonly importId: string;
}

interface CommitTodoImportDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly todoImportRepository: Pick<TodoImportRepositoryPort, "findByIdAndUserId" | "save">;
  readonly entitlementReader: Pick<
    EntitlementReaderPort,
    "getHorizonDaysInTransaction" | "getFeatureQuotaInTransaction"
  >;
  readonly assertTargets: Pick<AssertTodoImportTargetsUseCase, "execute">;
  readonly categoryCreator: Pick<TodoCategoryCreatorPort, "createMany">;
  readonly materializationQueue: Pick<TodoImportMaterializationQueuePort, "enqueue">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/**
 * 업로드를 끝내고 할 일 만들기를 대기열에 올린다. 시작 검사를 다시 하고(그사이 구독이 끝났으면 2302)
 * 새 카테고리를 만든 뒤 같은 트랜잭션에서 round 0 작업을 넣는다. 이미 확정했으면 지금 상태를 그대로 준다
 */
export class CommitTodoImportUseCase {
  readonly #dependencies: CommitTodoImportDependencies;

  constructor(dependencies: CommitTodoImportDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: CommitTodoImportCommand): Promise<TodoImportReadModel> {
    const { unitOfWork, mutationLock, todoImportRepository, clock, logger } = this.#dependencies;
    const userId = UserId.reconstitute(command.userId);
    const importId = TodoImportId.reconstitute(command.importId);
    const { todoImport, isCommitted } = await unitOfWork.run(async () => {
      await mutationLock.acquire([TodoImportLockKeys.userImports(userId)]);
      await mutationLock.acquire([
        TodoCategoryLockKeys.userCategories(userId.value),
        TodoLockKeys.sortOrder(userId.value),
      ]);
      const found = await todoImportRepository.findByIdAndUserId(importId, userId);
      if (found == null) {
        throw todoImportNotFound(importId);
      }
      return { todoImport: found, isCommitted: await this.#commit(found) };
    });
    if (isCommitted) {
      logger.log({
        event: TodoImportLogEvent.COMMITTED,
        importId: importId.value,
        userId: userId.value,
        receivedItemCount: todoImport.receivedItemCount,
      });
    }
    return toTodoImportReadModel(todoImport, clock.now());
  }

  async #commit(todoImport: TodoImport): Promise<boolean> {
    if (todoImport.isCommitted()) {
      return false;
    }
    if (todoImport.status !== "UPLOADING") {
      throw todoImportStatusConflict(todoImport.status);
    }
    const { userId, targets, collections } = todoImport;
    await this.#assertRangeStillWithinPlan(todoImport);
    await this.#dependencies.assertTargets.execute({ userId, targets, collections });
    const newTargets = targets.flatMap((target) =>
      target.value.kind === "NEW_CATEGORY" && target.categoryId == null ? [target.value] : [],
    );
    const categoryIds = await this.#dependencies.categoryCreator.createMany(
      userId,
      newTargets.map(({ name, color }) => ({ name, color })),
    );
    const createdCategoryIds = new Map(
      zip(newTargets, categoryIds).map(([target, categoryId]) => [
        target.targetKey,
        categoryId.value,
      ]),
    );
    const isCommitted = todoImport.commit({
      createdCategoryIds,
      now: this.#dependencies.clock.now(),
    });
    await this.#dependencies.todoImportRepository.save(todoImport);
    await this.#dependencies.materializationQueue.enqueue(todoImport.id, todoImport.round);
    return isCommitted;
  }

  // 업로드가 자정을 넘겨도 확정은 막지 않는다. 그사이 바뀐 요금제 일 수만 다시 본다
  async #assertRangeStillWithinPlan(todoImport: TodoImport): Promise<void> {
    const { userId } = todoImport;
    const { entitlementReader, clock } = this.#dependencies;
    const { startDate, endDate } = todoImport.toPrimitives();
    const judgement = judgeImportRange({
      today: localDateIn(clock.now(), todoImport.timezone),
      startDate,
      endDate,
      horizonDays: await entitlementReader.getHorizonDaysInTransaction(userId, "CALENDAR_IMPORT"),
    });
    if (judgement.kind === "beyondHorizon") {
      throw todoImportRangeBeyondPlan(
        await entitlementReader.getFeatureQuotaInTransaction(userId, "CALENDAR_IMPORT", null),
      );
    }
  }
}
