import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { MutualFriendReaderPort } from "#api/modules/social/friendships/social-friendships.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  type DailySendWindow,
  dailySendWindowAt,
} from "../../../shared/domain/daily-send-window.domain-service.js";
import { NudgeMessage } from "../../../shared/domain/nudge-message.vo.js";
import { cannotNudgeSelf } from "../../../shared/domain/social.errors.js";
import { evaluateNudgeCooldown } from "../../domain/nudge-cooldown.domain-service.js";
import { Nudge } from "../../domain/nudge.aggregate.js";
import {
  nudgeCooldownActive,
  nudgeDailyLimitReached,
  nudgeTargetNotFriend,
  nudgeTodoNotActiveToday,
  nudgeTodoNotFound,
} from "../nudges.errors.js";
import { NudgeLockKeys } from "../nudges.lock-keys.js";
import { NudgeLogEvent } from "../nudges.log-events.js";
import type { NudgeCountCachePort } from "../ports/nudge-count-cache.port.js";
import type { NudgeLimitReaderPort } from "../ports/nudge-limit.reader.port.js";
import type { NudgeNotifierPort } from "../ports/nudge-notifier.port.js";
import type { NudgeRepositoryPort } from "../ports/nudge.repository.port.js";

export interface SendNudgeCommand {
  readonly senderId: string;
  readonly receiverId: string;
  readonly todoId: number;
  readonly message?: string;
  readonly timezone: string;
}

export interface SendNudgeDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly nudgeRepository: Pick<
    NudgeRepositoryPort,
    "nextId" | "countSentBetween" | "findLastSentForTodo" | "findTargetTodo" | "save"
  >;
  readonly limitReader: Pick<
    NudgeLimitReaderPort,
    "readLimitInTransaction" | "readFeatureQuotaInTransaction"
  >;
  readonly mutualFriendReader: Pick<
    MutualFriendReaderPort,
    "isMutualFriend" | "getUserDisplayName"
  >;
  readonly notifier: Pick<NudgeNotifierPort, "notifyNudgeSent">;
  readonly countCache: Pick<NudgeCountCachePort, "invalidate">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

// 잠금 안에서 확인하는 할 일·한도·쿨다운은 요청 시각의 하루로 센다
interface NudgeSendRequest {
  readonly senderId: UserId;
  readonly receiverId: UserId;
  readonly todoId: TodoId;
  readonly message: NudgeMessage | null;
  readonly requestedAt: Temporal.Instant;
  readonly window: DailySendWindow;
}

export class SendNudgeUseCase {
  readonly #dependencies: SendNudgeDependencies;

  constructor(dependencies: SendNudgeDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: SendNudgeCommand): Promise<Nudge> {
    const { unitOfWork, mutualFriendReader, countCache, clock, logger } = this.#dependencies;
    const senderId = UserId.reconstitute(command.senderId);
    const receiverId = UserId.reconstitute(command.receiverId);

    // 자기 자신 → 친구 아님 → 메시지 → 할 일 → 일간 한도 → 쿨다운 순서는 출시 앱이 받는 오류 우선순위다
    if (senderId.equals(receiverId)) {
      throw cannotNudgeSelf();
    }
    if (!(await mutualFriendReader.isMutualFriend(senderId, receiverId))) {
      throw nudgeTargetNotFriend(receiverId);
    }
    const message = command.message == null ? null : NudgeMessage.create(command.message);
    // 잠금을 기다리다 자정을 넘겨도 요청 시각의 하루와 생성 시각을 쓴다
    const requestedAt = clock.now();
    const request: NudgeSendRequest = {
      senderId,
      receiverId,
      todoId: TodoId.reconstitute(command.todoId),
      message,
      requestedAt,
      window: dailySendWindowAt({ now: requestedAt, timeZone: command.timezone }),
    };

    const nudge = await unitOfWork.run(() => this.#send(request));

    await countCache.invalidate([senderId, receiverId]);
    logger.log({
      event: NudgeLogEvent.SENT,
      nudgeId: nudge.id.value,
      todoId: command.todoId,
      senderId: senderId.value,
      receiverId: receiverId.value,
    });
    return nudge;
  }

  async #send(request: NudgeSendRequest): Promise<Nudge> {
    const { mutationLock, nudgeRepository, mutualFriendReader, notifier } = this.#dependencies;
    const { senderId, receiverId, todoId } = request;
    await mutationLock.acquire([
      NudgeLockKeys.dailyQuota(senderId),
      NudgeLockKeys.cooldown(senderId, todoId),
    ]);

    const target = await nudgeRepository.findTargetTodo(todoId);
    if (target == null || !target.isOwnedBy(receiverId) || !target.isPublic()) {
      throw nudgeTodoNotFound(todoId);
    }
    if (!target.isActiveOn(request.window.localDate)) {
      throw nudgeTodoNotActiveToday(todoId);
    }
    await this.#assertDailyLimit(request);
    await this.#assertCooldown(request);

    const created = Nudge.create({
      id: await nudgeRepository.nextId(),
      senderId,
      receiverId,
      todoId,
      message: request.message,
      now: request.requestedAt,
    });
    await nudgeRepository.save(created);
    // 알림 작업은 콕 저장과 같은 트랜잭션에 넣어 커밋 직후 프로세스가 멈춰도 잃지 않는다
    await notifier.notifyNudgeSent({
      nudgeId: created.id,
      senderId,
      receiverId,
      senderName: await mutualFriendReader.getUserDisplayName(senderId),
      todoId,
      todoTitle: target.title,
      message: request.message?.value,
    });
    return created;
  }

  async #assertDailyLimit(request: NudgeSendRequest): Promise<void> {
    const { nudgeRepository, limitReader } = this.#dependencies;
    const { senderId, window } = request;
    const dailyLimit = await limitReader.readLimitInTransaction(senderId);
    const used = await nudgeRepository.countSentBetween(senderId, window);
    if (dailyLimit != null && used >= dailyLimit) {
      throw nudgeDailyLimitReached(
        await limitReader.readFeatureQuotaInTransaction(senderId, {
          used,
          resetsAt: window.endsAt,
        }),
      );
    }
  }

  async #assertCooldown(request: NudgeSendRequest): Promise<void> {
    const { nudgeRepository, clock } = this.#dependencies;
    const lastNudge = await nudgeRepository.findLastSentForTodo(request.senderId, request.todoId);
    const cooldown = evaluateNudgeCooldown({
      lastSentAt: lastNudge?.createdAt ?? null,
      now: clock.now(),
    });
    if (cooldown.isActive) {
      throw nudgeCooldownActive(request.receiverId, cooldown.remainingSeconds);
    }
  }
}
