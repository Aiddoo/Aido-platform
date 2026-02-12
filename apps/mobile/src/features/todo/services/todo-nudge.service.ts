import type { ApiError } from '@src/shared/errors/api-error';
import { err, type Result } from '@src/shared/errors/result';

import { type TodoNudgeError, TodoNudgeErrors } from '../models/todo-nudge.error';
import type { NudgeCooldownInfo, NudgeLimitInfo } from '../models/todo-nudge.model';
import { TodoNudgePolicy } from '../models/todo-nudge.model';
import type {
  SendNudgeInput,
  SendNudgeResult,
  TodoNudgeRepository,
} from '../repositories/todo-nudge.repository';

export type TodoNudgeServiceError = ApiError | TodoNudgeError;

export class TodoNudgeService {
  readonly #repository: TodoNudgeRepository;

  constructor(repository: TodoNudgeRepository) {
    this.#repository = repository;
  }

  sendNudge = async (
    input: SendNudgeInput,
  ): Promise<Result<SendNudgeResult, TodoNudgeServiceError>> => {
    const normalizedMessage = TodoNudgePolicy.normalizeMessage(input.message);

    if (TodoNudgePolicy.isMessageTooLong(normalizedMessage)) {
      return err(TodoNudgeErrors.messageTooLong(TodoNudgePolicy.maxMessageLength));
    }

    return this.#repository.sendNudge({
      ...input,
      message: normalizedMessage,
    });
  };

  getLimitInfo = async (): Promise<Result<NudgeLimitInfo, ApiError>> => {
    return this.#repository.getLimitInfo();
  };

  getCooldownInfoForUser = async (userId: string): Promise<Result<NudgeCooldownInfo, ApiError>> => {
    return this.#repository.getCooldownInfoForUser(userId);
  };
}
