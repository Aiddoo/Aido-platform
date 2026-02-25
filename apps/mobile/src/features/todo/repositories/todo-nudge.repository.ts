import type { ApiError } from '@src/shared/errors/api-error';
import type { Result } from '@src/shared/errors/result';
import type {
  NudgeCooldownInfo,
  NudgeLimitInfo,
  SendTodoNudgeInput,
  SendTodoNudgeResult,
} from '../models/todo-nudge.model';

export interface TodoNudgeRepository {
  sendNudge(input: SendTodoNudgeInput): Promise<Result<SendTodoNudgeResult, ApiError>>;
  getLimitInfo(): Promise<Result<NudgeLimitInfo, ApiError>>;
  getCooldownInfoForUser(userId: string): Promise<Result<NudgeCooldownInfo, ApiError>>;
}
