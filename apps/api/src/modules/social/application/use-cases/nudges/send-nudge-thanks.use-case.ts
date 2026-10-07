import { ErrorCode } from "@aido/api/errors";
import { chunk } from "es-toolkit";

import type { FollowReaderPort } from "#api/modules/social/social-friends.public";
import { type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { Nudge } from "../../../domain/aggregates/nudges/nudge.aggregate.js";
import { type NudgeInteractionConfigPort } from "../../ports/nudges/nudge-interaction.config.port.js";
import {
  type NudgeInteractionNotification,
  type NudgeNotifierPort,
} from "../../ports/nudges/nudge-notifier.port.js";
import { type NudgeRepositoryPort } from "../../ports/nudges/nudge.repository.port.js";

export interface SendNudgeThanksInput {
  readonly userId: string;
  readonly todoId: number;
  readonly throughNudgeId: number;
}

export interface SendNudgeThanksResult {
  sentCount: number;
}

const THANKS_BATCH_SIZE = 100;

interface SendNudgeThanksDependencies {
  readonly nudgeRepository: Pick<
    NudgeRepositoryPort,
    "findInteractionById" | "findThanksCandidates" | "lockInteractionTodo" | "saveThanksBatch"
  >;
  readonly nudgeInteractionConfig: NudgeInteractionConfigPort;
  readonly nudgeNotifier: Pick<NudgeNotifierPort, "recordInteractions">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly followReader: Pick<FollowReaderPort, "getCurrentMutualFriendIds">;
}

export class SendNudgeThanks {
  readonly #dependencies: SendNudgeThanksDependencies;

  constructor(dependencies: SendNudgeThanksDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendNudgeThanksInput): Promise<SendNudgeThanksResult> {
    if (!this.#dependencies.nudgeInteractionConfig.isEnabled) {
      throw new ApplicationException(ErrorCode.NUDGE_1105);
    }

    return this.#dependencies.unitOfWork.run(async () => {
      const todo = await this.#dependencies.nudgeRepository.lockInteractionTodo(
        input.todoId,
        input.userId,
      );
      if (todo === null) {
        throw new ApplicationException(ErrorCode.TODO_0801);
      }
      if (!todo.completed) {
        throw new ApplicationException(ErrorCode.NUDGE_1110);
      }
      if (todo.visibility !== "PUBLIC") {
        throw new ApplicationException(ErrorCode.NUDGE_1109);
      }

      const cutoffNudge = await this.#dependencies.nudgeRepository.findInteractionById(
        input.throughNudgeId,
        input.userId,
      );
      if (
        cutoffNudge === null ||
        cutoffNudge.receiverId !== input.userId ||
        cutoffNudge.todoId !== input.todoId
      ) {
        throw new ApplicationException(ErrorCode.NUDGE_1105);
      }
      const friendIds = await this.#dependencies.followReader.getCurrentMutualFriendIds(
        input.userId,
      );
      const candidates = await this.#dependencies.nudgeRepository.findThanksCandidates({
        ...input,
        friendIds,
      });
      const thankedAt = now();
      let sentCount = 0;

      for (const records of chunk(candidates, THANKS_BATCH_SIZE)) {
        const changed = records.flatMap((record) => {
          const nudge = Nudge.reconstitute(record);
          return nudge.markThanked(thankedAt) ? [{ nudge, record }] : [];
        });
        if (changed.length === 0) continue;
        await this.#dependencies.nudgeRepository.saveThanksBatch(
          changed.map(({ nudge }) => nudge.id),
          thankedAt,
        );
        await this.#dependencies.nudgeNotifier.recordInteractions(
          changed.map<NudgeInteractionNotification>(({ nudge, record }) => ({
            kind: "thanks",
            nudgeId: nudge.id,
            todoId: todo.id,
            actorId: input.userId,
            recipientId: nudge.senderId,
            actorName: record.receiver.profile?.name ?? record.receiver.userTag,
            todoTitle: todo.title,
          })),
        );
        sentCount += changed.length;
      }

      return { sentCount };
    });
  }
}
