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

import { evaluateCheerCooldown } from "../../../domain/services/cheers/cheer-cooldown.js";
import { CheerMessage } from "../../../domain/value-objects/cheers/cheer-message.vo.js";
import { type CheerLimitReaderPort } from "../../ports/cheers/cheer-limit-reader.port.js";
import { type CheerNotifierPort } from "../../ports/cheers/cheer-notifier.port.js";
import {
  type CheerRepositoryPort,
  type CheerWithRelations,
} from "../../ports/cheers/cheer.repository.port.js";

export interface SendCheerInput {
  senderId: string;
  receiverId: string;
  message?: string;
}

/**
 * 응원 보내기 use-case.
 *
 * 자기 자신 체크 → 친구 관계 확인 후, 트랜잭션 안에서 일일 한도·쿨다운을 검사하고 응원을 생성한다
 * (TOCTOU 방지). 생성 후 알림을 enqueue한다.
 */
interface SendCheerDependencies {
  readonly cheerRepository: CheerRepositoryPort;
  readonly notifier: CheerNotifierPort;
  readonly limitReader: CheerLimitReaderPort;
  readonly mutationLock: MutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly followReader: FollowReader;
  readonly logger: ApplicationLogger;
}

export class SendCheer {
  readonly #dependencies: SendCheerDependencies;

  constructor(dependencies: SendCheerDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendCheerInput, tz: string = "UTC"): Promise<CheerWithRelations> {
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
    const quotaWindow = dayWindowInTimezone(capturedAt, tz);

    const cheer = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        MutationLockKeys.cheerDaily(senderId, quotaWindow.localDate),
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
      if (lastCheer) {
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

    this.#dependencies.logger.log(`Cheer sent: senderId=${senderId}, receiverId=${receiverId}`);

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
