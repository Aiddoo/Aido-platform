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
  sendNudgeThanksResponseSchema,
} from '@aido/api';
import type { ApiError } from '@src/core/errors/api-error';
import { err, type Result } from '@src/core/errors/result';
import type { HttpClient } from '@src/core/ports/http-client';
import { BusinessError } from '@src/shared/errors';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import type {
  NudgeInteraction,
  NudgeInteractionPage,
  NudgeThanksPreview,
} from '../domains/nudge-interaction.model';
import { TODO_NUDGE_ERROR_CODE, type TodoNudgeErrorCode } from '../domains/todo-nudge.error';
import {
  isMessageTooLong,
  normalizeMessage,
  type NudgeCooldownInfo,
  type NudgeLimitInfo,
  type SendTodoNudgeResult,
} from '../domains/todo-nudge.model';
import type {
  CreateNudgeInput,
  CreateRemindNudgeInput,
  ReplyToNudgeInput,
  SendNudgeThanksInput,
} from '../schemas/nudge-request.schema';
import { nudgeThanksPreviewEnvelopeSchema } from '../schemas/nudge-response.schema';
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

export type TodoNudgeApiError = ApiError | BusinessError<TodoNudgeErrorCode>;

export class TodoNudgeApi {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  sendNudge = async (
    input: CreateNudgeInput,
  ): Promise<Result<SendTodoNudgeResult, TodoNudgeApiError>> => {
    if (isMessageTooLong(input)) {
      return err(new BusinessError(TODO_NUDGE_ERROR_CODE.MESSAGE_TOO_LONG));
    }

    return parseApiResponse(
      await this.#httpClient.post('v1/nudges', {
        receiverId: input.receiverId,
        todoId: input.todoId,
        message: normalizeMessage(input),
      }),
      createNudgeResponseSchema,
      toSendNudgeResult,
      '[TodoNudgeApi] Invalid sendNudge response',
    );
  };

  getLimitInfo = async (signal?: AbortSignal): Promise<Result<NudgeLimitInfo, ApiError>> =>
    parseApiResponse(
      await this.#httpClient.get('v1/nudges/limit', { signal }),
      nudgeLimitInfoSchema,
      toNudgeLimitInfo,
      '[TodoNudgeApi] Invalid getLimitInfo response',
    );

  sendRemindNudge = async (
    input: CreateRemindNudgeInput,
  ): Promise<Result<SendTodoNudgeResult, TodoNudgeApiError>> => {
    if (isMessageTooLong(input)) {
      return err(new BusinessError(TODO_NUDGE_ERROR_CODE.MESSAGE_TOO_LONG));
    }

    return parseApiResponse(
      await this.#httpClient.post('v1/nudges/remind', {
        receiverId: input.receiverId,
        message: normalizeMessage(input),
      }),
      createRemindNudgeResponseSchema,
      toSendRemindNudgeResult,
      '[TodoNudgeApi] Invalid sendRemindNudge response',
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
      '[TodoNudgeApi] Invalid getRemindCooldownInfo response',
    );

  getInteractionAvailability = async (signal?: AbortSignal): Promise<Result<boolean, ApiError>> =>
    parseApiResponse(
      await this.#httpClient.get('v1/nudges/interactions/availability', { signal }),
      nudgeInteractionAvailabilityResponseSchema,
      ({ enabled }) => enabled,
      '[TodoNudgeApi] Invalid getInteractionAvailability response',
    );

  getInteractions = async (
    query: GetNudgeInteractionsQuery,
    signal?: AbortSignal,
  ): Promise<Result<NudgeInteractionPage, ApiError>> =>
    parseApiResponse(
      await this.#httpClient.get('v1/nudges/interactions', { params: query, signal }),
      nudgeInteractionsResponseSchema,
      toNudgeInteractionPage,
      '[TodoNudgeApi] Invalid getInteractions response',
    );

  getInteraction = async (
    nudgeId: number,
    signal?: AbortSignal,
  ): Promise<Result<NudgeInteraction, ApiError>> =>
    parseApiResponse(
      await this.#httpClient.get(`v1/nudges/${nudgeId}/interaction`, { signal }),
      nudgeInteractionResponseSchema,
      toNudgeInteraction,
      '[TodoNudgeApi] Invalid getInteraction response',
    );

  replyToNudge = async (
    nudgeId: number,
    input: ReplyToNudgeInput,
  ): Promise<Result<NudgeInteraction, ApiError>> =>
    parseApiResponse(
      await this.#httpClient.put(`v1/nudges/${nudgeId}/reply`, input),
      nudgeInteractionResponseSchema,
      toNudgeInteraction,
      '[TodoNudgeApi] Invalid replyToNudge response',
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
      nudgeThanksPreviewEnvelopeSchema,
      toNudgeThanksPreview,
      '[TodoNudgeApi] Invalid getThanksPreview response',
    );

  sendThanks = async (
    todoId: number,
    input: SendNudgeThanksInput,
  ): Promise<Result<number, ApiError>> =>
    parseApiResponse(
      await this.#httpClient.put(`v1/nudges/todos/${todoId}/thanks`, input),
      sendNudgeThanksResponseSchema,
      ({ sentCount }) => sentCount,
      '[TodoNudgeApi] Invalid sendThanks response',
    );
}
