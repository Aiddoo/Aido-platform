import {
  type CreateNudgeResponse,
  createNudgeResponseSchema,
  type NudgeCooldownInfo as NudgeCooldownInfoDTO,
  type NudgeLimitInfo as NudgeLimitInfoDTO,
  nudgeCooldownInfoSchema,
  nudgeLimitInfoSchema,
} from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import type {
  NudgeCooldownInfo,
  NudgeLimitInfo,
  SendTodoNudgeInput,
  SendTodoNudgeResult,
} from '../models/todo-nudge.model';
import { toNudgeCooldownInfo, toNudgeLimitInfo, toSendNudgeResult } from './todo-nudge.mapper';
import type { TodoNudgeRepository } from './todo-nudge.repository';

export class TodoNudgeRepositoryImpl implements TodoNudgeRepository {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  async sendNudge(input: SendTodoNudgeInput): Promise<Result<SendTodoNudgeResult, ApiError>> {
    const result = await this.#httpClient.post<CreateNudgeResponse>('v1/nudges', {
      receiverId: input.receiverId,
      todoId: input.todoId,
      message: input.message,
    });

    if (!result.ok) return result;

    const parsed = createNudgeResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoNudgeRepository] Invalid sendNudge response: ${parsed.error.message}`,
      );
    }

    return ok(toSendNudgeResult(parsed.data));
  }

  async getLimitInfo(): Promise<Result<NudgeLimitInfo, ApiError>> {
    const result = await this.#httpClient.get<NudgeLimitInfoDTO>('v1/nudges/limit');

    if (!result.ok) return result;

    const parsed = nudgeLimitInfoSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoNudgeRepository] Invalid getLimitInfo response: ${parsed.error.message}`,
      );
    }

    return ok(toNudgeLimitInfo(parsed.data));
  }

  async getCooldownInfoForUser(userId: string): Promise<Result<NudgeCooldownInfo, ApiError>> {
    const result = await this.#httpClient.get<NudgeCooldownInfoDTO>(`v1/nudges/cooldown/${userId}`);

    if (!result.ok) return result;

    const parsed = nudgeCooldownInfoSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoNudgeRepository] Invalid getCooldownInfo response: ${parsed.error.message}`,
      );
    }

    return ok(toNudgeCooldownInfo(parsed.data));
  }
}
