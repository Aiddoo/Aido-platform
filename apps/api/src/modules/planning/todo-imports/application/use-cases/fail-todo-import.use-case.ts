import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { TodoImportId } from "../../domain/todo-import-id.vo.js";
import {
  TODO_IMPORT_WORKING_STATUSES,
  type TodoImportFailureReason,
} from "../../domain/todo-imports.constants.js";
import type { TodoImportRepositoryPort } from "../ports/todo-import.repository.port.js";
import { TodoImportLockKeys } from "../todo-imports.lock-keys.js";
import { TodoImportLogEvent } from "../todo-imports.log-events.js";

export interface FailTodoImportCommand {
  readonly importId: string;
  readonly reason: TodoImportFailureReason;
}

interface FailTodoImportDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly todoImportRepository: Pick<TodoImportRepositoryPort, "findById" | "save">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "warn">;
}

/** 재시도를 다 쓴 작업의 가져오기를 FAILED로 멈춘다. 만든 할 일과 센 수는 그대로 남는다. 이미 끝났으면 false다 */
export class FailTodoImportUseCase {
  readonly #dependencies: FailTodoImportDependencies;

  constructor(dependencies: FailTodoImportDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: FailTodoImportCommand): Promise<boolean> {
    const { unitOfWork, mutationLock, todoImportRepository, clock, logger } = this.#dependencies;
    const importId = TodoImportId.reconstitute(command.importId);
    const owner = await todoImportRepository.findById(importId);
    if (owner == null) {
      return false;
    }
    const isFailed = await unitOfWork.run(async () => {
      await mutationLock.acquire([TodoImportLockKeys.userImports(owner.userId)]);
      const todoImport = await todoImportRepository.findById(importId);
      const isWorking = TODO_IMPORT_WORKING_STATUSES.some(
        (status) => status === todoImport?.status,
      );
      if (todoImport == null || !isWorking || !todoImport.fail(command.reason, clock.now())) {
        return false;
      }
      await todoImportRepository.save(todoImport);
      return true;
    });
    if (isFailed) {
      logger.warn({
        event: TodoImportLogEvent.FAILED,
        importId: importId.value,
        userId: owner.userId.value,
        reason: command.reason,
      });
    }
    return isFailed;
  }
}
