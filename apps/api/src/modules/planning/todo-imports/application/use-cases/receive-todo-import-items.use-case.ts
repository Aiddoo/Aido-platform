import { TODO_IMPORT_LIMITS } from "@aido/api/vocabulary";

import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoImportId } from "../../domain/todo-import-id.vo.js";
import { TodoImportItem, type TodoImportItemPrimitives } from "../../domain/todo-import-item.vo.js";
import type { TodoImport } from "../../domain/todo-import.aggregate.js";
import { todoImportStatusConflict } from "../../domain/todo-imports.errors.js";
import type { TodoImportItemRepositoryPort } from "../ports/todo-import-item.repository.port.js";
import type { TodoImportRepositoryPort } from "../ports/todo-import.repository.port.js";
import {
  todoImportInvalid,
  todoImportNotFound,
  todoImportTooManyItems,
} from "../todo-imports.errors.js";
import { TodoImportLockKeys } from "../todo-imports.lock-keys.js";

export interface ReceiveTodoImportItemsCommand {
  readonly userId: string;
  readonly importId: string;
  readonly items: readonly TodoImportItemPrimitives[];
}

export interface ReceivedTodoImportItems {
  readonly acceptedCount: number;
  readonly receivedItemCount: number;
}

interface ReceiveTodoImportItemsDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly todoImportRepository: Pick<TodoImportRepositoryPort, "findByIdAndUserId" | "save">;
  readonly itemRepository: Pick<TodoImportItemRepositoryPort, "insertMany">;
  readonly clock: ClockPort;
}

/** 업로드 묶음 하나를 짧은 트랜잭션으로 받는다. 이미 받은 일정 키는 무시해 끊긴 업로드를 처음부터 다시 보내도 된다 */
export class ReceiveTodoImportItemsUseCase {
  readonly #dependencies: ReceiveTodoImportItemsDependencies;

  constructor(dependencies: ReceiveTodoImportItemsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: ReceiveTodoImportItemsCommand): Promise<ReceivedTodoImportItems> {
    const { unitOfWork, mutationLock, todoImportRepository, itemRepository, clock } =
      this.#dependencies;
    const userId = UserId.reconstitute(command.userId);
    const importId = TodoImportId.reconstitute(command.importId);
    return unitOfWork.run(async () => {
      await mutationLock.acquire([TodoImportLockKeys.userImports(userId)]);
      const todoImport = await todoImportRepository.findByIdAndUserId(importId, userId);
      if (todoImport == null) {
        throw todoImportNotFound(importId);
      }
      if (todoImport.status !== "UPLOADING") {
        throw todoImportStatusConflict(todoImport.status);
      }
      const items = command.items.map((item) => TodoImportItem.create(item));
      assertItemsBelongToImport(todoImport, items);
      const acceptedCount = await itemRepository.insertMany(importId, items);
      const receivedItemCount = todoImport.receivedItemCount + acceptedCount;
      if (receivedItemCount > TODO_IMPORT_LIMITS.MAX_ITEMS_PER_IMPORT) {
        throw todoImportTooManyItems(receivedItemCount);
      }
      if (todoImport.recordReceived(acceptedCount, clock.now())) {
        await todoImportRepository.save(todoImport);
      }
      return { acceptedCount, receivedItemCount };
    });
  }
}

function assertItemsBelongToImport(todoImport: TodoImport, items: readonly TodoImportItem[]): void {
  for (const [index, item] of items.entries()) {
    if (!todoImport.hasCollection(item.collectionKey)) {
      throw todoImportInvalid("UNKNOWN_COLLECTION", index);
    }
    if (!todoImport.coversDate(item.startDate)) {
      throw todoImportInvalid("ITEM_OUTSIDE_RANGE", index);
    }
  }
}
