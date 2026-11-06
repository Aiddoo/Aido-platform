import {
  createNudgeResponseSchema,
  createRemindNudgeResponseSchema,
  type GetNudgeInteractionsQuery,
  type GetNudgeThanksPreviewQuery,
  nudgeCooldownInfoSchema,
  nudgeInteractionAvailabilityResponseSchema,
  nudgeInteractionResponseSchema,
  nudgeInteractionsResponseSchema,
  nudgeLimitInfoSchema,
  nudgeThanksPreviewResponseSchema,
  sendNudgeThanksResponseSchema,
} from '@aido/api';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { BusinessError } from '@src/shared/errors/business-error';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';
import { err, type Result } from '@src/shared/errors/result';

import { TODO_NUDGE_ERROR_CODE, type TodoNudgeErrorCode } from '../domains/todo-nudge.error';
import { TodoNudgePolicy } from '../domains/todo-nudge.model';
import type {
  NudgeInteraction,
  NudgeInteractionPage,
  NudgeThanksPreview,
} from '../schemas/nudge-interaction.schema';
import type {
  CreateNudgeInput,
  CreateRemindNudgeInput,
  ReplyToNudgeInput,
  SendNudgeThanksInput,
} from '../schemas/nudge-request.schema';
import type {
  NudgeCooldownInfo,
  NudgeLimitInfo,
  SendTodoNudgeResult,
} from '../schemas/todo-nudge.schema';
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

export type TodoNudgeServiceError = ApiError | BusinessError<TodoNudgeErrorCode>;

export class TodoNudgeService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  sendNudge = async (
    input: CreateNudgeInput,
  ): Promise<Result<SendTodoNudgeResult, TodoNudgeServiceError>> => {
    const normalizedMessage = TodoNudgePolicy.normalizeMessage(input.message);

    if (TodoNudgePolicy.isMessageTooLong(normalizedMessage)) {
      return err(new BusinessError(TODO_NUDGE_ERROR_CODE.MESSAGE_TOO_LONG));
    }

    return parseApiResponse(
      await this.#httpClient.post('v1/nudges', {
        receiverId: input.receiverId,
        todoId: input.todoId,
        message: normalizedMessage,
      }),
      createNudgeResponseSchema,
      toSendNudgeResult,
      '[TodoNudgeService] Invalid sendNudge response',
    );
  };

  getLimitInfo = async (signal?: AbortSignal): Promise<Result<NudgeLimitInfo, ApiError>> =>
    parseApiResponse(
      await this.#httpClient.get('v1/nudges/limit', { signal }),
      nudgeLimitInfoSchema,
      toNudgeLimitInfo,
      '[TodoNudgeService] Invalid getLimitInfo response',
    );

  sendRemindNudge = async (
    input: CreateRemindNudgeInput,
  ): Promise<Result<SendTodoNudgeResult, TodoNudgeServiceError>> => {
    const normalizedMessage = TodoNudgePolicy.normalizeMessage(input.message);

    if (TodoNudgePolicy.isMessageTooLong(normalizedMessage)) {
      return err(new BusinessError(TODO_NUDGE_ERROR_CODE.MESSAGE_TOO_LONG));
    }

    return parseApiResponse(
      await this.#httpClient.post('v1/nudges/remind', {
        receiverId: input.receiverId,
        message: normalizedMessage,
      }),
      createRemindNudgeResponseSchema,
      toSendRemindNudgeResult,
      '[TodoNudgeService] Invalid sendRemindNudge response',
    );
  };

  getRemindCooldownInfo = async (
    userId: string,
    signal?: AbortSignal,
  ): Promise<Result<NudgeCooldownInfo, ApiError>> =>
    parseApiResponse(
      await this.#httpClient.get(`v1/nudges/remind/cooldown/${userId}`, { signal }),
      nudgeCooldownInfoSchema,
      toNudgeCooldownInfo,
      '[TodoNudgeService] Invalid getRemindCooldownInfo response',
    );

  getInteractionAvailability = async (signal?: AbortSignal): Promise<Result<boolean, ApiError>> =>
    parseApiResponse(
      await this.#httpClient.get('v1/nudges/interactions/availability', { signal }),
      nudgeInteractionAvailabilityResponseSchema,
      ({ enabled }) => enabled,
      '[TodoNudgeService] Invalid getInteractionAvailability response',
    );

  getInteractions = async (
    query: GetNudgeInteractionsQuery,
    signal?: AbortSignal,
  ): Promise<Result<NudgeInteractionPage, ApiError>> =>
    parseApiResponse(
      await this.#httpClient.get('v1/nudges/interactions', { params: query, signal }),
      nudgeInteractionsResponseSchema,
      toNudgeInteractionPage,
      '[TodoNudgeService] Invalid getInteractions response',
    );

  getInteraction = async (
    nudgeId: number,
    signal?: AbortSignal,
  ): Promise<Result<NudgeInteraction, ApiError>> =>
    parseApiResponse(
      await this.#httpClient.get(`v1/nudges/${nudgeId}/interaction`, { signal }),
      nudgeInteractionResponseSchema,
      toNudgeInteraction,
      '[TodoNudgeService] Invalid getInteraction response',
    );

  replyToNudge = async (
    nudgeId: number,
    input: ReplyToNudgeInput,
  ): Promise<Result<NudgeInteraction, ApiError>> =>
    parseApiResponse(
      await this.#httpClient.put(`v1/nudges/${nudgeId}/reply`, input),
      nudgeInteractionResponseSchema,
      toNudgeInteraction,
      '[TodoNudgeService] Invalid replyToNudge response',
    );

  getThanksPreview = async (
    todoId: number,
    query: GetNudgeThanksPreviewQuery = {},
    signal?: AbortSignal,
  ): Promise<Result<NudgeThanksPreview, ApiError>> =>
    parseApiResponse(
      await this.#httpClient.get(`v1/nudges/todos/${todoId}/thanks`, {
        params: query,
        signal,
      }),
      nudgeThanksPreviewResponseSchema,
      toNudgeThanksPreview,
      '[TodoNudgeService] Invalid getThanksPreview response',
    );

  sendThanks = async (
    todoId: number,
    input: SendNudgeThanksInput,
  ): Promise<Result<number, ApiError>> =>
    parseApiResponse(
      await this.#httpClient.put(`v1/nudges/todos/${todoId}/thanks`, input),
      sendNudgeThanksResponseSchema,
      ({ sentCount }) => sentCount,
      '[TodoNudgeService] Invalid sendThanks response',
    );
}
