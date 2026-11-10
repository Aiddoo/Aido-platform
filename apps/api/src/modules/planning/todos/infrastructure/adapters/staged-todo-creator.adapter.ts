import { Injectable } from "@nestjs/common";

import {
  type CreateTodoData,
  type StagedTodoCreation,
  StagedTodoCreatorPort,
} from "../../application/ports/staged-todo-creator.port.js";
import { StageTodoCreationUseCase } from "../../application/use-cases/stage-todo-creation.use-case.js";

@Injectable()
export class StagedTodoCreatorAdapter implements StagedTodoCreatorPort {
  readonly #stageTodoCreation: StageTodoCreationUseCase;

  constructor(stageTodoCreation: StageTodoCreationUseCase) {
    this.#stageTodoCreation = stageTodoCreation;
  }

  stage(input: CreateTodoData): Promise<StagedTodoCreation> {
    return this.#stageTodoCreation.execute(input);
  }
}
