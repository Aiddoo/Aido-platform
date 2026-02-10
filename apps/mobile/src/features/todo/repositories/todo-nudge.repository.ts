import type { ApiError } from '@src/shared/errors/api-error';
import type { Result } from '@src/shared/errors/result';

export interface SendNudgeInput {
  receiverId: string;
  todoId: number;
  message?: string;
}

export interface SendNudgeResult {
  message: string;
}

export interface TodoNudgeRepository {
  sendNudge(input: SendNudgeInput): Promise<Result<SendNudgeResult, ApiError>>;
}
