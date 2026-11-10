import type {
  ReminderWeatherReport,
  ReminderWeatherReportReaderPort,
  ReminderWeatherReportRequest,
} from "#api/modules/notification/application/ports/reminders/reminder-weather-report.reader.port";
import type {
  WeatherFallbackUser,
  WeatherReminderTodo,
  WeatherReminderUser,
} from "#api/modules/notification/application/ports/reminders/scheduler-read-models";
import type {
  WeatherReminderParams,
  WeatherReminderReaderPort,
  WeatherReminderTodoQuery,
} from "#api/modules/notification/application/ports/reminders/weather-reminder-reader.port";
import type { NotificationHistoryReader } from "#api/modules/notification/inbox/application/notification-history.reader";
import type { CreateNotificationData } from "#api/modules/notification/inbox/application/ports/notification-draft.port";

/** 아침·저녁 날씨 알림 수신자와 할 일을 고정해 돌려주고 조회 조건을 기록한다. */
export class StubWeatherReminderReader implements WeatherReminderReaderPort {
  readonly userParams: WeatherReminderParams[] = [];
  readonly todoQueries: WeatherReminderTodoQuery[] = [];
  usersWithLocation: WeatherReminderUser[] = [];
  fallbackUsers: WeatherFallbackUser[] = [];
  todos: WeatherReminderTodo[] = [];

  async findWeatherMorningUsersWithLocation(params: WeatherReminderParams) {
    this.userParams.push(params);
    return this.usersWithLocation;
  }

  async findWeatherMorningFallbackUsers() {
    return this.fallbackUsers;
  }

  async findWeatherEveningUsersWithLocation(params: WeatherReminderParams) {
    this.userParams.push(params);
    return this.usersWithLocation;
  }

  async findWeatherEveningFallbackUsers() {
    return this.fallbackUsers;
  }

  async findScheduledTodosBetween(
    params: WeatherReminderTodoQuery,
  ): Promise<WeatherReminderTodo[]> {
    this.todoQueries.push({ ...params });
    const userIds = new Set(params.userIds);
    return this.todos.filter(
      (todo) =>
        userIds.has(todo.userId) &&
        todo.scheduledTime.getTime() >= params.from.getTime() &&
        todo.scheduledTime.getTime() < params.until.getTime(),
    );
  }
}

/** 발행한 알림 배치를 그대로 기록한다. */
export class StubNotificationBatchPublisher {
  readonly batches: CreateNotificationData[][] = [];

  async publishBatch(items: CreateNotificationData[]): Promise<{ count: number }> {
    this.batches.push(items);
    return { count: items.length };
  }

  get published(): CreateNotificationData[] {
    return this.batches.flat();
  }
}

export class StubNotificationHistoryReader implements Pick<
  NotificationHistoryReader,
  "findAlreadyNotifiedUserIds"
> {
  alreadyNotified = new Set<string>();

  async findAlreadyNotifiedUserIds(): Promise<Set<string>> {
    return new Set(this.alreadyNotified);
  }
}

/** 키별 리포트를 돌려주고 요청을 기록한다. 리포트가 없는 키는 조회 실패와 같다. */
export class StubReminderWeatherReportReader implements ReminderWeatherReportReaderPort {
  readonly requests: (readonly ReminderWeatherReportRequest[])[] = [];
  reports = new Map<string, ReminderWeatherReport>();

  async readReports(
    requests: readonly ReminderWeatherReportRequest[],
  ): Promise<ReadonlyMap<string, ReminderWeatherReport>> {
    this.requests.push(requests);
    return new Map(
      requests.flatMap((request) => {
        const report = this.reports.get(request.key);
        return report == null ? [] : [[request.key, report] as const];
      }),
    );
  }
}
