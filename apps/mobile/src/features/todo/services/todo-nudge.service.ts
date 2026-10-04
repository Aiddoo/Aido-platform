import {
  createNudgeResponseSchema,
  type GetNudgeInteractionsQuery,
  nudgeInteractionAvailabilityResponseSchema,
  nudgeInteractionResponseSchema,
  nudgeInteractionsResponseSchema,
  nudgeThanksPreviewResponseSchema,
  type ReplyToNudgeInput,
  type SendNudgeThanksInput,
  sendNudgeThanksResponseSchema,
  createRemindNudgeResponseSchema,
  nudgeCooldownInfoSchema,
  nudgeLimitInfoSchema,
} from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { err, ok, type Result } from '@src/shared/errors/result';

import type {
  NudgeInteraction,
  NudgeInteractionPage,
  NudgeThanksPreview,
} from '../models/nudge-interaction.model';
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
  toNudgeInteraction,
  toNudgeInteractionPage,
  toNudgeThanksPreview,
} from './nudge-interaction.mapper';
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

    const result = await this.#httpClient.post('v1/nudges', {
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

  getLimitInfo = async (signal?: AbortSignal): Promise<Result<NudgeLimitInfo, ApiError>> => {
    const result = await this.#httpClient.get('v1/nudges/limit', { signal });

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

  getCooldownInfoForUser = async (
    userId: string,
    signal?: AbortSignal,
  ): Promise<Result<NudgeCooldownInfo, ApiError>> => {
    const result = await this.#httpClient.get(`v1/nudges/cooldown/${userId}`, { signal });

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

    const result = await this.#httpClient.post('v1/nudges/remind', {
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

  getRemindCooldownInfo = async (
    userId: string,
    signal?: AbortSignal,
  ): Promise<Result<NudgeCooldownInfo, ApiError>> => {
    const result = await this.#httpClient.get(`v1/nudges/remind/cooldown/${userId}`, { signal });

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

  getInteractionAvailability = async (signal?: AbortSignal): Promise<Result<boolean, ApiError>> => {
    const result = await this.#httpClient.get('v1/nudges/interactions/availability', { signal });
    if (!result.ok) {
      return result;
    }

    const parsed = nudgeInteractionAvailabilityResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoNudgeService] Invalid getInteractionAvailability response: ${parsed.error.message}`,
      );
    }

    return ok(parsed.data.enabled);
  };

  getInteractions = async (
    query: GetNudgeInteractionsQuery,
    signal?: AbortSignal,
  ): Promise<Result<NudgeInteractionPage, ApiError>> => {
    const result = await this.#httpClient.get('v1/nudges/interactions', { params: query, signal });
    if (!result.ok) {
      return result;
    }

    const parsed = nudgeInteractionsResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoNudgeService] Invalid getInteractions response: ${parsed.error.message}`,
      );
    }

    return ok(toNudgeInteractionPage(parsed.data));
  };

  getInteraction = async (
    nudgeId: number,
    signal?: AbortSignal,
  ): Promise<Result<NudgeInteraction, ApiError>> => {
    const result = await this.#httpClient.get(`v1/nudges/${nudgeId}/interaction`, { signal });
    if (!result.ok) {
      return result;
    }

    const parsed = nudgeInteractionResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoNudgeService] Invalid getInteraction response: ${parsed.error.message}`,
      );
    }

    return ok(toNudgeInteraction(parsed.data));
  };

  replyToNudge = async (
    nudgeId: number,
    input: ReplyToNudgeInput,
  ): Promise<Result<NudgeInteraction, ApiError>> => {
    const result = await this.#httpClient.put(`v1/nudges/${nudgeId}/reply`, input);
    if (!result.ok) {
      return result;
    }

    const parsed = nudgeInteractionResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoNudgeService] Invalid replyToNudge response: ${parsed.error.message}`,
      );
    }

    return ok(toNudgeInteraction(parsed.data));
  };

  getThanksPreview = async (
    todoId: number,
    signal?: AbortSignal,
  ): Promise<Result<NudgeThanksPreview, ApiError>> => {
    const result = await this.#httpClient.get(`v1/nudges/todos/${todoId}/thanks`, { signal });
    if (!result.ok) {
      return result;
    }

    const parsed = nudgeThanksPreviewResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoNudgeService] Invalid getThanksPreview response: ${parsed.error.message}`,
      );
    }

    return ok(toNudgeThanksPreview(parsed.data));
  };

  sendThanks = async (
    todoId: number,
    input: SendNudgeThanksInput,
  ): Promise<Result<number, ApiError>> => {
    const result = await this.#httpClient.put(`v1/nudges/todos/${todoId}/thanks`, input);
    if (!result.ok) {
      return result;
    }

    const parsed = sendNudgeThanksResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoNudgeService] Invalid sendThanks response: ${parsed.error.message}`,
      );
    }

    return ok(parsed.data.sentCount);
  };
}
