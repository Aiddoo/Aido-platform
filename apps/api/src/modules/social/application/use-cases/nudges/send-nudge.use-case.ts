import { ErrorCode } from "@aido/api/errors";

import type { FollowReader } from "#api/modules/social/social-friends.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import { dayWindowInTimezone } from "#api/shared/domain/date/utils/timezone";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { Nudge } from "../../../domain/aggregates/nudges/nudge.aggregate.js";
import { evaluateNudgeCooldown } from "../../../domain/services/nudges/nudge-cooldown.js";
import { NudgeMessage } from "../../../domain/value-objects/nudges/nudge-message.vo.js";
import { NudgeTargetTodo } from "../../../domain/value-objects/nudges/nudge-target-todo.vo.js";
import { type NudgeLimitReaderPort } from "../../ports/nudges/nudge-limit-reader.port.js";
import { type NudgeNotifierPort } from "../../ports/nudges/nudge-notifier.port.js";
import {
  type NudgeRepositoryPort,
  type NudgeWithRelations,
} from "../../ports/nudges/nudge.repository.port.js";

export interface SendNudgeInput {
  senderId: string;
  receiverId: string;
  todoId: number;
  message?: string;
}

/**
 * 콕 찌르기 보내기 use-case.
 *
 * 자기 자신 체크 → 친구 관계 확인 후, 트랜잭션 안에서 대상 할 일 검증(소유·공개·오늘)·일일 한도·
 * 쿨다운(동일 할 일 24시간)을 검사하고 콕 찌르기를 생성한다(TOCTOU 방지). 생성 후 알림을 enqueue한다.
 */
interface SendNudgeDependencies {
  readonly nudgeRepository: NudgeRepositoryPort;
  readonly notifier: NudgeNotifierPort;
  readonly limitReader: NudgeLimitReaderPort;
  readonly mutationLock: MutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly followReader: FollowReader;
  readonly logger: ApplicationLogger;
}

export class SendNudge {
  readonly #dependencies: SendNudgeDependencies;

  constructor(dependencies: SendNudgeDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendNudgeInput, tz: string = "UTC"): Promise<NudgeWithRelations> {
    const { senderId, receiverId, todoId, message } = input;

    if (senderId === receiverId) {
      throw new ApplicationException(ErrorCode.NUDGE_1104);
    }

    const isFriend = await this.#dependencies.followReader.isMutualFriend(senderId, receiverId);
    if (!isFriend) {
      throw new ApplicationException(ErrorCode.NUDGE_1103, {
        targetUserId: receiverId,
      });
    }

    const nudgeMessage = NudgeMessage.of(message);
    const capturedAt = now();
    const quotaWindow = dayWindowInTimezone(capturedAt, tz);

    const nudge = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        MutationLockKeys.nudgeDaily(senderId, quotaWindow.localDate),
        MutationLockKeys.nudgeCooldown(senderId, todoId),
      ]);

      const todoRow = await this.#dependencies.nudgeRepository.findTargetTodo(todoId);
      if (!todoRow) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
      }

      const target = NudgeTargetTodo.of(todoRow);
      if (!target.isOwnedBy(receiverId)) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
      }
      if (!target.isPublic()) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
      }

      if (!target.isActiveOn(quotaWindow.date)) {
        throw new ApplicationException(ErrorCode.NUDGE_1106, { todoId });
      }

      const dailyLimit = await this.#dependencies.limitReader.getDailyLimitInTx(senderId);
      const used = await this.#dependencies.nudgeRepository.countSentSince(
        senderId,
        quotaWindow.startsAt,
        quotaWindow.endsAt,
      );
      if (dailyLimit !== null && used >= dailyLimit) {
        throw new ApplicationException(ErrorCode.NUDGE_1101, {
          limit: dailyLimit,
        });
      }

      const lastNudge = await this.#dependencies.nudgeRepository.findLastNudgeForTodo(
        senderId,
        todoId,
      );
      if (lastNudge) {
        const cooldown = evaluateNudgeCooldown(lastNudge.createdAt);
        if (cooldown.isActive) {
          throw new ApplicationException(ErrorCode.NUDGE_1102, {
            targetUserId: receiverId,
            remainingSeconds: cooldown.remainingSeconds,
          });
        }
      }

      return this.#dependencies.nudgeRepository.createNudge(
        Nudge.planCreation({
          senderId,
          receiverId,
          todoId,
          message: nudgeMessage.raw,
          createdAt: capturedAt,
        }),
      );
    });

    this.#dependencies.logger.log(
      `Nudge sent: senderId=${senderId}, receiverId=${receiverId}, todoId=${todoId}`,
    );

    const senderName = nudge.sender.profile?.name ?? nudge.sender.userTag;
    this.#dependencies.notifier.notifyNudgeSent({
      nudgeId: nudge.id,
      senderId,
      receiverId,
      senderName,
      todoId,
      todoTitle: nudge.todo.title,
      message: nudgeMessage.raw,
    });

    return nudge;
  }
}
