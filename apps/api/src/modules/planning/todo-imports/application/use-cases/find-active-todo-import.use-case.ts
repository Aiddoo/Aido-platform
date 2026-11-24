import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoImportRepositoryPort } from "../ports/todo-import.repository.port.js";
import {
  toTodoImportReadModel,
  type TodoImportReadModel,
} from "../read-models/todo-import.read-model.js";

export interface FindActiveTodoImportQuery {
  readonly userId: string;
}

interface FindActiveTodoImportDependencies {
  readonly todoImportRepository: Pick<TodoImportRepositoryPort, "findActiveByUserId">;
  readonly clock: ClockPort;
}

/** 다른 기기·다시 연 앱이 이어 볼 진행 중 가져오기. 없으면 null이다 */
export class FindActiveTodoImportUseCase {
  readonly #dependencies: FindActiveTodoImportDependencies;

  constructor(dependencies: FindActiveTodoImportDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: FindActiveTodoImportQuery): Promise<TodoImportReadModel | null> {
    const todoImport = await this.#dependencies.todoImportRepository.findActiveByUserId(
      UserId.reconstitute(query.userId),
    );
    return todoImport == null
      ? null
      : toTodoImportReadModel(todoImport, this.#dependencies.clock.now());
  }
}
