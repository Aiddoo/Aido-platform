import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { type MutationLockPort, type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { resolveWallClockTimezone } from "#api/shared/domain/time/time-zone-name";

import { TodoCategoryLockKeys } from "../../../categories/application/categories.lock-keys.js";
import { resolveScheduledInstant } from "../../../shared/domain/todo-calendar.domain-service.js";
import { TodoId } from "../../../shared/domain/todo-id.vo.js";
import type { TodoSeriesRepositoryPort } from "../../../todo-series/application/ports/todo-series.repository.port.js";
import type { TodoCachePort } from "../ports/todo-cache.port.js";
import type { TodoOwnerTimezonePort } from "../ports/todo-owner-timezone.port.js";
import type { TodoReminderSchedulerPort } from "../ports/todo-reminder-scheduler.port.js";
import type { RebaseCandidate, TodoRepositoryPort } from "../ports/todo.repository.port.js";
import { TodoLockKeys } from "../todos.lock-keys.js";
import { TodoLogEvent } from "../todos.log-events.js";

const TODO_TIMEZONE_REBASE_BUDGET = {
  /** 한 트랜잭션에 잡는 할 일 수. 사용자 잠금을 짧게 쥐어 앱 요청을 오래 막지 않는다. */
  BATCH_SIZE: 500,
} as const;

export interface RebaseTodoTimezoneInput {
  readonly userId: string;
}

type RebaseTodoTimezoneOutcome = "COMPLETED" | "NO_PREFERENCE" | "SUPERSEDED";

export interface RebaseTodoTimezoneResult {
  readonly outcome: RebaseTodoTimezoneOutcome;
  readonly scannedCount: number;
  readonly rebasedCount: number;
  /** 벽시계 칸이 비어 건너뛴 행. 롤백 중 옛 서버가 쓴 행이고 재배포 SQL이 채운다. */
  readonly skippedCount: number;
  readonly seriesCount: number;
}

interface RebaseTodoTimezoneDependencies {
  readonly todoRepository: Pick<
    TodoRepositoryPort,
    "lockRebaseCandidates" | "updateRebasedInstants"
  >;
  readonly seriesRepository: Pick<TodoSeriesRepositoryPort, "updateTimezoneByUserId">;
  readonly ownerTimezone: Pick<TodoOwnerTimezonePort, "findTimezone">;
  readonly todoReminder: Pick<TodoReminderSchedulerPort, "cancelReminders" | "scheduleReminders">;
  readonly todoCache: Pick<TodoCachePort, "invalidateFriendTodos">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
  readonly batchSize?: number;
}

/**
 * 시간대가 바뀐 사용자의 시간 있는 모든 할 일을 벽시계에서 다시 계산한다. 순간은 언제나
 * `날짜 + 벽시계 + 사용자 현재 시간대`이고 완료했거나 지난 할 일도 예외가 아니다. 알림은 완료 전이고
 * 앞으로 울릴 회차만 다시 잡는다.
 *
 * 벽시계에서 계산하므로 몇 번을 돌아도 결과가 같고, 순간이 그대로인 행은 쓰지 않는다.
 * pg-boss는 at-least-once라 중간 실패 뒤 재시도도 남은 행만 바꾼다. 묶음마다 최신 시간대를 다시 읽어
 * 시간대가 또 바뀌었으면 멈춘다. 그 변경이 등록한 다음 작업이 끝까지 다시 계산한다.
 */
export class RebaseTodoTimezoneUseCase {
  readonly #dependencies: RebaseTodoTimezoneDependencies;

  constructor(dependencies: RebaseTodoTimezoneDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RebaseTodoTimezoneInput): Promise<RebaseTodoTimezoneResult> {
    const { userId } = input;
    const ownerId = UserId.reconstitute(userId);
    const startedAt = performance.now();
    const stored = await this.#dependencies.ownerTimezone.findTimezone(ownerId);
    const timezone = stored == null ? null : resolveWallClockTimezone(stored);
    const result =
      timezone == null
        ? { ...EMPTY_RESULT, outcome: "NO_PREFERENCE" as const }
        : await this.#rebase(userId, timezone);
    if (result.rebasedCount > 0) {
      await this.#dependencies.todoCache.invalidateFriendTodos(ownerId);
    }
    this.#dependencies.logger.log({
      event: TodoLogEvent.TIMEZONE_REBASED,
      userId,
      timezone,
      durationMs: performance.now() - startedAt,
      ...result,
    });
    return result;
  }

  async #rebase(userId: string, timezone: string): Promise<RebaseTodoTimezoneResult> {
    const { unitOfWork, seriesRepository } = this.#dependencies;
    const batchSize = this.#dependencies.batchSize ?? TODO_TIMEZONE_REBASE_BUDGET.BATCH_SIZE;
    // 규칙을 먼저 바꾼다. 그 뒤 밤 작업이 만드는 회차는 새 시간대이고, 그 전에 만든 회차는 아래에서 읽힌다.
    const seriesCount = await unitOfWork.run(async () => {
      await this.#acquireLocks(userId);
      return seriesRepository.updateTimezoneByUserId(UserId.reconstitute(userId), timezone);
    });

    let afterId: number | null = null;
    let scannedCount = 0;
    let rebasedCount = 0;
    let skippedCount = 0;
    for (;;) {
      const batch: RebasedBatch = await unitOfWork.run(() =>
        this.#rebaseBatch(userId, timezone, afterId, batchSize),
      );
      if (batch.superseded) {
        return { outcome: "SUPERSEDED", seriesCount, scannedCount, rebasedCount, skippedCount };
      }
      scannedCount += batch.scannedCount;
      rebasedCount += batch.rebasedCount;
      skippedCount += batch.skippedCount;
      afterId = batch.lastId;
      if (batch.scannedCount < batchSize) {
        return { outcome: "COMPLETED", seriesCount, scannedCount, rebasedCount, skippedCount };
      }
    }
  }

  async #rebaseBatch(
    userId: string,
    timezone: string,
    afterId: number | null,
    limit: number,
  ): Promise<RebasedBatch> {
    const { todoRepository, ownerTimezone, todoReminder } = this.#dependencies;
    await this.#acquireLocks(userId);
    const ownerId = UserId.reconstitute(userId);
    const latest = await ownerTimezone.findTimezone(ownerId);
    if (latest == null || resolveWallClockTimezone(latest) !== timezone) {
      return { ...EMPTY_BATCH, superseded: true };
    }
    const candidates = await todoRepository.lockRebaseCandidates({
      userId: ownerId,
      afterId: afterId == null ? null : TodoId.reconstitute(afterId),
      limit,
    });
    const rebased = candidates.flatMap((candidate) => rebaseInstant(candidate, timezone));
    await todoRepository.updateRebasedInstants(rebased);
    const now = this.#dependencies.clock.now();
    const reminders = rebased.filter((row) => hasPendingReminder(row, now));
    // 행과 함께 커밋한다. 실패하면 행도 그대로라 재시도가 같은 행을 다시 본다.
    await todoReminder.cancelReminders(reminders.map(({ todoId }) => todoId.value));
    await todoReminder.scheduleReminders(
      reminders.map(({ todoId, scheduledTime }) => ({
        todoId: todoId.value,
        scheduledTime,
        userId,
      })),
    );
    return {
      superseded: false,
      scannedCount: candidates.length,
      rebasedCount: rebased.length,
      skippedCount: candidates.filter((row) => row.scheduledLocalTime == null).length,
      lastId: candidates.at(-1)?.todoId ?? afterId,
    };
  }

  /** 카테고리 삭제·회차 채우기·이후 모두 수정과 같은 순서(사용자 잠금 → 규칙 행 → 할 일 행)다. */
  #acquireLocks(userId: string): Promise<void> {
    return this.#dependencies.mutationLock.acquire([
      TodoCategoryLockKeys.userCategories(userId),
      TodoLockKeys.sortOrder(userId),
    ]);
  }
}

interface RebasedBatch {
  readonly superseded: boolean;
  readonly scannedCount: number;
  readonly rebasedCount: number;
  readonly skippedCount: number;
  readonly lastId: number | null;
}

const EMPTY_BATCH: RebasedBatch = {
  superseded: false,
  scannedCount: 0,
  rebasedCount: 0,
  skippedCount: 0,
  lastId: null,
};

const EMPTY_RESULT = { scannedCount: 0, rebasedCount: 0, skippedCount: 0, seriesCount: 0 } as const;

/** 순간이 그대로면(이름만 다른 같은 시각) 쓰기와 재예약을 하지 않는다. */
function rebaseInstant(candidate: RebaseCandidate, timezone: string) {
  const { todoId, startDate, scheduledLocalTime, scheduledTime, completed } = candidate;
  const next = resolveScheduledInstant(startDate, scheduledLocalTime, timezone);
  if (next == null || next.equals(scheduledTime)) {
    return [];
  }
  return [
    {
      todoId: TodoId.reconstitute(todoId),
      scheduledTime: next,
      previousTime: scheduledTime,
      completed,
    },
  ];
}

/** 완료 전이고 옛 시각이나 새 시각이 앞으로일 때만 지울 예약이나 새 예약이 있다. 지난 이력은 예약을 건드리지 않는다. */
function hasPendingReminder(
  row: {
    readonly scheduledTime: Temporal.Instant;
    readonly previousTime: Temporal.Instant;
    readonly completed: boolean;
  },
  now: Temporal.Instant,
): boolean {
  return (
    !row.completed &&
    (Temporal.Instant.compare(row.scheduledTime, now) > 0 ||
      Temporal.Instant.compare(row.previousTime, now) > 0)
  );
}
