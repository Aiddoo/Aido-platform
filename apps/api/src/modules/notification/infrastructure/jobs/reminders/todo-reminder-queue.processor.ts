import { Inject, Injectable, Logger, type OnModuleInit, Optional } from "@nestjs/common";

import {
  NotificationPublisher,
  NOTIFICATION_RECIPIENT_LOCALE_READER,
  type NotificationRecipientLocaleReaderPort,
} from "#api/modules/notification/notification-delivery.public";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import { subtractDays } from "#api/shared/domain/date/utils/arithmetic";

import { createTodoReminderNotificationMessage } from "../../../application/messages/delivery/notification-messages.js";
import {
  TODO_REMINDER_READER,
  type TodoReminderReaderPort,
} from "../../../application/ports/reminders/todo-reminder-reader.port.js";
import {
  TODO_SERIES_OWNER_DORMANCY,
  type TodoSeriesOwnerDormancyPort,
} from "../../../application/ports/reminders/todo-series-owner-dormancy.port.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../../domain/services/reminders/notification-campaign.js";
import { NotificationProviderLogEvent } from "../../observability/delivery/notification-provider-log.events.js";
import {
  todoReminderJobSchema,
  TODO_REMINDER_QUEUE,
  TODO_REMINDER_WORKER_POLICY,
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

    if (todo.seriesId != null && (await this.seriesOwnerDormancy.isOwnerDormant(userId))) {
      // 운영에서 세므로 debug가 아닌 info다. 단계·식별자만 남긴다.
      this.#logger.log({
        event: NotificationProviderLogEvent.TODO_REMINDER_DORMANT_OWNER_SKIPPED,
        todoId,
        userId,
        stage: resolveReminderStage(stageLabel),
      });
      return;
    }

    const twentyFourHoursAgo = subtractDays(1);
    const exists = await this.reader.existsRecentReminderNotification({
      todoId,
      since: twentyFourHoursAgo,
      stage: stageLabel,
    });

    if (exists) {
      this.#logger.debug({
        event: NotificationProviderLogEvent.JOB_SKIPPED,
        todoId,
        userId,
        reason: "ALREADY_NOTIFIED",
      });
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

    await this.notificationPublisher.publish({
      userId,
      type: "TODO_REMINDER",
      purpose: "SCHEDULED_SERVICE",
      campaignKey: SCHEDULER_CAMPAIGN_KEY.TODO_REMINDER,
      variantId: message.variantId,
      title: message.title,
      body: message.body,
      todoId,
      metadata: { stage: stageLabel },
    });

    this.#logger.log({ event: NotificationProviderLogEvent.JOB_COMPLETED, todoId, userId, stage });
  }
}

/** 알 수 없는 단계 문자열은 가장 이른 단계 문구로 보낸다. */
function resolveReminderStage(stage: string): "60min" | "10min" | "immediate" {
  if (stage === "10min" || stage === "immediate") {
    return stage;
  }
  return "60min";
}
