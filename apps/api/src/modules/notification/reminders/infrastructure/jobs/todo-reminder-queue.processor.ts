import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { uniq } from "es-toolkit";

import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import { WindowedCounter } from "#api/shared/application/alerts/windowed-counter";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import {
  type JobBatchFailures,
  type JobEnvelope,
  JobQueuePort,
} from "#api/shared/application/ports/job-queue.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import type { SupportedLocale } from "#api/shared/domain/locale";

import type { CreateNotificationData } from "../../../inbox/application/ports/notification-draft.port.js";
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
import type { ActiveTodo } from "../../application/read-models/scheduler.read-model.js";
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
  TODO_REMINDER_JOB_NAME,
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

// 묶음 작업이 함께 쓰는 조회 결과. 휴면은 반복 회차가 있을 때만 소유자마다 한 번 묻는다
interface ReminderBatchContext {
  readonly todos: ReadonlyMap<number, ActiveTodo>;
  readonly locales: ReadonlyMap<string, SupportedLocale>;
  readonly dormantSinceByOwner: Map<string, Promise<string | null>>;
}

interface ReminderDraft {
  readonly jobId: string;
  readonly job: ReminderJobData;
  readonly notification: CreateNotificationData;
}

@Injectable()
export class TodoReminderQueueProcessor implements OnModuleInit {
  readonly #logger = new Logger(TodoReminderQueueProcessor.name);
  readonly #lateSkips = new WindowedCounter(REMINDER_LATE_SKIP_WINDOW_MS);

  readonly #reader: Pick<TodoReminderReaderPort, "findActiveTodos">;
  readonly #seriesOwnerDormancy: Pick<TodoSeriesOwnerDormancyPort, "findDormantSince">;
  readonly #notificationPublisher: Pick<PublishNotificationUseCase, "publish" | "publishBatch">;
  readonly #recipientLocaleReader: Pick<NotificationRecipientLocaleReaderPort, "getLocales">;
  readonly #jobQueue: Pick<JobQueuePort, "enqueue" | "workBatch">;
  readonly #clock: Pick<ClockPort, "now">;
  readonly #alert: Pick<OperationalAlertPort, "raise">;

  constructor(
    @Inject(TodoReminderReaderPort) reader: Pick<TodoReminderReaderPort, "findActiveTodos">,
    @Inject(TodoSeriesOwnerDormancyPort)
    seriesOwnerDormancy: Pick<TodoSeriesOwnerDormancyPort, "findDormantSince">,
    @Inject(PublishNotificationUseCase)
    notificationPublisher: Pick<PublishNotificationUseCase, "publish" | "publishBatch">,
    @Inject(NotificationRecipientLocaleReaderPort)
    recipientLocaleReader: Pick<NotificationRecipientLocaleReaderPort, "getLocales">,
    @Inject(JobQueuePort) jobQueue: Pick<JobQueuePort, "enqueue" | "workBatch">,
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
    await this.#jobQueue.workBatch(TODO_REMINDER_QUEUE, (jobs) => this.processBatch(jobs));
  }

  /** 작업 하나를 묶음과 같은 경로로 처리하고 실패를 그대로 던진다 */
  async process(job: TodoReminderRuntimeJob): Promise<void> {
    const failures = await this.processBatch([
      { id: "single", name: TODO_REMINDER_QUEUE.name, data: job, attempt: 1 },
    ]);
    const [failure] = failures.values();
    if (failures.size > 0) {
      throw failure;
    }
  }

  /**
   * 할 일·언어는 묶음마다 한 번 읽고 리마인더는 한 번에 발행한다. 늦음·휴면 판단은 작업마다 하고
   * 실패한 작업만 돌려줘 그 작업만 재시도된다(반복 멈춤 안내는 다시 실행하면 또 보낸다).
   */
  async processBatch(
    jobs: readonly JobEnvelope<TodoReminderRuntimeJob>[],
  ): Promise<JobBatchFailures> {
    const context = await this.#loadContext(jobs);
    const failures = new Map<string, unknown>();
    const drafts: ReminderDraft[] = [];
    for (const { id, data: job } of jobs) {
      try {
        if (job.name === TODO_SERIES_PAUSED_JOB_NAME) {
          await this.#sendSeriesPausedNotice(job.data, context);
          continue;
        }
        const notification = await this.#prepareReminder(job.data, context);
        if (notification != null) {
          drafts.push({ jobId: id, job: job.data, notification });
        }
      } catch (error) {
        failures.set(id, error);
      }
    }
    await this.#publishReminders(drafts, failures);
    return failures;
  }

  async #loadContext(
    jobs: readonly JobEnvelope<TodoReminderRuntimeJob>[],
  ): Promise<ReminderBatchContext> {
    const reminderTodoIds = jobs.flatMap(({ data: job }) =>
      job.name === TODO_REMINDER_JOB_NAME ? [TodoId.reconstitute(job.data.todoId)] : [],
    );
    const userIds = uniq(jobs.map(({ data: job }) => job.data.userId));
    // 트랜잭션 밖의 서로 다른 읽기라 함께 보낸다
    const [todos, locales] = await Promise.all([
      this.#reader.findActiveTodos(reminderTodoIds),
      this.#recipientLocaleReader.getLocales(userIds.map((userId) => UserId.reconstitute(userId))),
    ]);
    return { todos, locales, dormantSinceByOwner: new Map() };
  }

  async #prepareReminder(
    { todoId, userId, stageLabel }: ReminderJobData,
    context: ReminderBatchContext,
  ): Promise<CreateNotificationData | null> {
    const stage = resolveReminderStage(stageLabel);
    this.#logger.debug({ event: NotificationProviderLogEvent.JOB_STARTED, todoId, userId, stage });

    const todo = context.todos.get(todoId);
    if (!todo) {
      this.#logger.debug({
        event: NotificationProviderLogEvent.JOB_SKIPPED,
        todoId,
        userId,
        reason: "TODO_INACTIVE",
      });
      return null;
    }

    // 작업에는 울릴 시각이 없어 할 일의 지금 시각에서 단계 리드 타임을 뺀다. 시각을 바꾸면 작업도 다시 등록된다
    if (
      todo.scheduledAt != null &&
      this.#skipIfLate(todo.scheduledAt, { todoId, userId, stageLabel })
    ) {
      return null;
    }

    const dormantSince = todo.seriesId == null ? null : await this.#dormantSince(userId, context);
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
      return null;
    }

    const message = createTodoReminderNotificationMessage({
      todoTitle: todo.title,
      stage,
      locale: context.locales.get(userId),
      variantContext: {
        campaignKey: `${SCHEDULER_CAMPAIGN_KEY.TODO_REMINDER}.${stageLabel}`,
        recipientId: userId,
        occurrenceKey: `${todoId}:${stageLabel}`,
      },
    });
    return {
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
    };
  }

  #dormantSince(userId: string, context: ReminderBatchContext): Promise<string | null> {
    const known = context.dormantSinceByOwner.get(userId);
    if (known != null) {
      return known;
    }
    const asked = this.#seriesOwnerDormancy.findDormantSince(UserId.reconstitute(userId));
    context.dormantSinceByOwner.set(userId, asked);
    return asked;
  }

  // 중복 판단은 유니크 인덱스(할 일 + 단계 + 회차) 한 곳이 한다. 이미 울린 회차는 묶음 발행이 세지 않는다
  async #publishReminders(
    drafts: readonly ReminderDraft[],
    failures: Map<string, unknown>,
  ): Promise<void> {
    if (drafts.length === 0) {
      return;
    }
    try {
      const { count } = await this.#notificationPublisher.publishBatch(
        drafts.map((draft) => draft.notification),
      );
      this.#logger.log({
        event: NotificationRemindersLogEvent.TODO_REMINDER_BATCH_PUBLISHED,
        attempted: drafts.length,
        published: count,
      });
    } catch (error) {
      // 묶음은 한 트랜잭션이라 모두 되돌아갔다. 한 건이 막았을 수 있으니 한 건씩 보내 그 작업만 실패시킨다
      this.#logger.warn({
        event: NotificationRemindersLogEvent.TODO_REMINDER_BATCH_PUBLISH_FAILED,
        attempted: drafts.length,
        errorType: toErrorType(error),
      });
      for (const draft of drafts) {
        try {
          await this.#publishOne(draft);
        } catch (draftError) {
          failures.set(draft.jobId, draftError);
        }
      }
    }
  }

  async #publishOne({ job, notification }: ReminderDraft): Promise<void> {
    const { todoId, userId, stageLabel } = job;
    const published = await this.#notificationPublisher.publish(notification);
    if (published == null) {
      this.#logger.debug({
        event: NotificationProviderLogEvent.JOB_SKIPPED,
        todoId,
        userId,
        reason: "ALREADY_NOTIFIED",
      });
      return;
    }
    this.#logger.log({
      event: NotificationProviderLogEvent.JOB_COMPLETED,
      todoId,
      userId,
      stage: resolveReminderStage(stageLabel),
    });
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

  async #sendSeriesPausedNotice(
    job: { readonly todoId: number; readonly userId: string },
    context: ReminderBatchContext,
  ) {
    const { todoId, userId } = job;
    const message = createTodoSeriesPausedNotificationMessage({
      locale: context.locales.get(userId),
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
