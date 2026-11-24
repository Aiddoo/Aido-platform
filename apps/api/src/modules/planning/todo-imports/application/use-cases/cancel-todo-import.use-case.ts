import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoImportId } from "../../domain/todo-import-id.vo.js";
import type { TodoImportItemRepositoryPort } from "../ports/todo-import-item.repository.port.js";
import type { TodoImportRepositoryPort } from "../ports/todo-import.repository.port.js";
import {
  toTodoImportReadModel,
  type TodoImportReadModel,
} from "../read-models/todo-import.read-model.js";
import { todoImportNotFound } from "../todo-imports.errors.js";
import { TodoImportLockKeys } from "../todo-imports.lock-keys.js";
import { TodoImportLogEvent } from "../todo-imports.log-events.js";

export interface CancelTodoImportCommand {
  readonly userId: string;
  readonly importId: string;
}

interface CancelTodoImportDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly todoImportRepository: Pick<TodoImportRepositoryPort, "findByIdAndUserId" | "save">;
  readonly itemRepository: Pick<TodoImportItemRepositoryPort, "deleteByImportId">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/** 확정 전 업로드만 멈춘다. 받아 둔 일정은 바로 지운다(가져오기 하나에 최대 3,000행) */
export class CancelTodoImportUseCase {
  readonly #dependencies: CancelTodoImportDependencies;

  constructor(dependencies: CancelTodoImportDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: CancelTodoImportCommand): Promise<TodoImportReadModel> {
    const { unitOfWork, mutationLock, todoImportRepository, itemRepository, clock, logger } =
      this.#dependencies;
    const userId = UserId.reconstitute(command.userId);
    const importId = TodoImportId.reconstitute(command.importId);
    const now = clock.now();
    const { todoImport, isCanceled } = await unitOfWork.run(async () => {
      await mutationLock.acquire([TodoImportLockKeys.userImports(userId)]);
      const found = await todoImportRepository.findByIdAndUserId(importId, userId);
      if (found == null) {
        throw todoImportNotFound(importId);
      }
      if (!found.cancel(now)) {
        return { todoImport: found, isCanceled: false };
      }
      await todoImportRepository.save(found);
      await itemRepository.deleteByImportId(importId);
      return { todoImport: found, isCanceled: true };
    });
    if (isCanceled) {
      logger.log({
        event: TodoImportLogEvent.CANCELED,
        importId: importId.value,
        userId: userId.value,
      });
    }
    return toTodoImportReadModel(todoImport, now);
  }
}
