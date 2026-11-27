import {
  createNudgeResponseSchema,
  createRemindNudgeResponseSchema,
  type GetNudgeInteractionsQuery,
  type GetNudgeThanksPreviewQuery,
  nudgeCooldownInfoSchema,
  nudgeInteractionAvailabilityResponseSchema,
  nudgeInteractionResponseSchema,
  nudgeInteractionsResponseSchema,
  sendNudgeThanksResponseSchema,
} from '@aido/api/contracts/nudge/v1';
import type { ApiError } from '@src/core/errors/api-error';
import type { Result } from '@src/core/errors/result';
import type { HttpClient } from '@src/core/ports/http-client';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import type { NudgeCooldown } from '../domains/nudge-cooldown.model';
import type { NudgeInteraction, NudgeInteractionPage } from '../domains/nudge-interaction.model';
import type { NudgeThanksPreview } from '../domains/nudge-thanks-preview.model';
import type { SendTodoNudgeResult } from '../domains/todo-nudge.model';
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
  toCreateNudgeRequest,
  toCreateRemindNudgeRequest,
  toNudgeCooldown,
  toSendNudgeResult,
  toSendRemindNudgeResult,
} from './todo-nudge.mapper';

export class TodoNudgeApi {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  // 메시지 길이는 콕 폼(nudgeFormSchema)이 계약 한도로 막는다
  sendNudge = async (input: CreateNudgeInput): Promise<Result<SendTodoNudgeResult, ApiError>> =>
    parseApiResponse(
      await this.#httpClient.post('v1/nudges', toCreateNudgeRequest(input)),
      createNudgeResponseSchema,
      toSendNudgeResult,
      '[TodoNudgeApi] Invalid sendNudge response',
    );

  sendRemindNudge = async (
    input: CreateRemindNudgeInput,
  ): Promise<Result<SendTodoNudgeResult, ApiError>> =>
    parseApiResponse(
      await this.#httpClient.post('v1/nudges/remind', toCreateRemindNudgeRequest(input)),
      createRemindNudgeResponseSchema,
      toSendRemindNudgeResult,
      '[TodoNudgeApi] Invalid sendRemindNudge response',
    );

  getRemindCooldownInfo = async (
    userId: string,
    signal?: AbortSignal,
  ): Promise<Result<NudgeCooldown, ApiError>> =>
    parseApiResponse(
      await this.#httpClient.get(`v1/nudges/remind/cooldown/${userId}`, { signal }),
      nudgeCooldownInfoSchema,
      toNudgeCooldown,
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
