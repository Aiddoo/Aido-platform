import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NudgeId } from "../../domain/nudge-id.vo.js";
import { nudgeNotFound } from "../nudges.errors.js";
import { NudgeLogEvent } from "../nudges.log-events.js";
import type { NudgeCountCachePort } from "../ports/nudge-count-cache.port.js";
import type { NudgeRepositoryPort } from "../ports/nudge.repository.port.js";

export interface MarkNudgeReadCommand {
  readonly userId: string;
  readonly nudgeId: number;
}

export interface MarkNudgeReadDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly nudgeRepository: Pick<NudgeRepositoryPort, "findById" | "lockInteractionTodo" | "save">;
  readonly countCache: Pick<NudgeCountCachePort, "invalidate">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "debug">;
}

export class MarkNudgeReadUseCase {
  readonly #dependencies: MarkNudgeReadDependencies;

  constructor(dependencies: MarkNudgeReadDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: MarkNudgeReadCommand): Promise<void> {
    const { unitOfWork, nudgeRepository, clock, logger } = this.#dependencies;
    const userId = UserId.reconstitute(command.userId);
    const nudgeId = NudgeId.reconstitute(command.nudgeId);
    const received = await nudgeRepository.findById(nudgeId);
    if (received == null || !received.isReceivedBy(userId)) {
      throw nudgeNotFound(nudgeId);
    }
    if (received.readAt != null) {
      return;
    }

    const isMarked = await unitOfWork.run(async () => {
      // save()는 답장 컬럼도 함께 쓰므로 답장과 같은 할 일 행 잠금 뒤에 다시 읽어야 그사이 남은 답장을 지우지 않는다
      await nudgeRepository.lockInteractionTodo(TodoId.reconstitute(received.todoId), userId);
      const nudge = await nudgeRepository.findById(nudgeId);
      if (nudge == null) {
        throw nudgeNotFound(nudgeId);
      }
      if (!nudge.markRead(clock.now())) {
        return false;
      }
      await nudgeRepository.save(nudge);
      return true;
    });

    if (isMarked) {
      await this.#dependencies.countCache.invalidate([userId]);
      logger.debug({ event: NudgeLogEvent.READ, userId: command.userId, nudgeId: command.nudgeId });
    }
  }
}
