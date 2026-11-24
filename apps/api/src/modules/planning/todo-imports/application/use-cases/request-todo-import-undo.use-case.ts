import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoImportId } from "../../domain/todo-import-id.vo.js";
import type { TodoImportUndoQueuePort } from "../ports/todo-import-undo-queue.port.js";
import type { TodoImportRepositoryPort } from "../ports/todo-import.repository.port.js";
import {
  toTodoImportReadModel,
  type TodoImportReadModel,
} from "../read-models/todo-import.read-model.js";
import { todoImportAlreadyActive, todoImportNotFound } from "../todo-imports.errors.js";
import { TodoImportLockKeys } from "../todo-imports.lock-keys.js";
import { TodoImportLogEvent } from "../todo-imports.log-events.js";

export interface RequestTodoImportUndoCommand {
  readonly userId: string;
  readonly importId: string;
}

interface RequestTodoImportUndoDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly todoImportRepository: Pick<
    TodoImportRepositoryPort,
    "findByIdAndUserId" | "findActiveByUserId" | "save"
  >;
  readonly undoQueue: Pick<TodoImportUndoQueuePort, "enqueue">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/**
 * 끝난 뒤 정해진 기간 안이면 되돌리기 작업을 같은 트랜잭션에 넣는다. 이미 되돌리는 중이면 지금 상태를 주고,
 * 다른 가져오기가 진행 중이면 그 id로 2301이다
 */
export class RequestTodoImportUndoUseCase {
  readonly #dependencies: RequestTodoImportUndoDependencies;

  constructor(dependencies: RequestTodoImportUndoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: RequestTodoImportUndoCommand): Promise<TodoImportReadModel> {
    const { unitOfWork, mutationLock, todoImportRepository, undoQueue, clock, logger } =
      this.#dependencies;
    const userId = UserId.reconstitute(command.userId);
    const importId = TodoImportId.reconstitute(command.importId);
    const now = clock.now();
    const { todoImport, isRequested } = await unitOfWork.run(async () => {
      await mutationLock.acquire([TodoImportLockKeys.userImports(userId)]);
      const found = await todoImportRepository.findByIdAndUserId(importId, userId);
      if (found == null) {
        throw todoImportNotFound(importId);
      }
      if (!found.requestUndo(now)) {
        return { todoImport: found, isRequested: false };
      }
      // 진행 중 가져오기를 만드는 시작·되돌리기가 모두 같은 잠금을 쥐어 부분 유니크 위반까지 가지 않는다
      const active = await todoImportRepository.findActiveByUserId(userId);
      if (active != null) {
        throw todoImportAlreadyActive(active.id);
      }
      await todoImportRepository.save(found);
      await undoQueue.enqueue({ importId, round: found.round, afterTodoId: null });
      return { todoImport: found, isRequested: true };
    });
    if (isRequested) {
      logger.log({
        event: TodoImportLogEvent.UNDO_REQUESTED,
        importId: importId.value,
        userId: userId.value,
      });
    }
    return toTodoImportReadModel(todoImport, now);
  }
}
