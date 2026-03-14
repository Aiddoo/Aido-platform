import {
  type CreateNudgeResponse,
  type CreateRemindNudgeResponse,
  createNudgeResponseSchema,
  createRemindNudgeResponseSchema,
  type NudgeCooldownInfo as NudgeCooldownInfoDTO,
  type NudgeLimitInfo as NudgeLimitInfoDTO,
  nudgeCooldownInfoSchema,
  nudgeLimitInfoSchema,
} from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { err, ok, type Result } from '@src/shared/errors/result';

import { type TodoNudgeError, TodoNudgeErrors } from '../models/todo-nudge.error';
import type {
  NudgeCooldownInfo,
  NudgeLimitInfo,
  SendRemindNudgeInput,
  SendTodoNudgeInput,
  SendTodoNudgeResult,
} from '../models/todo-nudge.model';
import { TodoNudgePolicy } from '../models/todo-nudge.model';
import {
  toNudgeCooldownInfo,
  toNudgeLimitInfo,
  toSendNudgeResult,
  toSendRemindNudgeResult,
} from './todo-nudge.mapper';

export type TodoNudgeServiceError = ApiError | TodoNudgeError;

export class TodoNudgeService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  sendNudge = async (
    input: SendTodoNudgeInput,
  ): Promise<Result<SendTodoNudgeResult, TodoNudgeServiceError>> => {
    const normalizedMessage = TodoNudgePolicy.normalizeMessage(input.message);

    if (TodoNudgePolicy.isMessageTooLong(normalizedMessage)) {
      return err(TodoNudgeErrors.messageTooLong(TodoNudgePolicy.maxMessageLength));
    }

    const result = await this.#httpClient.post<CreateNudgeResponse>('v1/nudges', {
      receiverId: input.receiverId,
      todoId: input.todoId,
      message: normalizedMessage,
    });

    if (!result.ok) {
      return result;
    }

    const parsed = createNudgeResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoNudgeService] Invalid sendNudge response: ${parsed.error.message}`,
      );
    }

    return ok(toSendNudgeResult(parsed.data));
  };

  getLimitInfo = async (): Promise<Result<NudgeLimitInfo, ApiError>> => {
    const result = await this.#httpClient.get<NudgeLimitInfoDTO>('v1/nudges/limit');

    if (!result.ok) {
      return result;
    }

    const parsed = nudgeLimitInfoSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoNudgeService] Invalid getLimitInfo response: ${parsed.error.message}`,
      );
    }

    return ok(toNudgeLimitInfo(parsed.data));
  };

  getCooldownInfoForUser = async (userId: string): Promise<Result<NudgeCooldownInfo, ApiError>> => {
    const result = await this.#httpClient.get<NudgeCooldownInfoDTO>(`v1/nudges/cooldown/${userId}`);

    if (!result.ok) {
      return result;
    }

    const parsed = nudgeCooldownInfoSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoNudgeService] Invalid getCooldownInfo response: ${parsed.error.message}`,
      );
    }

    return ok(toNudgeCooldownInfo(parsed.data));
  };

  sendRemindNudge = async (
    input: SendRemindNudgeInput,
  ): Promise<Result<SendTodoNudgeResult, TodoNudgeServiceError>> => {
    const normalizedMessage = TodoNudgePolicy.normalizeMessage(input.message);

    if (TodoNudgePolicy.isMessageTooLong(normalizedMessage)) {
      return err(TodoNudgeErrors.messageTooLong(TodoNudgePolicy.maxMessageLength));
    }

    const result = await this.#httpClient.post<CreateRemindNudgeResponse>('v1/nudges/remind', {
      receiverId: input.receiverId,
      message: normalizedMessage,
    });

    if (!result.ok) {
      return result;
    }

    const parsed = createRemindNudgeResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoNudgeService] Invalid sendRemindNudge response: ${parsed.error.message}`,
      );
    }

    return ok(toSendRemindNudgeResult(parsed.data));
  };

  getRemindCooldownInfo = async (userId: string): Promise<Result<NudgeCooldownInfo, ApiError>> => {
    const result = await this.#httpClient.get<NudgeCooldownInfoDTO>(
      `v1/nudges/remind/cooldown/${userId}`,
    );

    if (!result.ok) {
      return result;
    }

    const parsed = nudgeCooldownInfoSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoNudgeService] Invalid getRemindCooldownInfo response: ${parsed.error.message}`,
      );
    }

    return ok(toNudgeCooldownInfo(parsed.data));
  };
}
