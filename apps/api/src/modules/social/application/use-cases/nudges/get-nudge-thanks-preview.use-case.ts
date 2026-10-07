import { ErrorCode } from "@aido/api/errors";

import type { FollowReaderPort } from "#api/modules/social/social-friends.public";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type { NudgeThanksPreviewResult } from "../../models/nudges/nudge-interaction.models.js";
import { type NudgeInteractionConfigPort } from "../../ports/nudges/nudge-interaction.config.port.js";
import { type NudgeRepositoryPort } from "../../ports/nudges/nudge.repository.port.js";

export interface GetNudgeThanksPreviewInput {
  readonly userId: string;
  readonly todoId: number;
  readonly limit?: number;
  readonly cursor?: number;
  readonly throughNudgeId?: number;
}

interface GetNudgeThanksPreviewDependencies {
  readonly nudgeRepository: Pick<
    NudgeRepositoryPort,
    | "findInteractionById"
    | "findInteractionTodo"
    | "findLastReceivedNudgeId"
    | "findThanksCandidatePage"
    | "findThanksCandidates"
  >;
  readonly nudgeInteractionConfig: NudgeInteractionConfigPort;
  readonly followReader: Pick<FollowReaderPort, "getCurrentMutualFriendIds">;
}

export class GetNudgeThanksPreview {
  readonly #dependencies: GetNudgeThanksPreviewDependencies;

  constructor(dependencies: GetNudgeThanksPreviewDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetNudgeThanksPreviewInput): Promise<NudgeThanksPreviewResult> {
    if (!this.#dependencies.nudgeInteractionConfig.isEnabled) {
      throw new ApplicationException(ErrorCode.NUDGE_1105);
    }
    const todo = await this.#dependencies.nudgeRepository.findInteractionTodo(
      input.todoId,
      input.userId,
    );
    if (todo === null) {
      throw new ApplicationException(ErrorCode.TODO_0801);
    }
    if (!todo.completed) {
      throw new ApplicationException(ErrorCode.NUDGE_1110);
    }

    if (input.throughNudgeId !== undefined) {
      const cutoff = await this.#dependencies.nudgeRepository.findInteractionById(
        input.throughNudgeId,
        input.userId,
      );
      if (cutoff === null || cutoff.todoId !== input.todoId || cutoff.receiverId !== input.userId) {
        throw new ApplicationException(ErrorCode.NUDGE_1105);
      }
    }
    const throughNudgeId =
      input.throughNudgeId ??
      (await this.#dependencies.nudgeRepository.findLastReceivedNudgeId(
        input.todoId,
        input.userId,
      ));
    if (throughNudgeId === null || todo.visibility !== "PUBLIC") {
      return {
        todoId: input.todoId,
        throughNudgeId,
        recipients: [],
        totalRecipients: 0,
        nextCursor: null,
        hasNext: false,
      };
    }
    const friendIds = await this.#dependencies.followReader.getCurrentMutualFriendIds(input.userId);
    if (input.limit !== undefined) {
      const page = await this.#dependencies.nudgeRepository.findThanksCandidatePage({
        userId: input.userId,
        todoId: input.todoId,
        throughNudgeId,
        friendIds,
        cursor: input.cursor,
        size: input.limit,
      });
      return {
        todoId: input.todoId,
        throughNudgeId,
        recipients: page.items.map((nudge) => nudge.sender),
        totalRecipients: page.totalRecipients,
        nextCursor: page.nextCursor,
        hasNext: page.hasNext,
      };
    }
    const candidates = await this.#dependencies.nudgeRepository.findThanksCandidates({
      ...input,
      throughNudgeId,
      friendIds,
    });

    return {
      todoId: input.todoId,
      throughNudgeId,
      recipients: candidates.map((nudge) => nudge.sender),
    };
  }
}
