import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  addDaysToKey,
  localDateKeyAt,
} from "../../../shared/domain/todo-calendar.domain-service.js";
import type { TodoSeriesOwnerPort } from "../ports/todo-series-owner.port.js";
import type { TodoSeriesRepositoryPort } from "../ports/todo-series.repository.port.js";
import { TodoSeriesLogEvent } from "../todo-series.log-events.js";
import type { MaterializeTodoSeriesUseCase } from "./materialize-todo-series.use-case.js";

export const TODO_SERIES_CATCH_UP_BUDGET = {
  /** 앱 요청 제한(10초) 안에 목록을 돌려주도록 이 시간이 지나면 남은 규칙은 다음 요청이나 밤 작업에 맡긴다. */
  DEADLINE_MS: 5000,
  /** 실패·시간 초과 뒤 다시 시도할 때까지. 고장 난 규칙이 목록 요청마다 비용을 더하지 않게 한다. */
  RETRY_AFTER_MS: 60_000,
} as const;

interface TodoSeriesCatchUpDependencies {
  readonly seriesRepository: Pick<TodoSeriesRepositoryPort, "findIdsBehind">;
  readonly seriesOwner: Pick<TodoSeriesOwnerPort, "findOperatingOwners">;
  readonly clock: ClockPort;
  readonly dueRunner: Pick<MaterializeTodoSeriesUseCase, "execute">;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn">;
  readonly deadlineMs?: number;
}

/**
 * 복귀 후 첫 목록에 오늘 회차가 있게 한다. 판단은 규칙 커서로 한다: 커서가 오늘을 넘지 못했으면 오늘 회차가 없는 것이다.
 * lastActiveAt은 인터셉터가 먼저 갱신해 이 시점에는 휴면 여부를 알 수 없다.
 *
 * 사용자·UTC 날짜마다 한 번만 조회하고 그 뒤 요청은 메모리만 본다. 프로세스가 바뀌어도 커서를 다시 읽을 뿐이다.
 * 조회 상한을 UTC 내일로 잡아 어떤 시간대의 오늘도 포함한다. 어떤 실패도 요청으로 전파하지 않으며 밤 작업이 이어받는다.
 */
export class CatchUpTodoSeriesUseCase {
  readonly #dependencies: TodoSeriesCatchUpDependencies;
  /** userId → 다음에 조회해도 되는 시각(ms). 날짜가 바뀌면 통째로 비워 활동 사용자 수만큼만 남는다. */
  readonly #nextCheckAt = new Map<string, number>();
  readonly #inFlight = new Map<string, Promise<void>>();
  #checkedDate = "";

  constructor(dependencies: TodoSeriesCatchUpDependencies) {
    this.#dependencies = dependencies;
  }

  execute(userId: string): Promise<void> {
    const at = this.#dependencies.clock.now();
    // 날짜가 바뀌는 기준은 지금처럼 UTC 달력이다
    const today = localDateKeyAt(at, "UTC");
    if (today !== this.#checkedDate) {
      this.#checkedDate = today;
      this.#nextCheckAt.clear();
    }
    const inFlight = this.#inFlight.get(userId);
    if (inFlight != null) {
      return inFlight;
    }
    if ((this.#nextCheckAt.get(userId) ?? 0) > at.epochMilliseconds) {
      return Promise.resolve();
    }
    const run = this.#catchUp(userId, addDaysToKey(today, 1)).finally(() => {
      this.#inFlight.delete(userId);
    });
    this.#inFlight.set(userId, run);
    return run;
  }

  async #catchUp(userId: string, through: string): Promise<void> {
    const startedAt = performance.now();
    const { seriesRepository, seriesOwner, logger } = this.#dependencies;
    try {
      const ownerId = UserId.reconstitute(userId);
      const behindIds = await seriesRepository.findIdsBehind(ownerId, through);
      // 세션 캐시(30초) 동안은 정지·탈퇴 대기 계정의 토큰도 통과한다.
      const seriesIds =
        behindIds.length > 0 && (await seriesOwner.findOperatingOwners([ownerId])).has(userId)
          ? behindIds
          : [];
      const { createdCount, failedCount, timedOut } = await this.#materializeAll(userId, seriesIds);
      const settled = failedCount === 0 && !timedOut;
      this.#nextCheckAt.set(
        userId,
        settled
          ? Number.POSITIVE_INFINITY
          : this.#dependencies.clock.now().epochMilliseconds +
              TODO_SERIES_CATCH_UP_BUDGET.RETRY_AFTER_MS,
      );
      if (seriesIds.length > 0) {
        logger.log({
          event: TodoSeriesLogEvent.CATCH_UP_COMPLETED,
          userId,
          seriesCount: seriesIds.length,
          createdCount,
          failedCount,
          timedOut,
          durationMs: performance.now() - startedAt,
        });
      }
    } catch (error) {
      this.#nextCheckAt.set(
        userId,
        this.#dependencies.clock.now().epochMilliseconds +
          TODO_SERIES_CATCH_UP_BUDGET.RETRY_AFTER_MS,
      );
      logger.warn({
        event: TodoSeriesLogEvent.CATCH_UP_FAILED,
        userId,
        errorType: toErrorType(error),
      });
    }
  }

  async #materializeAll(userId: string, seriesIds: readonly string[]) {
    const { dueRunner, logger } = this.#dependencies;
    const deadlineMs = this.#dependencies.deadlineMs ?? TODO_SERIES_CATCH_UP_BUDGET.DEADLINE_MS;
    const startedAt = performance.now();
    let createdCount = 0;
    let failedCount = 0;
    for (const id of seriesIds) {
      if (performance.now() - startedAt >= deadlineMs) {
        return { createdCount, failedCount, timedOut: true };
      }
      try {
        // 다른 기기의 복귀가 먼저 잡았으면 기다려야 이 요청의 목록에도 오늘 회차가 있다.
        createdCount += await dueRunner.execute({ id, userId }, { skipLocked: false });
      } catch (error) {
        failedCount += 1;
        logger.warn({
          event: TodoSeriesLogEvent.CATCH_UP_FAILED,
          userId,
          seriesId: id,
          errorType: toErrorType(error),
        });
      }
    }
    return { createdCount, failedCount, timedOut: false };
  }
}
