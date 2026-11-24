import { Injectable } from "@nestjs/common";

import {
  type StagedTodoBatch,
  StagedTodoBatchCreatorPort,
  type StageTodoBatchInput,
} from "../../application/ports/staged-todo-batch-creator.port.js";
import { StageTodoBatchCreationUseCase } from "../../application/use-cases/stage-todo-batch-creation.use-case.js";

@Injectable()
export class StagedTodoBatchCreatorAdapter implements StagedTodoBatchCreatorPort {
  readonly #stageTodoBatchCreation: StageTodoBatchCreationUseCase;

  constructor(stageTodoBatchCreation: StageTodoBatchCreationUseCase) {
    this.#stageTodoBatchCreation = stageTodoBatchCreation;
  }

  stageMany(input: StageTodoBatchInput): Promise<StagedTodoBatch> {
    return this.#stageTodoBatchCreation.execute(input);
  }
}
