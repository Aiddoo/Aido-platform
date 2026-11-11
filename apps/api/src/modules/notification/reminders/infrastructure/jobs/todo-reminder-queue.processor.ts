import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import { WindowedCounter } from "#api/shared/application/alerts/windowed-counter";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  createTodoReminderNotificationMessage,
  createTodoSeriesPausedNotificationMessage,
} from "../../../push/application/messages/scheduler-notification.messages.js";
import { NotificationRecipientLocaleReaderPort } from "../../../push/application/ports/notification-recipient-locale.reader.port.js";
import { PublishNotificationUseCase } from "../../../push/application/use-cases/publish-notification.use-case.js";
import { NotificationProviderLogEvent } from "../../../push/infrastructure/adapters/notification-provider.log-events.js";
import { todoSeriesPausedJobKey } from "../../../push/infrastructure/jobs/notification-job-keys.constants.js";
import { TodoReminderReaderPort } from "../../application/ports/todo-reminder-reader.port.js";
import { TodoSeriesOwnerDormancyPort } from "../../application/ports/todo-series-owner-dormancy.port.js";
import { ReminderAlerts } from "../../application/reminders.alerts.js";
import { NotificationRemindersLogEvent } from "../../application/reminders.log-events.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../domain/notification-campaign.constants.js";
import { REMINDER_LATE_LIMIT_MINUTES } from "../../domain/notification-schedule.domain-service.js";
import {
  createReminderOccurrenceKey,
  reminderFireAt,
  reminderLateSkipReason,
} from "../../domain/reminder-plan.domain-service.js";
import {
  type ReminderJobData,
  TODO_REMINDER_QUEUE,
  TODO_SERIES_PAUSED_JOB_NAME,
  TODO_SERIES_PAUSED_QUEUE,
  type TodoReminderRuntimeJob,
} from "./todo-reminder.queue.js";

/**
 * 늦어서 버린 리마인더가 한 시간(REMINDER_LATE_SKIP_WINDOW_MS) 안에 이만큼 쌓이면 경보한다.
 * 배포로 worker가 잠깐 멈춘 뒤 몇 건은 늘 생기므로 그보다 크게 잡는다.
 */
export const REMINDER_LATE_SKIP_THRESHOLD = 20;
export const REMINDER_LATE_SKIP_WINDOW_MS = 60 * 60_000;
const LATE_SKIP_COUNTER_KEY = "late-skip";

@Injectable()
export class TodoReminderQueueProcessor implements OnModuleInit {
  readonly #logger = new Logger(TodoReminderQueueProcessor.name);
  readonly #lateSkips = new WindowedCounter(REMINDER_LATE_SKIP_WINDOW_MS);

  readonly #reader: Pick<TodoReminderReaderPort, "findActiveTodo">;
  readonly #seriesOwnerDormancy: Pick<TodoSeriesOwnerDormancyPort, "findDormantSince">;
  readonly #notificationPublisher: Pick<PublishNotificationUseCase, "publish">;
  readonly #recipientLocaleReader: Pick<NotificationRecipientLocaleReaderPort, "getLocale">;
  readonly #jobQueue: Pick<JobQueuePort, "enqueue" | "work">;
  readonly #clock: Pick<ClockPort, "now">;
  readonly #alert: Pick<OperationalAlertPort, "raise">;

  constructor(
    @Inject(TodoReminderReaderPort) reader: Pick<TodoReminderReaderPort, "findActiveTodo">,
    @Inject(TodoSeriesOwnerDormancyPort)
    seriesOwnerDormancy: Pick<TodoSeriesOwnerDormancyPort, "findDormantSince">,
    @Inject(PublishNotificationUseCase)
    notificationPublisher: Pick<PublishNotificationUseCase, "publish">,
    @Inject(NotificationRecipientLocaleReaderPort)
    recipientLocaleReader: Pick<NotificationRecipientLocaleReaderPort, "getLocale">,
    @Inject(JobQueuePort) jobQueue: Pick<JobQueuePort, "enqueue" | "work">,
    @Inject(ClockPort) clock: Pick<ClockPort, "now">,
    @Inject(OperationalAlertPort) alert: Pick<OperationalAlertPort, "raise">,
  ) {
    this.#reader = reader;
    this.#seriesOwnerDormancy = seriesOwnerDormancy;
    this.#notificationPublisher = notificationPublisher;
    this.#recipientLocaleReader = recipientLocaleReader;
    this.#jobQueue = jobQueue;
    this.#clock = clock;
    this.#alert = alert;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.work(TODO_REMINDER_QUEUE, async (jobs) => {
      for (const job of jobs) {
        await this.process(job.data);
      }
    });
  }

  async process(job: TodoReminderRuntimeJob): Promise<void> {
    if (job.name === TODO_SERIES_PAUSED_JOB_NAME) {
      await this.#sendSeriesPausedNotice(job.data);
      return;
    }
    await this.#sendReminder(job.data);
  }

  async #sendReminder({ todoId, userId, stageLabel }: ReminderJobData): Promise<void> {
    const stage = resolveReminderStage(stageLabel);
    this.#logger.debug({ event: NotificationProviderLogEvent.JOB_STARTED, todoId, userId, stage });

    const todo = await this.#reader.findActiveTodo(TodoId.reconstitute(todoId));
    if (!todo) {
      this.#logger.debug({
        event: NotificationProviderLogEvent.JOB_SKIPPED,
        todoId,
        userId,
        reason: "TODO_INACTIVE",
      });
      return;
    }

    // 작업에는 울릴 시각이 없어 할 일의 지금 시각에서 단계 리드 타임을 뺀다. 시각을 바꾸면 작업도 다시 등록된다
    if (
      todo.scheduledAt != null &&
      this.#skipIfLate(todo.scheduledAt, { todoId, userId, stageLabel })
    ) {
      return;
    }

    const dormantSince =
      todo.seriesId == null
        ? null
        : await this.#seriesOwnerDormancy.findDormantSince(UserId.reconstitute(userId));
    if (dormantSince != null) {
      // 운영에서 세므로 debug가 아닌 info다. 단계·식별자만 남긴다.
      this.#logger.log({
        event: NotificationProviderLogEvent.TODO_REMINDER_DORMANT_OWNER_SKIPPED,
        todoId,
        userId,
        stage,
      });
      await this.#jobQueue.enqueue(
        TODO_SERIES_PAUSED_QUEUE,
        { name: TODO_SERIES_PAUSED_JOB_NAME, data: { todoId, userId } },
        { idempotencyKey: todoSeriesPausedJobKey(userId, dormantSince) },
      );
      return;
    }

    const locale = await this.#recipientLocaleReader.getLocale(UserId.reconstitute(userId));
    const message = createTodoReminderNotificationMessage({
      todoTitle: todo.title,
      stage,
      locale,
      variantContext: {
        campaignKey: `${SCHEDULER_CAMPAIGN_KEY.TODO_REMINDER}.${stageLabel}`,
        recipientId: userId,
        occurrenceKey: `${todoId}:${stageLabel}`,
      },
    });

    // 중복 판단은 유니크 인덱스(할 일 + 단계 + 회차) 한 곳이 한다. 이미 울렸으면 null이 돌아온다.
    const published = await this.#notificationPublisher.publish({
      userId,
      type: "TODO_REMINDER",
      purpose: "SCHEDULED_SERVICE",
      campaignKey: SCHEDULER_CAMPAIGN_KEY.TODO_REMINDER,
      variantId: message.variantId,
      title: message.title,
      body: message.body,
      copyKey: message.copyKey,
      copyFacts: message.copyFacts,
      todoId,
      metadata: { stage: stageLabel },
      reminderOccurrenceKey: createReminderOccurrenceKey(todo.startDate, todo.scheduledLocalTime),
    });

    if (published == null) {
      this.#logger.debug({
        event: NotificationProviderLogEvent.JOB_SKIPPED,
        todoId,
        userId,
        reason: "ALREADY_NOTIFIED",
      });
      return;
    }

    this.#logger.log({ event: NotificationProviderLogEvent.JOB_COMPLETED, todoId, userId, stage });
  }

  // true면 늦어서 보내지 않는다
  #skipIfLate(
    scheduledAt: Temporal.Instant,
    { todoId, userId, stageLabel }: ReminderJobData,
  ): boolean {
    const now = this.#clock.now();
    const reason = reminderLateSkipReason({
      scheduledAt,
      stageLabel,
      now,
      limitMinutes: REMINDER_LATE_LIMIT_MINUTES,
    });
    if (reason == null) {
      return false;
    }
    this.#logger.warn({
      event: NotificationRemindersLogEvent.TODO_REMINDER_LATE_SKIPPED,
      todoId,
      userId,
      stage: resolveReminderStage(stageLabel),
      reason,
      lateMinutes: reminderFireAt(scheduledAt, stageLabel).until(now, { largestUnit: "minutes" })
        .minutes,
    });
    this.#countLateSkip(now);
    return true;
  }

  #countLateSkip(now: Temporal.Instant): void {
    // 창 안에서 기준에 닿는 순간 한 번만 올린다
    if (
      this.#lateSkips.add(LATE_SKIP_COUNTER_KEY, now.epochMilliseconds) ===
      REMINDER_LATE_SKIP_THRESHOLD
    ) {
      this.#alert.raise({
        ...ReminderAlerts.LATE_SKIPS_HIGH,
        details: {
          skippedCount: REMINDER_LATE_SKIP_THRESHOLD,
          windowMinutes: REMINDER_LATE_SKIP_WINDOW_MS / 60_000,
        },
      });
    }
  }

  async #sendSeriesPausedNotice(job: { readonly todoId: number; readonly userId: string }) {
    const { todoId, userId } = job;
    const locale = await this.#recipientLocaleReader.getLocale(UserId.reconstitute(userId));
    const message = createTodoSeriesPausedNotificationMessage({
      locale,
      variantContext: {
        campaignKey: SCHEDULER_CAMPAIGN_KEY.TODO_SERIES_PAUSED,
        recipientId: userId,
        occurrenceKey: `${todoId}:series-paused`,
      },
    });
    // 리마인더와 같은 종류·목적으로 보내 기존 알림 동의를 그대로 따른다. 탭하면 그 할 일로 간다.
    await this.#notificationPublisher.publish({
      userId,
      type: "TODO_REMINDER",
      purpose: "SCHEDULED_SERVICE",
      campaignKey: SCHEDULER_CAMPAIGN_KEY.TODO_SERIES_PAUSED,
      variantId: message.variantId,
      title: message.title,
      body: message.body,
      copyKey: message.copyKey,
      copyFacts: message.copyFacts,
      todoId,
      metadata: { stage: "series-paused" },
    });
    this.#logger.log({
      event: NotificationProviderLogEvent.TODO_SERIES_PAUSED_SENT,
      todoId,
      userId,
    });
  }
}

/** 알 수 없는 단계 문자열은 가장 이른 단계 문구로 보낸다. */
function resolveReminderStage(stage: string): "60min" | "10min" {
  return stage === "10min" ? stage : "60min";
}
