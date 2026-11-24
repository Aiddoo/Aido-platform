import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { TODO_IMPORT_RETENTION } from "../../domain/todo-imports.constants.js";
import type { TodoImportItemRepositoryPort } from "../ports/todo-import-item.repository.port.js";
import type { TodoImportRepositoryPort } from "../ports/todo-import.repository.port.js";
import { TodoImportLogEvent } from "../todo-imports.log-events.js";

export interface PurgedTodoImports {
  readonly itemCount: number;
  readonly importCount: number;
}

interface PurgeTodoImportsDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly todoImportRepository: Pick<TodoImportRepositoryPort, "deleteEndedBefore">;
  readonly itemRepository: Pick<TodoImportItemRepositoryPort, "deleteOfImportsEndedBefore">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/**
 * 끝난 가져오기의 임시 일정(제목 포함)은 7일, 가져오기 기록은 30일 뒤에 지운다. 500개씩 지우고 다 지울 때까지
 * 되풀이해 한 문장이 테이블을 오래 잠그지 않는다. 링크는 할 일이 남아 있는 동안 중복 확인에 쓰여 남긴다
 */
export class PurgeTodoImportsUseCase {
  readonly #dependencies: PurgeTodoImportsDependencies;

  constructor(dependencies: PurgeTodoImportsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<PurgedTodoImports> {
    const { todoImportRepository, itemRepository, clock, logger } = this.#dependencies;
    const now = clock.now();
    const itemCount = await this.#deleteInBatches((limit) =>
      itemRepository.deleteOfImportsEndedBefore(
        now.subtract({ milliseconds: TODO_IMPORT_RETENTION.ITEMS_AFTER_END_MS }),
        limit,
      ),
    );
    const importCount = await this.#deleteInBatches((limit) =>
      todoImportRepository.deleteEndedBefore(
        now.subtract({ milliseconds: TODO_IMPORT_RETENTION.IMPORTS_AFTER_END_MS }),
        limit,
      ),
    );
    logger.log({ event: TodoImportLogEvent.PURGED, itemCount, importCount });
    return { itemCount, importCount };
  }

  async #deleteInBatches(deleteBatch: (limit: number) => Promise<number>): Promise<number> {
    const limit = TODO_IMPORT_RETENTION.PURGE_BATCH_SIZE;
    let total = 0;
    for (;;) {
      const deleted = await this.#dependencies.unitOfWork.run(() => deleteBatch(limit));
      total += deleted;
      if (deleted < limit) {
        return total;
      }
    }
  }
}
