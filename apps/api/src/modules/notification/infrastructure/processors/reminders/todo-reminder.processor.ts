import { Inject, Injectable, Logger, type OnModuleInit, Optional } from "@nestjs/common";
import { z } from "zod";

import {
  NotificationPublisher,
  NOTIFICATION_RECIPIENT_LOCALE_READER,
  type NotificationRecipientLocaleReaderPort,
} from "#api/modules/notification/notification-delivery.public";
import { JOB_POLLING_SECONDS } from "#api/shared/application/ports/index";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import { subtractDays } from "#api/shared/domain/date/utils/arithmetic";

import { createTodoReminderNotificationMessage } from "../../../application/messages/delivery/notification-messages.js";
import {
  TODO_REMINDER_READER,
  type TodoReminderReaderPort,
} from "../../../application/ports/reminders/todo-reminder-reader.port.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../../domain/services/reminders/notification-campaign.js";
import {
  reminderJobDataSchema,
  TODO_REMINDER_LEGACY_QUEUE,
  TODO_REMINDER_QUEUE,
} from "../../jobs/reminders/bullmq-reminder-scheduler.adapter.js";
/**
 * BullMQ 리마인더 잡 프로세서 (진입 어댑터).
 *
 * - 잡 실행 시 투두 유효성 확인 (완료/삭제 여부)
 * - 24시간 내 동일 알림 dedup
 * - 알림 발행 (NotificationPublisher)
 */
import { NotificationProviderLogEvent } from "../../observability/delivery/notification-provider-log.events.js";

@Injectable()
export class TodoReminderProcessor implements OnModuleInit {
  readonly #logger = new Logger(TodoReminderProcessor.name);

  constructor(
    @Inject(TODO_REMINDER_READER)
    private readonly reader: TodoReminderReaderPort,
    private readonly notificationPublisher: NotificationPublisher,
    @Inject(NOTIFICATION_RECIPIENT_LOCALE_READER)
    private readonly recipientLocaleReader: NotificationRecipientLocaleReaderPort,
    @Optional() @Inject(JOB_RUNTIME) private readonly runtime?: JobRuntimePort,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.runtime) return;
    await this.runtime.work(
      TODO_REMINDER_QUEUE,
      async (jobs) => {
        for (const job of jobs) await this.process(job.data);
      },
      { teamSize: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.SCHEDULED },
    );
    await this.runtime.work(
      TODO_REMINDER_LEGACY_QUEUE,
      async (jobs) => {
        for (const job of jobs) await this.process(job.data);
      },
      { teamSize: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.SCHEDULED },
    );
  }

  onStalled(jobId: string): void {
    this.#logger.warn({ event: NotificationProviderLogEvent.JOB_STALLED, jobId });
  }

  onError(_error: Error): void {
    this.#logger.error({ event: NotificationProviderLogEvent.WORKER_FAILED });
  }

  onFailed(job: { readonly id?: string; readonly name?: string } | undefined, _error: Error) {
    this.#logger.error({ event: NotificationProviderLogEvent.JOB_FAILED, jobId: job?.id });
  }

  /** 현재 queue는 `{ name, data }`, 레거시 queue는 data만 담는다. */
  async process(untrustedJob: unknown): Promise<void> {
    const parsedJob = TODO_REMINDER_JOB_SCHEMA.safeParse(untrustedJob);
    if (!parsedJob.success) {
      this.#logger.warn({ event: NotificationProviderLogEvent.JOB_INVALID });
      return;
    }
    const { todoId, userId, stageLabel } =
      "data" in parsedJob.data ? parsedJob.data.data : parsedJob.data;

    this.#logger.debug({
      event: NotificationProviderLogEvent.JOB_STARTED,
      todoId,
      userId,
      stage: resolveReminderStage(stageLabel),
    });

    // 1. 투두가 아직 유효한지 확인 (완료/삭제 여부)
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

    // 2. 24시간 내 동일 알림 DB dedup
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

    // 3. 알림 발송 (DB에서 최신 제목 사용 — 스케줄링 이후 제목 변경 반영)
    // 언어는 UserPreference 캐시 경유 (발송 여부 판정과 같은 캐시 엔트리 공유)
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

const TODO_REMINDER_JOB_SCHEMA = z.union([
  reminderJobDataSchema,
  z.object({ data: reminderJobDataSchema }),
]);

/** 레거시 queue 문자열을 현재 reminder 단계로 안전하게 좁힌다. */
function resolveReminderStage(stage: string): "60min" | "10min" | "immediate" {
  if (stage === "10min" || stage === "immediate") {
    return stage;
  }
  return "60min";
}
