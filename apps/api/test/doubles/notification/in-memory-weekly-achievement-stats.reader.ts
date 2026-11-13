import {
  WeeklyAchievementStatsReaderPort,
  type WeeklyStatsParams,
} from "#api/modules/notification/reminders/application/ports/weekly-achievement-stats-reader.port";
import type { UserTodoCount } from "#api/modules/notification/reminders/application/read-models/scheduler.read-model";
import type { WeeklyStatsUserSeed } from "#test/contracts/notification/weekly-achievement-stats-reader.contract";

function dayNumberOf(date: Temporal.PlainDate): number {
  return Temporal.PlainDate.from("1970-01-01").until(date).days;
}

interface StoredTodo {
  readonly firstDay: number;
  readonly lastDay: number;
  readonly completed: boolean;
}

interface StoredUser {
  readonly userId: string;
  readonly timezone: string;
  readonly isFree: boolean;
  readonly todos: readonly StoredTodo[];
}

// Drizzle처럼 여러 날 할 일을 기간 안에 걸친 날마다 하나로 세고, 기간과 겹치는 할 일이 없는 사용자는 뺀다
export class InMemoryWeeklyAchievementStatsReader extends WeeklyAchievementStatsReaderPort {
  readonly #users = new Map<string, StoredUser>();
  #sequence = 0;

  async givenUser(seed: WeeklyStatsUserSeed, userId?: string): Promise<string> {
    this.#sequence += 1;
    const id = userId ?? `weekly-user-${this.#sequence}`;
    this.#users.set(id, {
      userId: id,
      timezone: seed.timezone,
      isFree: (seed.plan ?? "FREE") === "FREE",
      todos: (seed.todos ?? []).map((todo) => ({
        firstDay: dayNumberOf(Temporal.PlainDate.from(todo.start)),
        lastDay: dayNumberOf(Temporal.PlainDate.from(todo.end ?? todo.start)),
        completed: todo.completed ?? false,
      })),
    });
    return id;
  }

  async groupTotalTodosByUser(params: WeeklyStatsParams): Promise<UserTodoCount[]> {
    return this.#countTodoDaysByUser(params, () => true);
  }

  async groupCompletedTodosByUser(params: WeeklyStatsParams): Promise<UserTodoCount[]> {
    return this.#countTodoDaysByUser(params, (todo) => todo.completed);
  }

  async findFreeRecipientIds(userIds: string[]): Promise<Set<string>> {
    return new Set(userIds.filter((userId) => this.#users.get(userId)?.isFree === true));
  }

  #countTodoDaysByUser(
    params: WeeklyStatsParams,
    include: (todo: StoredTodo) => boolean,
  ): UserTodoCount[] {
    const firstDay = dayNumberOf(params.periodStart);
    const lastDay = dayNumberOf(params.periodEnd) - 1;
    return [...this.#users.values()].flatMap((user) => {
      if (!params.timezones.includes(user.timezone)) {
        return [];
      }
      const overlapping = user.todos.filter(
        (todo) => include(todo) && todo.firstDay <= lastDay && todo.lastDay >= firstDay,
      );
      if (overlapping.length === 0) {
        return [];
      }
      const count = overlapping.reduce(
        (sum, todo) =>
          sum + Math.min(todo.lastDay, lastDay) - Math.max(todo.firstDay, firstDay) + 1,
        0,
      );
      return [{ userId: user.userId, count }];
    });
  }
}
