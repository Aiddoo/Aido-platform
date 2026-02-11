import type { ApiError } from '@src/shared/errors/api-error';
import type { Result } from '@src/shared/errors/result';
import type { NudgeCooldownInfo, NudgeLimitInfo } from '../models/todo-nudge.model';

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
  getLimitInfo(): Promise<Result<NudgeLimitInfo, ApiError>>;
  getCooldownInfoForUser(userId: string): Promise<Result<NudgeCooldownInfo, ApiError>>;
}
