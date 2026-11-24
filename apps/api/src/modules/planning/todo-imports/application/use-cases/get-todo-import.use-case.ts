import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoImportId } from "../../domain/todo-import-id.vo.js";
import type { TodoImportRepositoryPort } from "../ports/todo-import.repository.port.js";
import {
  toTodoImportReadModel,
  type TodoImportReadModel,
} from "../read-models/todo-import.read-model.js";
import { todoImportNotFound } from "../todo-imports.errors.js";

export interface GetTodoImportQuery {
  readonly userId: string;
  readonly importId: string;
}

interface GetTodoImportDependencies {
  readonly todoImportRepository: Pick<TodoImportRepositoryPort, "findByIdAndUserId">;
  readonly clock: ClockPort;
}

/** 진행·결과 조회. 남의 가져오기는 없는 것과 같이 2304다 */
export class GetTodoImportUseCase {
  readonly #dependencies: GetTodoImportDependencies;

  constructor(dependencies: GetTodoImportDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetTodoImportQuery): Promise<TodoImportReadModel> {
    const importId = TodoImportId.reconstitute(query.importId);
    const todoImport = await this.#dependencies.todoImportRepository.findByIdAndUserId(
      importId,
      UserId.reconstitute(query.userId),
    );
    if (todoImport == null) {
      throw todoImportNotFound(importId);
    }
    return toTodoImportReadModel(todoImport, this.#dependencies.clock.now());
  }
}
