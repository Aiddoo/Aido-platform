import type { FollowReaderPort } from "#api/modules/social/friends/social-friends.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { dailySendWindowAt } from "../../../shared/domain/daily-send-window.domain-service.js";
import { evaluateCheerCooldown } from "../../domain/cheer-cooldown.domain-service.js";
import { CheerMessage } from "../../domain/cheer-message.vo.js";
import { Cheer } from "../../domain/cheer.aggregate.js";
import {
  cannotCheerSelf,
  cheerCooldownActive,
  cheerDailyLimitReached,
  cheerTargetNotFriend,
} from "../cheers.errors.js";
import { CheerLockKeys } from "../cheers.lock-keys.js";
import { CheerLogEvent } from "../cheers.log-events.js";
import type { CheerCountCachePort } from "../ports/cheer-count-cache.port.js";
import type { CheerLimitReaderPort } from "../ports/cheer-limit.reader.port.js";
import type { CheerNotifierPort } from "../ports/cheer-notifier.port.js";
import type { CheerRepositoryPort } from "../ports/cheer.repository.port.js";

export interface SendCheerCommand {
  readonly senderId: string;
  readonly receiverId: string;
  readonly message?: string;
  readonly timezone: string;
}

export interface SendCheerDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly cheerRepository: Pick<
    CheerRepositoryPort,
    "nextId" | "countSentBetween" | "findLastSent" | "save"
  >;
  readonly limitReader: Pick<CheerLimitReaderPort, "readLimitInTx" | "readFeatureQuotaInTx">;
  readonly followReader: Pick<FollowReaderPort, "isMutualFriend" | "getUserDisplayName">;
  readonly notifier: CheerNotifierPort;
  readonly countCache: Pick<CheerCountCachePort, "invalidate">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class SendCheerUseCase {
  readonly #dependencies: SendCheerDependencies;

  constructor(dependencies: SendCheerDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: SendCheerCommand): Promise<Cheer> {
    const {
      unitOfWork,
      mutationLock,
      cheerRepository,
      limitReader,
      followReader,
      notifier,
      clock,
      logger,
    } = this.#dependencies;
    const senderId = UserId.reconstitute(command.senderId);
    const receiverId = UserId.reconstitute(command.receiverId);

    // 자기 자신 → 친구 아님 → 메시지 → 일간 한도 → 쿨다운 순서는 출시 앱이 받는 오류 우선순위다
    if (senderId.equals(receiverId)) {
      throw cannotCheerSelf();
    }
    if (!(await followReader.isMutualFriend(senderId, receiverId))) {
      throw cheerTargetNotFriend(receiverId);
    }
    const message = command.message == null ? null : CheerMessage.create(command.message);
    // 잠금을 기다리다 자정을 넘겨도 요청 시각의 하루와 생성 시각을 쓴다
    const requestedAt = clock.now();
    const window = dailySendWindowAt({ now: requestedAt, timeZone: command.timezone });

    const { cheer, senderName } = await unitOfWork.run(async () => {
      await mutationLock.acquire([
        CheerLockKeys.dailyQuota(senderId),
        CheerLockKeys.cooldown(senderId, receiverId),
      ]);

      const dailyLimit = await limitReader.readLimitInTx(senderId);
      const used = await cheerRepository.countSentBetween(senderId, window);
      if (dailyLimit != null && used >= dailyLimit) {
        throw cheerDailyLimitReached(
          await limitReader.readFeatureQuotaInTx(senderId, { used, resetsAt: window.endsAt }),
        );
      }

      const lastCheer = await cheerRepository.findLastSent(senderId, receiverId);
      const cooldown = evaluateCheerCooldown({
        lastSentAt: lastCheer?.createdAt ?? null,
        now: clock.now(),
      });
      if (cooldown.isActive) {
        throw cheerCooldownActive(receiverId, cooldown.remainingSeconds);
      }

      const created = Cheer.create({
        id: await cheerRepository.nextId(),
        senderId,
        receiverId,
        message,
        now: requestedAt,
      });
      await cheerRepository.save(created);
      return { cheer: created, senderName: await followReader.getUserDisplayName(senderId) };
    });

    await this.#dependencies.countCache.invalidate([senderId, receiverId]);
    logger.log({
      event: CheerLogEvent.SENT,
      cheerId: cheer.id.value,
      senderId: senderId.value,
      receiverId: receiverId.value,
    });
    notifier.notifyCheerSent({
      cheerId: cheer.id.value,
      senderId: senderId.value,
      receiverId: receiverId.value,
      senderName,
      message: message?.value,
    });
    return cheer;
  }
}
