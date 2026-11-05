import { Inject, Injectable, Logger, type OnModuleInit, Optional } from "@nestjs/common";

import {
  NotificationPublisher,
  NOTIFICATION_RECIPIENT_LOCALE_READER,
  type NotificationRecipientLocaleReaderPort,
} from "#api/modules/notification/notification-delivery.public";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import {
  createTodoReminderNotificationMessage,
  createTodoSeriesPausedNotificationMessage,
} from "../../../application/messages/delivery/notification-messages.js";
import {
  TODO_REMINDER_READER,
  type TodoReminderReaderPort,
} from "../../../application/ports/reminders/todo-reminder-reader.port.js";
import {
  TODO_SERIES_OWNER_DORMANCY,
  type TodoSeriesOwnerDormancyPort,
} from "../../../application/ports/reminders/todo-series-owner-dormancy.port.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../../domain/services/reminders/notification-campaign.js";
import { createReminderOccurrenceKey } from "../../../domain/services/reminders/reminder-plan.js";
import { NotificationProviderLogEvent } from "../../observability/delivery/notification-provider-log.events.js";
import { todoSeriesPausedJobKey } from "../notification-job-keys.js";
import {
  todoReminderJobSchema,
  TODO_REMINDER_QUEUE,
  TODO_REMINDER_WORKER_POLICY,
  TODO_SERIES_PAUSED_JOB_NAME,
  TODO_SERIES_PAUSED_JOB_POLICY,
} from "./todo-reminder-queue.constants.js";

@Injectable()
export class TodoReminderQueueProcessor implements OnModuleInit {
  readonly #logger = new Logger(TodoReminderQueueProcessor.name);

  constructor(
    @Inject(TODO_REMINDER_READER)
    private readonly reader: TodoReminderReaderPort,
    @Inject(TODO_SERIES_OWNER_DORMANCY)
    private readonly seriesOwnerDormancy: TodoSeriesOwnerDormancyPort,
    private readonly notificationPublisher: NotificationPublisher,
    @Inject(NOTIFICATION_RECIPIENT_LOCALE_READER)
    private readonly recipientLocaleReader: NotificationRecipientLocaleReaderPort,
    @Optional() @Inject(JOB_RUNTIME) private readonly runtime?: JobRuntimePort,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.runtime) {
      return;
    }
    await this.runtime.work(
      TODO_REMINDER_QUEUE,
      async (jobs) => {
        for (const job of jobs) {
          await this.process(job.data);
        }
      },
      TODO_REMINDER_WORKER_POLICY,
    );
  }

  async process(untrustedJob: unknown): Promise<void> {
    const parsedJob = todoReminderJobSchema.safeParse(untrustedJob);
    if (!parsedJob.success) {
      this.#logger.warn({ event: NotificationProviderLogEvent.JOB_INVALID });
      return;
    }
    if (parsedJob.data.name === TODO_SERIES_PAUSED_JOB_NAME) {
      await this.#sendSeriesPausedNotice(parsedJob.data.data);
      return;
    }
    const { todoId, userId, stageLabel } = parsedJob.data.data;

    this.#logger.debug({
      event: NotificationProviderLogEvent.JOB_STARTED,
      todoId,
      userId,
      stage: resolveReminderStage(stageLabel),
    });

    const todo = await this.reader.findActiveTodo(todoId);

    if (!todo) {
      this.#logger.debug({
        event: NotificationProviderLogEvent.JOB_SKIPPED,
        todoId,
        userId,
        reason: "TODO_INACTIVE",
      });
      return;
    }

    const dormantSince =
      todo.seriesId == null ? null : await this.seriesOwnerDormancy.findDormantSince(userId);
    if (dormantSince != null) {
      // 운영에서 세므로 debug가 아닌 info다. 단계·식별자만 남긴다.
      this.#logger.log({
        event: NotificationProviderLogEvent.TODO_REMINDER_DORMANT_OWNER_SKIPPED,
        todoId,
        userId,
        stage: resolveReminderStage(stageLabel),
      });
      await this.runtime?.enqueue(
        TODO_REMINDER_QUEUE,
        { name: TODO_SERIES_PAUSED_JOB_NAME, data: { todoId, userId } },
        {
          ...TODO_SERIES_PAUSED_JOB_POLICY,
          idempotencyKey: todoSeriesPausedJobKey(userId, dormantSince),
        },
      );
      return;
    }

    const locale = await this.recipientLocaleReader.getLocale(userId);
    const stage = resolveReminderStage(stageLabel);
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
    const published = await this.notificationPublisher.publish({
      userId,
      type: "TODO_REMINDER",
      purpose: "SCHEDULED_SERVICE",
      campaignKey: SCHEDULER_CAMPAIGN_KEY.TODO_REMINDER,
      variantId: message.variantId,
      title: message.title,
      body: message.body,
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

  async #sendSeriesPausedNotice(job: { readonly todoId: number; readonly userId: string }) {
    const { todoId, userId } = job;
    const locale = await this.recipientLocaleReader.getLocale(userId);
    const message = createTodoSeriesPausedNotificationMessage({
      locale,
      variantContext: {
        campaignKey: SCHEDULER_CAMPAIGN_KEY.TODO_SERIES_PAUSED,
        recipientId: userId,
        occurrenceKey: `${todoId}:series-paused`,
      },
    });
    // 리마인더와 같은 종류·목적으로 보내 기존 알림 동의를 그대로 따른다. 탭하면 그 할 일로 간다.
    await this.notificationPublisher.publish({
      userId,
      type: "TODO_REMINDER",
      purpose: "SCHEDULED_SERVICE",
      campaignKey: SCHEDULER_CAMPAIGN_KEY.TODO_SERIES_PAUSED,
      variantId: message.variantId,
      title: message.title,
      body: message.body,
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
function resolveReminderStage(stage: string): "60min" | "10min" | "immediate" {
  if (stage === "10min" || stage === "immediate") {
    return stage;
  }
  return "60min";
}
