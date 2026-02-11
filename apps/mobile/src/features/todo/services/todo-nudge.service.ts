import type { ApiError } from '@src/shared/errors/api-error';
import type { Result } from '@src/shared/errors/result';

import type {
  SendNudgeInput,
  SendNudgeResult,
  TodoNudgeRepository,
} from '../repositories/todo-nudge.repository';

export class TodoNudgeService {
  readonly #repository: TodoNudgeRepository;

  constructor(repository: TodoNudgeRepository) {
    this.#repository = repository;
  }

  sendNudge = async (input: SendNudgeInput): Promise<Result<SendNudgeResult, ApiError>> => {
    return this.#repository.sendNudge(input);
  };
}
