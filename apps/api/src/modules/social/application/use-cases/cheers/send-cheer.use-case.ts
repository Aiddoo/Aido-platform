import { ErrorCode } from "@aido/api/errors";

import type { FollowReaderPort } from "#api/modules/social/social-friends.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import { dayWindowInTimezone } from "#api/shared/domain/date/utils/timezone";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { evaluateCheerCooldown } from "../../../domain/policies/cheers/cheer-cooldown.policy.js";
import { CheerMessage } from "../../../domain/value-objects/cheers/cheer-message.vo.js";
import { CheerLogEvent } from "../../observability/cheers/cheer-log.events.js";
import { type CheerLimitReaderPort } from "../../ports/cheers/cheer-limit-reader.port.js";
import { type CheerNotifierPort } from "../../ports/cheers/cheer-notifier.port.js";
import {
  type CheerRepositoryPort,
  type CheerWithRelations,
} from "../../ports/cheers/cheer.repository.port.js";

export interface SendCheerInput {
  readonly senderId: string;
  readonly receiverId: string;
  readonly message?: string;
  readonly timezone: string;
}

interface SendCheerDependencies {
  readonly cheerRepository: Pick<
    CheerRepositoryPort,
    "countSentSince" | "createWithRelations" | "findLastCheerToUser"
  >;
  readonly notifier: Pick<CheerNotifierPort, "notifyCheerSent">;
  readonly limitReader: CheerLimitReaderPort;
  readonly mutationLock: MutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly followReader: Pick<FollowReaderPort, "isMutualFriend">;
  readonly logger: ApplicationLogger;
}

export class SendCheer {
  readonly #dependencies: SendCheerDependencies;

  constructor(dependencies: SendCheerDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendCheerInput): Promise<CheerWithRelations> {
    const { senderId, receiverId, message } = input;

    if (senderId === receiverId) {
      throw new ApplicationException(ErrorCode.CHEER_1204);
    }

    const isFriend = await this.#dependencies.followReader.isMutualFriend(senderId, receiverId);
    if (!isFriend) {
      throw new ApplicationException(ErrorCode.CHEER_1203, {
        targetUserId: receiverId,
      });
    }

    const cheerMessage = CheerMessage.of(message);
    const capturedAt = now();
    const quotaWindow = dayWindowInTimezone(capturedAt, input.timezone);

    const cheer = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        MutationLockKeys.cheerDailyQuota(senderId),
        MutationLockKeys.cheerCooldown(senderId, receiverId),
      ]);

      const dailyLimit = await this.#dependencies.limitReader.getDailyLimitInTx(senderId);
      const used = await this.#dependencies.cheerRepository.countSentSince(
        senderId,
        quotaWindow.startsAt,
        quotaWindow.endsAt,
      );
      if (dailyLimit !== null && used >= dailyLimit) {
        throw new ApplicationException(ErrorCode.CHEER_1201, {
          limit: dailyLimit,
        });
      }

      const lastCheer = await this.#dependencies.cheerRepository.findLastCheerToUser(
        senderId,
        receiverId,
      );
      if (lastCheer !== null) {
        const cooldown = evaluateCheerCooldown(lastCheer.createdAt);
        if (cooldown.isActive) {
          throw new ApplicationException(ErrorCode.CHEER_1202, {
            targetUserId: receiverId,
            remainingSeconds: cooldown.remainingSeconds,
          });
        }
      }

      return this.#dependencies.cheerRepository.createWithRelations({
        senderId,
        receiverId,
        message: cheerMessage.raw,
        createdAt: capturedAt,
      });
    });

    this.#dependencies.logger.log({
      event: CheerLogEvent.SENT,
      cheerId: cheer.id,
      senderId,
      receiverId,
    });

    const senderName = cheer.sender.profile?.name ?? cheer.sender.userTag;
    this.#dependencies.notifier.notifyCheerSent({
      cheerId: cheer.id,
      senderId,
      receiverId,
      senderName,
      message: cheerMessage.raw,
    });

    return cheer;
  }
}
